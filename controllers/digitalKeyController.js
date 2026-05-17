const crypto = require('crypto');
const db = require('../config/db');

const ensureDigitalKeyTables = async (executor = db) => {
    await executor.execute(`
        CREATE TABLE IF NOT EXISTS digital_keys (
            digital_key_id INT AUTO_INCREMENT PRIMARY KEY,
            booking_id INT NOT NULL,
            guest_id INT NOT NULL,
            room_id INT NOT NULL,
            access_code VARCHAR(6) NOT NULL,
            qr_payload VARCHAR(255) NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'Active',
            issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            UNIQUE KEY uq_digital_key_booking (booking_id),
            UNIQUE KEY uq_digital_key_code (access_code),
            KEY idx_digital_key_guest (guest_id),
            KEY idx_digital_key_room (room_id)
        )
    `);
};

const makeAccessCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const createDigitalKey = async (executor, booking) => {
    await ensureDigitalKeyTables(executor);

    let accessCode = makeAccessCode();
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const [existing] = await executor.execute(
            `SELECT digital_key_id FROM digital_keys
             WHERE access_code = ? AND status = 'Active' AND expires_at > NOW()
             LIMIT 1`,
            [accessCode]
        );
        if (existing.length === 0) break;
        accessCode = makeAccessCode();
    }

    const qrPayload = `ROOMIFY|booking:${booking.booking_id}|room:${booking.room_id}|code:${accessCode}`;
    await executor.execute(
        `INSERT INTO digital_keys (booking_id, guest_id, room_id, access_code, qr_payload, expires_at, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE
            access_code = VALUES(access_code),
            qr_payload = VALUES(qr_payload),
            expires_at = VALUES(expires_at),
            status = 'Active',
            revoked_at = NULL,
            issued_at = CURRENT_TIMESTAMP`,
        [booking.booking_id, booking.guest_id, booking.room_id, accessCode, qrPayload, booking.check_out]
    );
};

const revokeDigitalKeyForBooking = async (executor, bookingId) => {
    await ensureDigitalKeyTables(executor);
    await executor.execute(
        `UPDATE digital_keys
         SET status = 'Expired', revoked_at = NOW()
         WHERE booking_id = ? AND status = 'Active'`,
        [bookingId]
    );
};

const getGuestDigitalKey = async (req, res) => {
    try {
        await ensureDigitalKeyTables();
        const [keys] = await db.execute(
            `SELECT
                dk.digital_key_id,
                dk.booking_id,
                dk.access_code,
                dk.qr_payload,
                dk.issued_at,
                dk.expires_at,
                dk.status,
                r.room_number,
                r.type AS room_type,
                b.check_in,
                b.check_out
             FROM digital_keys dk
             JOIN bookings b ON b.booking_id = dk.booking_id
             JOIN rooms r ON r.room_id = dk.room_id
             WHERE dk.guest_id = ?
               AND dk.status = 'Active'
               AND dk.expires_at >= NOW()
               AND b.status = 'Active'
             ORDER BY dk.issued_at DESC
             LIMIT 1`,
            [req.user.id]
        );

        res.json({ key: keys[0] || null });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    ensureDigitalKeyTables,
    createDigitalKey,
    revokeDigitalKeyForBooking,
    getGuestDigitalKey
};
