//2 - Invocamos a MySQL y realizamos la conexion
const mysql = require('mysql2');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || process.env.DB_PASS,
  database: process.env.DB_NAME || process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  stringifyObjects: true,
  multipleStatements: true,
  dateStrings: 'DATETIME',
  connectionLimit: 4,
  debug: false,
  connectTimeout: 60000,
  waitForConnections: true,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

pool.on('connection', (conn) => {
  console.log('MySQL pool connected to thread id', conn.threadId);

  conn.on('error', (err) => {
    console.error('[MySQL] connection error', err);

    if (err && err.fatal) {
      console.error('[MySQL] fatal connection error. The connection will be released.');
    }
  });
});

pool.on('enqueue', () => {
  console.warn('[MySQL] Waiting for available connection slot');
});

pool.on('error', (err) => {
  console.error('[MySQL] pool error', err);
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('[MySQL] initial connection failed', err);
    return;
  }

  console.log('Database connected successfully');
  connection.release();
});

module.exports = pool;
