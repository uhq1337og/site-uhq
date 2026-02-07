const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const USERS_FILE = path.join(__dirname, 'users.json');
const ROLES_FILE = path.join(__dirname, 'roles.json');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB before rotation

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(ROLES_FILE)) fs.writeFileSync(ROLES_FILE, JSON.stringify({}));

app.use(cors());
app.use(express.json());

// --- Basic authentication for admin routes ---
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'uhq123';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    res.set('WWW-Authenticate', 'Basic realm="Logs"');
    return res.status(401).send('Authentication required');
  }
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Basic') return res.status(400).send('Bad Authorization header');
  const creds = Buffer.from(parts[1], 'base64').toString();
  const idx = creds.indexOf(':');
  const user = creds.slice(0, idx);
  const pass = creds.slice(idx + 1);
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Logs"');
  return res.status(401).send('Invalid credentials');
}

// Serve logs dashboard page BEFORE static files (with authentication)
app.get('/logs.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'logs.html'));
});

// Serve all other static files (without authentication)
app.use(express.static(__dirname));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rotate logs when file exceeds MAX_LOG_SIZE
function rotateLogIfNeeded() {
  if (fs.existsSync(LOG_FILE)) {
    const stat = fs.statSync(LOG_FILE);
    if (stat.size > MAX_LOG_SIZE) {
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const rotatedFile = path.join(LOG_DIR, `app.log.${timestamp}`);
      fs.renameSync(LOG_FILE, rotatedFile);
      console.log(`Log rotated to ${rotatedFile}`);
    }
  }
}

app.post('/log', (req, res) => {
  rotateLogIfNeeded();
  const entry = {
    timestamp: new Date().toISOString(),
    body: req.body
  };

  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
    if (err) {
      console.error('Failed to write log', err);
      return res.status(500).json({ ok: false });
    }
    res.json({ ok: true });
  });
});

// GET /logs endpoint to fetch logs
app.get('/logs', requireAuth, (req, res) => {
  const type = req.query.type || '';
  const limit = parseInt(req.query.limit) || 100;
  
  if (!fs.existsSync(LOG_FILE)) {
    return res.json({ logs: [], total: 0 });
  }

  const content = fs.readFileSync(LOG_FILE, 'utf8');
  let logs = content.trim().split('\n').filter(line => line.length > 0).map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      return null;
    }
  }).filter(log => log !== null);

  if (type) {
    logs = logs.filter(log => log.body.type === type);
  }

  logs = logs.reverse().slice(0, limit);
  res.json({ logs, total: logs.length });
});

