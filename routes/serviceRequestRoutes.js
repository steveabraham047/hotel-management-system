const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

// ─── GUEST ROUTES (verifyToken + guest role) ─────────────────────────────────

// POST /api/service-requests  — guest submits a request
router.post('/', verifyToken, async (req, res) => {
    if (req.user?.role !== 'Guest') return res.status(403).json({ error: 'Guest access only.' });
    const { category, item, notes, priority } = req.body;
    if (!item) return res.status(400).json({ error: 'Item is required.' });

    try {
        const userId = req.user.id;

        // Find the guest's active booking directly from guests table
        const [rows] = await db.query(
            `SELECT b.booking_id, b.room_id
             FROM bookings b
             WHERE b.guest_id = ? AND b.status = 'Active'
             ORDER BY b.booking_id DESC LIMIT 1`,
            [userId]
        );

        if (!rows.length) {
            return res.status(400).json({ error: 'No active booking. You must be checked-in to request services.' });
        }

        const { booking_id, room_id } = rows[0];

        // guest_id in service_requests stores the user_id (portal user)
        await db.query(
            `INSERT INTO service_requests (booking_id, guest_id, room_id, category, item, notes, priority)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [booking_id, userId, room_id, category || 'General', item, notes || '', priority || 'Normal']
        );

        await db.query(
            'INSERT INTO activity_logs (user_name, role, action, description) VALUES (?,?,?,?)',
            ['Guest', 'Guest', 'Service Request', `Room ${room_id}: "${item}" requested.`]
        ).catch(() => {});

        res.status(201).json({ message: 'Your request has been received! Our staff will attend to you shortly. 🛎️' });
    } catch (error) {
        console.error('Service request error:', error);
        res.status(500).json({ error: 'Could not submit request.' });
    }
});

// GET /api/service-requests/mine  — guest views their own requests
router.get('/mine', verifyToken, async (req, res) => {
    if (req.user?.role !== 'Guest') return res.status(403).json({ error: 'Guest access only.' });
    try {
        const [requests] = await db.query(
            `SELECT sr.request_id, sr.category, sr.item, sr.notes, sr.priority, sr.status,
                    sr.created_at, sr.updated_at, r.room_number
             FROM service_requests sr
             JOIN rooms r ON r.room_id = sr.room_id
             WHERE sr.guest_id = ?
             ORDER BY sr.created_at DESC LIMIT 20`,
            [req.user.id]
        );
        res.json(requests);
    } catch (error) {
        console.error('Fetch my requests error:', error);
        res.status(500).json({ error: 'Could not fetch your requests.' });
    }
});

// ─── STAFF ROUTES ─────────────────────────────────────────────────────────────

// GET /api/service-requests  — staff sees all requests
router.get('/', verifyToken, async (req, res) => {
    try {
        // Join directly to guests table (guest_id in service_requests = portal guest_id)
        const [requests] = await db.query(
            `SELECT sr.*, r.room_number,
                    COALESCE(g.name, CONCAT('Guest #', sr.guest_id)) AS guest_name
             FROM service_requests sr
             JOIN rooms r ON r.room_id = sr.room_id
             LEFT JOIN guests g ON g.guest_id = sr.guest_id
             ORDER BY
               FIELD(sr.status,   'Pending','In Progress','Completed','Cancelled'),
               FIELD(sr.priority, 'High','Normal','Low'),
               sr.created_at DESC
             LIMIT 100`
        );
        res.json(requests);
    } catch (error) {
        console.error('Staff fetch requests error:', error);
        res.status(500).json({ error: 'Could not fetch requests.' });
    }
});

// PATCH /api/service-requests/:id/status  — staff updates status
router.patch('/:id/status', verifyToken, async (req, res) => {
    const { status } = req.body;
    const allowed = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    try {
        await db.query('UPDATE service_requests SET status = ? WHERE request_id = ?', [status, req.params.id]);
        await db.query(
            'INSERT INTO activity_logs (user_name, role, action, description) VALUES (?,?,?,?)',
            [req.user?.name || 'Staff', req.user?.role || 'Staff', 'Service Request Update',
             `Request #${req.params.id} marked as ${status}`]
        ).catch(() => {});
        res.json({ message: `Request marked as ${status}` });
    } catch (error) {
        console.error('Update request status error:', error);
        res.status(500).json({ error: 'Could not update status.' });
    }
});

// ─── ATTRACTIONS (PUBLIC + ADMIN) ─────────────────────────────────────────────

// GET /api/service-requests/attractions  — public
router.get('/attractions', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM nearby_attractions WHERE is_active = 1 ORDER BY distance_km ASC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Fetch attractions error:', error);
        res.status(500).json({ error: 'Could not fetch attractions.' });
    }
});

// POST /api/service-requests/attractions  — admin adds
router.post('/attractions', verifyToken, async (req, res) => {
    const { name, category, description, distance_km, lat, lng } = req.body;
    if (!name || !lat || !lng) return res.status(400).json({ error: 'name, lat and lng are required.' });
    try {
        await db.query(
            'INSERT INTO nearby_attractions (name, category, description, distance_km, lat, lng) VALUES (?,?,?,?,?,?)',
            [name, category || 'Other', description || '', distance_km || 0, lat, lng]
        );
        res.status(201).json({ message: 'Attraction added.' });
    } catch (error) {
        res.status(500).json({ error: 'Could not add attraction.' });
    }
});

// DELETE /api/service-requests/attractions/:id  — admin removes
router.delete('/attractions/:id', verifyToken, async (req, res) => {
    try {
        await db.query('UPDATE nearby_attractions SET is_active = 0 WHERE attraction_id = ?', [req.params.id]);
        res.json({ message: 'Attraction removed.' });
    } catch (error) {
        res.status(500).json({ error: 'Could not remove attraction.' });
    }
});

module.exports = router;
