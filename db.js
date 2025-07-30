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
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        users JSON DEFAULT "[]",
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nickname VARCHAR(255) NOT NULL,
        api_key VARCHAR(32) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS health_data (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_id INT,
        pulse INT,
        steps INT,
        distance INT,
        calories INT,
        curls INT,
        shoulder_press INT,
        bench_press INT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log("Tables 'groups', 'users', and 'health_data' checked/created.");
    connection.release();
  } catch (err) {
    console.error("MariaDB connection failed:", err.message);
  }
})();

module.exports = pool;
