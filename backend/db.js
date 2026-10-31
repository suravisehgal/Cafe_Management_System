// ================================================================
// ☕ Velvet & Bean Café Management System — Database Connection Pool
// MySQL 8.0 Connection Pool via mysql2/promise
// ================================================================

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');

// Layman Explanation:
// Database connection configuration.
// Tells Node.js where MySQL is running, what username/password to use,
// and which database schema to connect to.
const poolConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'cafe_management',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  decimalNumbers: true
};

// Only attach password if a password was actually specified
if (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim() !== '') {
  poolConfig.password = process.env.DB_PASSWORD;
}

// On macOS, Homebrew MySQL communicates fastest and most reliably over a local Unix domain socket (/tmp/mysql.sock)
if (process.env.DB_SOCKET) {
  poolConfig.socketPath = process.env.DB_SOCKET;
} else if (process.platform === 'darwin' && fs.existsSync('/tmp/mysql.sock')) {
  poolConfig.socketPath = '/tmp/mysql.sock';
}

const pool = mysql.createPool(poolConfig);

/**
 * Execute a parameterized SQL query
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<Array>}
 */
async function query(sql, params = []) {
  const [results] = await pool.query(sql, params);
  return results;
}

/**
 * Test database connectivity
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS health_check');
    return { ok: true, message: 'MySQL Database connected successfully' };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

module.exports = {
  pool,
  query,
  testConnection
};
