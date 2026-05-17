const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../config/db');

const ignoreCodes = new Set([
  'ER_DUP_FIELDNAME',
  'ER_DUP_KEYNAME',
  'ER_CANT_DROP_FIELD_OR_KEY'
]);

const statementsFrom = (sql) =>
  sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement && !statement.startsWith('--'));

const runStatements = async (label, statements) => {
  console.log(`Running ${label}...`);

  for (const statement of statements) {
    try {
      await db.query(statement);
    } catch (error) {
      if (!ignoreCodes.has(error.code)) {
        console.error(`Failed while running ${label}:`);
        console.error(statement);
        throw error;
      }

      console.log(`Skipped already-applied change (${error.code}).`);
    }
  }
};

const baseSchema = [
  `CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS guests (
    guest_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NULL,
    phone VARCHAR(30) NULL,
    id_proof VARCHAR(120) NULL,
    password_hash VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_guests_email (email)
  )`,

  `CREATE TABLE IF NOT EXISTS rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL UNIQUE,
    type VARCHAR(80) NOT NULL,
    price_per_night DECIMAL(10,2) NOT NULL,
    status ENUM('Available','Occupied','Maintenance') NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT NOT NULL,
    room_id INT NOT NULL,
    check_in DATE NOT NULL,
    check_out DATE NOT NULL,
    status ENUM('Pending','Confirmed','Active','Completed','Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_bookings_guest (guest_id),
    KEY idx_bookings_room (room_id)
  )`,

  `CREATE TABLE IF NOT EXISTS restaurant_orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    table_number VARCHAR(20) NULL,
    order_type VARCHAR(40) NOT NULL DEFAULT 'restaurant',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'Unpaid',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_restaurant_booking (booking_id)
  )`,

  `CREATE TABLE IF NOT EXISTS hall_bookings (
    hall_booking_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    event_date DATE NOT NULL,
    time_slot VARCHAR(80) NOT NULL,
    flat_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(40) NOT NULL DEFAULT 'Confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_hall_booking (booking_id)
  )`,

  `CREATE TABLE IF NOT EXISTS invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    room_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    restaurant_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    hall_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(40) NOT NULL DEFAULT 'Unpaid',
    checkout_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_invoice_booking (booking_id)
  )`,

  `CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(60) NOT NULL DEFAULT 'info',
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    icon VARCHAR(80) NULL,
    action_url VARCHAR(255) NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100),
    role VARCHAR(50),
    action VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS booking_history (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_booking_history_booking (booking_id)
  )`
];

const seedRooms = [
  ['101', 'Deluxe', 4500, 'Available'],
  ['102', 'Deluxe', 4500, 'Available'],
  ['201', 'Premium Suite', 7800, 'Available'],
  ['202', 'Premium Suite', 7800, 'Available'],
  ['301', 'Executive', 6200, 'Available']
];

const seedBaseData = async () => {
  for (const room of seedRooms) {
    await db.query(
      `INSERT INTO rooms (room_number, type, price_per_night, status)
       SELECT ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE room_number = ?)`,
      [...room, room[0]]
    );
  }
};

const run = async () => {
  await runStatements('base schema', baseSchema);

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await runStatements(file, statementsFrom(sql));
  }

  await runStatements('new feature tables', [
    `CREATE TABLE IF NOT EXISTS service_requests (
      request_id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      guest_id INT NOT NULL,
      room_id INT NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      item VARCHAR(200) NOT NULL,
      notes TEXT,
      status ENUM('Pending','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
      priority ENUM('Low','Normal','High') NOT NULL DEFAULT 'Normal',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_sr_booking (booking_id),
      KEY idx_sr_status (status)
    )`,
    `CREATE TABLE IF NOT EXISTS nearby_attractions (
      attraction_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category ENUM('Restaurant','Temple','Mall','Park','Museum','Hospital','Other') DEFAULT 'Other',
      description TEXT,
      distance_km DECIMAL(5,2) DEFAULT 0,
      lat DECIMAL(10,8) NOT NULL,
      lng DECIMAL(11,8) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ]);

  await seedBaseData();
  console.log('Database initialized successfully.');
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.code || error.message);
    console.error(error.message);
    process.exit(1);
  });
