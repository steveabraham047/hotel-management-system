const mysql = require("mysql2/promise");

const connectionConfig = process.env.MYSQL_PUBLIC_URL
  ? process.env.MYSQL_PUBLIC_URL
  : {
      host: process.env.MYSQLHOST || process.env.DB_HOST,
      user: process.env.MYSQLUSER || process.env.DB_USER,
      password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
      database: process.env.MYSQLDATABASE || process.env.DB_NAME,
      port: Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306)
    };

const db = mysql.createPool({
  uri: typeof connectionConfig === "string" ? connectionConfig : undefined,
  ...(typeof connectionConfig === "string" ? {} : connectionConfig),
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = db;
