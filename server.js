const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB before rotation

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

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
const ROLES_FILE = path.join(__dirname, 'roles.json');

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

// GET user's current role
app.get('/api/user/:userId/role', (req, res) => {
  const { userId } = req.params;
  const roles = loadRoles();
  res.json({ role: roles[userId] || 'user' });
});

// POST to change user role (admin only)
app.post('/api/user/:userId/role', requireAuth, (req, res) => {
  const { role } = req.body;
  const { userId } = req.params;
  
  if (!['admin', 'moderator', 'user'].includes(role)) {
    return res.status(400).json({ ok: false, error: 'Invalid role' });
  }
  
  const roles = loadRoles();
  roles[userId] = role;
  saveRoles(roles);
  
  res.json({ ok: true, userId, role });
});

app.listen(PORT, () => console.log(`Logging server running on http://localhost:${PORT}`));
