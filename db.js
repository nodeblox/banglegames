const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Testverbindung und Tabellenerstellung
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("MariaDB connection successful!");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name TEXT,
        password TEXT
      )
    `);

    console.log("Table 'groups' checked/created.");
    connection.release();
  } catch (err) {
    console.error("MariaDB connection failed:", err.message);
  }
})();

module.exports = pool;
