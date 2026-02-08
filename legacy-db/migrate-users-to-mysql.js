const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function migrate() {
  if (!pool) {
    console.error('No MySQL pool available. Set DB_HOST/DB_USER/DB_PASS/DB_NAME to migrate.');
    process.exit(1);
  }

  const usersFile = path.join(__dirname, '..', 'users.json');
  if (!fs.existsSync(usersFile)) {
    console.error('users.json not found, nothing to migrate.');
    process.exit(1);
  }

  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8') || '[]');
  const conn = await pool.getConnection();
  try {
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const [exists] = await conn.query('SELECT user_id FROM users WHERE user_id = ? LIMIT 1', [u.userId]);
      if (exists.length) continue;

      await conn.query('INSERT INTO users (user_id, username, email, password, created_at) VALUES (?, ?, ?, ?, ?)', [u.userId, u.user, u.email || '', u.pass || '', u.createdAt || new Date()]);

      // First user -> admin
      if (i === 0) {
        await conn.query('INSERT INTO roles (user_id, role) VALUES (?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)', [u.userId, 'admin']);
      }
    }
    console.log('Migration complete');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
