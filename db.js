const mysql = require('mysql2/promise');

let pool = null;

// Accept either DB_* env vars or Railway's MYSQL* vars (and MYSQL_URL)
function getDbConfigFromEnv() {
  // If a full URL is provided (Railway exposes MYSQL_URL), parse it
  const mysqlUrl = process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;
  if (mysqlUrl) {
    try {
      const parsed = new URL(mysqlUrl);
      return {
        host: parsed.hostname,
        user: parsed.username || process.env.MYSQLUSER || process.env.DB_USER,
        password: parsed.password || process.env.MYSQLPASSWORD || process.env.DB_PASS,
        database: (parsed.pathname || '').replace(/^\//, '') || process.env.MYSQLDATABASE || process.env.DB_NAME,
        port: parsed.port ? Number(parsed.port) : (process.env.MYSQLPORT || process.env.DB_PORT || 3306)
      };
    } catch (e) {
      // fallthrough
    }
  }

  return {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER,
    password: process.env.DB_PASS || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : (process.env.MYSQLPORT ? Number(process.env.MYSQLPORT) : 3306)
  };
}

const cfg = getDbConfigFromEnv();
if (cfg.host && cfg.user && cfg.password && cfg.database) {
  pool = mysql.createPool({
    host: cfg.host,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    port: cfg.port,
    waitForConnections: true,
    connectionLimit: 10,
  });
  console.log('MySQL pool created', { host: cfg.host, database: cfg.database, port: cfg.port });
} else {
  console.log('MySQL not configured - using file fallback');
}

module.exports = { pool };
