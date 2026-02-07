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
app.use(express.static(__dirname));

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
app.get('/logs', (req, res) => {
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
app.post('/clear-logs', (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(PORT, () => console.log(`Logging server running on http://localhost:${PORT}`));
