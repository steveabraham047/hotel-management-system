const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Ensure notifications table exists
const ensureNotificationsTable = async () => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS notifications (
            notification_id INT AUTO_INCREMENT PRIMARY KEY,
            type VARCHAR(50) NOT NULL DEFAULT 'info',
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            icon VARCHAR(50) DEFAULT 'notifications',
            is_read TINYINT(1) DEFAULT 0,
            action_url VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notifications_read (is_read),
            INDEX idx_notifications_created (created_at)
        )
    `);
};

// Helper: Create a notification
const createNotification = async (type, title, message, icon = 'notifications', actionUrl = null) => {
    try {
        await ensureNotificationsTable();
        await db.execute(
            `INSERT INTO notifications (type, title, message, icon, action_url) VALUES (?, ?, ?, ?, ?)`,
            [type, title, message, icon, actionUrl]
        );
    } catch (error) {
        console.error('Failed to create notification:', error.message);
    }
};

// --- GET /api/notifications: Fetch all notifications ---
router.get('/', async (req, res) => {
    try {
        await ensureNotificationsTable();
        const [notifications] = await db.query(`
            SELECT * FROM notifications
            ORDER BY created_at DESC
            LIMIT 50
        `);
        const [unreadCount] = await db.query(`
            SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0
        `);
        res.json({
            notifications,
            unreadCount: unreadCount[0].count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- PUT /api/notifications/read-all: Mark all as read ---
router.put('/read-all', async (req, res) => {
    try {
        await ensureNotificationsTable();
        await db.execute('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
        res.json({ message: 'All notifications marked as read.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- PUT /api/notifications/:id/read: Mark one as read ---
router.put('/:id/read', async (req, res) => {
    try {
        await ensureNotificationsTable();
        await db.execute('UPDATE notifications SET is_read = 1 WHERE notification_id = ?', [req.params.id]);
        res.json({ message: 'Notification marked as read.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DELETE /api/notifications/clear: Clear all notifications ---
router.delete('/clear', async (req, res) => {
    try {
        await ensureNotificationsTable();
        await db.execute('DELETE FROM notifications');
        res.json({ message: 'All notifications cleared.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- POST /api/notifications/seed: Generate sample notifications for demo ---
router.post('/seed', async (req, res) => {
    try {
        await ensureNotificationsTable();

        // Check current occupancy for smart alerts
        const [rooms] = await db.query('SELECT COUNT(*) AS total FROM rooms');
        const [occupied] = await db.query("SELECT COUNT(*) AS count FROM rooms WHERE LOWER(status) = 'occupied'");
        const totalRooms = rooms[0].total || 1;
        const occupiedCount = occupied[0].count || 0;
        const occupancyRate = Math.round((occupiedCount / totalRooms) * 100);

        // Get recent bookings for realistic notifications
        const [recentBookings] = await db.query(`
            SELECT g.name, r.room_number, b.status, b.check_in
            FROM bookings b
            JOIN guests g ON b.guest_id = g.guest_id
            JOIN rooms r ON b.room_id = r.room_id
            ORDER BY b.booking_id DESC
            LIMIT 5
        `);

        const notifications = [];
        
        for (const booking of recentBookings) {
            if (booking.status === 'Active') {
                notifications.push({
                    type: 'booking',
                    title: 'Guest Checked In',
                    message: `${booking.name} has checked into Room ${booking.room_number}.`,
                    icon: 'login',
                    action_url: '/dashboard/guest'
                });
            } else if (booking.status === 'Completed') {
                notifications.push({
                    type: 'checkout',
                    title: 'Guest Checked Out',
                    message: `${booking.name} has checked out of Room ${booking.room_number}. Invoice generated.`,
                    icon: 'logout',
                    action_url: '/dashboard/bookings'
                });
            }
        }

        // Occupancy alert
        if (occupancyRate < 30) {
            notifications.push({
                type: 'alert',
                title: 'Low Occupancy Alert',
                message: `Current occupancy is only ${occupancyRate}%. Consider running promotions to boost bookings.`,
                icon: 'warning',
                action_url: '/dashboard/promos'
            });
        } else if (occupancyRate > 85) {
            notifications.push({
                type: 'success',
                title: 'High Demand!',
                message: `Occupancy at ${occupancyRate}%. Consider dynamic pricing to maximize revenue.`,
                icon: 'trending_up',
                action_url: '/dashboard'
            });
        }

        // System notification
        notifications.push({
            type: 'system',
            title: 'System Health Check',
            message: 'All hotel systems are operational. Database synced successfully.',
            icon: 'check_circle',
            action_url: null
        });

        // Insert notifications
        for (const n of notifications) {
            await db.execute(
                `INSERT INTO notifications (type, title, message, icon, action_url) VALUES (?, ?, ?, ?, ?)`,
                [n.type, n.title, n.message, n.icon, n.action_url]
            );
        }

        res.json({ message: `${notifications.length} notifications generated.`, count: notifications.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
module.exports.createNotification = createNotification;