// POST /clear-logs to clear all logs
app.post('/clear-logs', requireAuth, (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== ROLES MANAGEMENT =====
function loadRoles() {
  if (!fs.existsSync(ROLES_FILE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveRoles(roles) {
  fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
}

// ===== USERS MANAGEMENT =====
function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// POST /api/register - Register new account
app.post('/api/register', async (req, res) => {
  const { email, pass, user } = req.body;
  if (!email || !pass || !user) return res.status(400).json({ ok: false, error: 'Missing fields' });

  // If DB pool available, persist in MySQL
  if (pool) {
    const conn = await pool.getConnection();
    try {
      const [exists] = await conn.query('SELECT user_id FROM users WHERE username = ? OR email = ? LIMIT 1', [user, email]);
      if (exists.length) return res.status(400).json({ ok: false, error: 'Username or email taken' });

      const userId = 'USER_' + Math.random().toString(36).substr(2, 9).toUpperCase();
      await conn.query('INSERT INTO users (user_id, username, email, password, created_at) VALUES (?, ?, ?, ?, ?)', [userId, user, email, pass, new Date()]);

      const [countRows] = await conn.query('SELECT COUNT(*) as c FROM users');
      if (countRows[0].c === 1) {
        await conn.query('INSERT INTO roles (user_id, role) VALUES (?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)', [userId, 'admin']);
      }

      return res.json({ ok: true, userId, user });
    } catch (e) {
      console.error('DB register error', e);
      return res.status(500).json({ ok: false, error: e.message });
    } finally { conn.release(); }
  }

  // Fallback: file storage
  let users = loadUsers();
  if (users.find(u => u.user.toLowerCase() === user.toLowerCase())) return res.status(400).json({ ok: false, error: 'Username already taken' });
  if (users.find(u => u.email === email)) return res.status(400).json({ ok: false, error: 'Email already registered' });
  const userId = 'USER_' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const newUser = { userId, email, pass, user, createdAt: new Date().toISOString() };
  users.push(newUser);
  saveUsers(users);
  const roles = loadRoles();
  if (users.length === 1) { roles[userId] = 'admin'; saveRoles(roles); }
  res.json({ ok: true, userId, user });
});

// POST /api/login - Login user
app.post('/api/login', async (req, res) => {
  const { email, pass } = req.body;
  if (!email || !pass) return res.status(400).json({ ok: false, error: 'Missing fields' });

  if (pool) {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT user_id, username FROM users WHERE email = ? AND password = ? LIMIT 1', [email, pass]);
      if (rows.length) return res.json({ ok: true, user: rows[0].username, userId: rows[0].user_id });
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    } catch (e) {
      console.error('DB login error', e);
      return res.status(500).json({ ok: false, error: e.message });
    } finally { conn.release(); }
  }

  const users = loadUsers();
  const found = users.find(u => u.email === email && u.pass === pass);
  if (found) return res.json({ ok: true, user: found.user, userId: found.userId });
  res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

// GET /api/users - Get all users with roles
app.get('/api/users', async (req, res) => {
  if (pool) {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(`SELECT u.user_id as userId, u.username as user, COALESCE(r.role,'user') as role, u.created_at as createdAt
        FROM users u LEFT JOIN roles r ON u.user_id = r.user_id ORDER BY u.created_at DESC`);
      return res.json(rows);
    } catch (e) {
      console.error('DB users error', e);
      return res.status(500).json([]);
    } finally { conn.release(); }
  }

  const users = loadUsers();
  const roles = loadRoles();
  const usersWithRoles = users.map(u => ({ userId: u.userId, user: u.user, role: roles[u.userId] || 'user', createdAt: u.createdAt }));
  res.json(usersWithRoles);
});

// GET /api/user/:userId/role - Get user's role
app.get('/api/user/:userId/role', async (req, res) => {
  const { userId } = req.params;
  if (pool) {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query('SELECT role FROM roles WHERE user_id = ? LIMIT 1', [userId]);
      return res.json({ role: rows.length ? rows[0].role : 'user' });
    } catch (e) {
      console.error('DB role fetch error', e);
      return res.json({ role: 'user' });
    } finally { conn.release(); }
  }
  const roles = loadRoles();
  res.json({ role: roles[userId] || 'user' });
});

// POST /api/user/:userId/role - Change user's role (admin only)
app.post('/api/user/:userId/role', requireAuth, async (req, res) => {
  const { role } = req.body;
  const { userId } = req.params;
  if (!['admin', 'moderator', 'user'].includes(role)) return res.status(400).json({ ok: false, error: 'Invalid role' });

  if (pool) {
    const conn = await pool.getConnection();
    try {
      await conn.query('INSERT INTO roles (user_id, role) VALUES (?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)', [userId, role]);
      return res.json({ ok: true, userId, role });
    } catch (e) {
      console.error('DB role update error', e);
      return res.status(500).json({ ok: false, error: e.message });
    } finally { conn.release(); }
  }

  const rolesObj = loadRoles();
  rolesObj[userId] = role;
  saveRoles(rolesObj);
  res.json({ ok: true, userId, role });
});

app.listen(PORT, () => console.log(`Logging server running on http://localhost:${PORT}`));
