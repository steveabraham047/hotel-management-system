const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./config/db');

async function run() {
    try {
        // Service Requests table for in-room service
        await db.query(`
            CREATE TABLE IF NOT EXISTS service_requests (
                request_id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT NOT NULL,
                guest_id   INT NOT NULL,
                room_id    INT NOT NULL,
                category   VARCHAR(80)  NOT NULL DEFAULT 'General',
                item       VARCHAR(200) NOT NULL,
                notes      TEXT,
                status     ENUM('Pending','In Progress','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
                priority   ENUM('Low','Normal','High') NOT NULL DEFAULT 'Normal',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_sr_booking (booking_id),
                KEY idx_sr_status (status)
            )
        `);

        // Nearby attractions curated by admin
        await db.query(`
            CREATE TABLE IF NOT EXISTS nearby_attractions (
                attraction_id INT AUTO_INCREMENT PRIMARY KEY,
                name          VARCHAR(200) NOT NULL,
                category      ENUM('Restaurant','Temple','Mall','Park','Museum','Hospital','Other') DEFAULT 'Other',
                description   TEXT,
                distance_km   DECIMAL(5,2) DEFAULT 0,
                lat           DECIMAL(10,8) NOT NULL,
                lng           DECIMAL(11,8) NOT NULL,
                is_active     TINYINT(1) DEFAULT 1,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Seed with sample attractions near a typical Indian hotel
        const [existing] = await db.query('SELECT COUNT(*) as cnt FROM nearby_attractions');
        if (existing[0].cnt === 0) {
            await db.query(`
                INSERT INTO nearby_attractions (name, category, description, distance_km, lat, lng) VALUES
                ('Spice Route Restaurant', 'Restaurant', 'Award-winning pan-Indian cuisine with live music every evening.', 0.4, 12.9716, 77.5946),
                ('The Grand Buffet', 'Restaurant', 'Unlimited continental & Indian buffet. Perfect for family dining.', 0.8, 12.9720, 77.5960),
                ('Ganesh Temple', 'Temple', '200-year-old landmark temple. Open 6am–8pm daily.', 1.1, 12.9700, 77.5920),
                ('City Central Mall', 'Mall', 'Premium shopping with 250+ brands, multiplex & food court.', 1.5, 12.9740, 77.5970),
                ('Lalbagh Botanical Garden', 'Park', 'Sprawling 240-acre garden perfect for morning walks.', 2.2, 12.9650, 77.5850),
                ('National Handicrafts Museum', 'Museum', 'Explore rich textile and craft heritage.', 2.8, 12.9680, 77.5900),
                ('Apollo Hospital', 'Hospital', '24/7 multispecialty hospital. Emergency: 1066', 1.9, 12.9730, 77.5980),
                ('Brigade Road Market', 'Mall', 'Street shopping hub with local brands, cafes and bakeries.', 1.2, 12.9710, 77.5955)
            `);
            console.log('Seeded nearby_attractions table.');
        }

        console.log('All tables created successfully.');
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
