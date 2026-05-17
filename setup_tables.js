require('dotenv').config();
const db = require('./config/db');
async function setup() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS activity_logs (
      log_id INT AUTO_INCREMENT PRIMARY KEY,
      user_name VARCHAR(100),
      role VARCHAR(50),
      action VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    await db.query(`CREATE TABLE IF NOT EXISTS booking_history (
      history_id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      status VARCHAR(50) NOT NULL,
      notes TEXT,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
    )`);
    console.log('Tables created successfully.');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
setup();
