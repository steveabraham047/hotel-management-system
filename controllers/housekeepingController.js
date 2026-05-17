const db = require('../config/db');

const allowedStatuses = new Set(['Clean', 'Dirty', 'In-Progress']);

const ensureHousekeepingTables = async (executor = db) => {
    await executor.execute(`
        CREATE TABLE IF NOT EXISTS room_housekeeping (
            room_id INT PRIMARY KEY,
            cleaning_status VARCHAR(24) NOT NULL DEFAULT 'Clean',
            assigned_to VARCHAR(120) NULL,
            last_cleaned_at DATETIME NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    await executor.execute(`
        CREATE TABLE IF NOT EXISTS housekeeping_history (
            history_id INT AUTO_INCREMENT PRIMARY KEY,
            room_id INT NOT NULL,
            status VARCHAR(24) NOT NULL,
            staff_name VARCHAR(120) NULL,
            note VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_housekeeping_room (room_id)
        )
    `);

    await executor.execute(`
        INSERT IGNORE INTO room_housekeeping (room_id, cleaning_status)
        SELECT room_id, 'Clean' FROM rooms
    `);
};

const setRoomCleaningStatus = async (executor, roomId, status, staffName = 'System', note = null) => {
    if (!allowedStatuses.has(status)) {
        throw new Error('Invalid cleaning status.');
    }

    await ensureHousekeepingTables(executor);
    const lastCleanedAt = status === 'Clean' ? 'NOW()' : 'last_cleaned_at';
    await executor.execute(
        `INSERT INTO room_housekeeping (room_id, cleaning_status, assigned_to, last_cleaned_at)
         VALUES (?, ?, ?, ${status === 'Clean' ? 'NOW()' : 'NULL'})
         ON DUPLICATE KEY UPDATE
            cleaning_status = VALUES(cleaning_status),
            assigned_to = VALUES(assigned_to),
            last_cleaned_at = ${lastCleanedAt}`,
        [roomId, status, staffName]
    );

    await executor.execute(
        `INSERT INTO housekeeping_history (room_id, status, staff_name, note)
         VALUES (?, ?, ?, ?)`,
        [roomId, status, staffName, note]
    );
};

const getHousekeepingRooms = async (req, res) => {
    try {
        await ensureHousekeepingTables();
        const [rooms] = await db.execute(
            `SELECT
                r.room_id,
                r.room_number,
                r.type,
                r.status AS room_status,
                hk.cleaning_status,
                hk.assigned_to,
                hk.last_cleaned_at,
                hk.updated_at,
                (
                    SELECT COUNT(*)
                    FROM housekeeping_history h
                    WHERE h.room_id = r.room_id
                ) AS history_count
             FROM rooms r
             LEFT JOIN room_housekeeping hk ON hk.room_id = r.room_id
             ORDER BY
                FIELD(COALESCE(hk.cleaning_status, 'Clean'), 'Dirty', 'In-Progress', 'Clean'),
                CAST(r.room_number AS UNSIGNED),
                r.room_number`
        );

        res.json(rooms);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateHousekeepingStatus = async (req, res) => {
    const { room_id } = req.params;
    const { status, note } = req.body;
    const staffName = req.user?.role || 'Staff';

    try {
        await setRoomCleaningStatus(db, room_id, status, staffName, note || null);
        res.json({ message: `Room ${room_id} marked ${status}.` });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getHousekeepingHistory = async (req, res) => {
    const { room_id } = req.params;

    try {
        await ensureHousekeepingTables();
        const [history] = await db.execute(
            `SELECT history_id, room_id, status, staff_name, note, created_at
             FROM housekeeping_history
             WHERE room_id = ?
             ORDER BY created_at DESC
             LIMIT 25`,
            [room_id]
        );

        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    ensureHousekeepingTables,
    setRoomCleaningStatus,
    getHousekeepingRooms,
    updateHousekeepingStatus,
    getHousekeepingHistory
};
