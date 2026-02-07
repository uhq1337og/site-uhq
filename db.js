const mysql = require('mysql2/promise');

let pool = null;

if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASS && process.env.DB_NAME) {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
  });
  console.log('MySQL pool created');
} else {
  console.log('MySQL not configured - using file fallback');
}

module.exports = { pool };
