const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const { verifyToken } = require('../middleware/authMiddleware');
const {
    listMenuItems,
    listAllMenuItemsAdmin,
    upsertMenuItem,
    deleteMenuItem,
    updateDiningShowcase
} = require('../controllers/diningController');

const requireAdmin = (req, res, next) => {
    const role = String(req.user?.role || '').toLowerCase();
    if (role !== 'admin') return res.status(403).json({ error: 'Admin access only.' });
    next();
};

// --- POST /api/restaurant/order: Process a POS Order ---
router.post('/order', async (req, res) => {
    const { orderType, selectedRoom, cart, total } = req.body;

    try {
        let bookingId = null;
        let orderStatus = 'Paid'; // Walk-ins pay immediately

        // If it is a room charge, we must find the guest's active booking ID!
        if (orderType === 'room') {
            const [activeBooking] = await db.query(
                `SELECT b.booking_id 
                 FROM bookings b 
                 JOIN rooms r ON b.room_id = r.room_id 
                 WHERE r.room_number = ? AND b.status = 'Active'
                 ORDER BY b.booking_id DESC
                 LIMIT 1`,
                [selectedRoom]
            );

            if (activeBooking.length === 0) {
                return res.status(400).json({ error: 'No active booking found for this room.' });
            }
            
            bookingId = activeBooking[0].booking_id;
            orderStatus = 'Unpaid'; // The guest will pay this during their final hotel checkout
        }

        // Insert the master order into your database
        const [orderResult] = await db.query(
            'INSERT INTO restaurant_orders (booking_id, order_type, total_amount, status) VALUES (?, ?, ?, ?)',
            [bookingId, orderType, total, orderStatus]
        );
        
        // Note: For a production app, you would also loop through the 'cart' array here 
        // and insert every individual burger/coffee into an 'order_items' table!

        res.status(201).json({ message: 'Order processed successfully!' });
    } catch (error) {
        console.error('POS error:', error);
        res.status(500).json({ error: 'Failed to process restaurant order.' });
    }
});
// --- GET /api/restaurant/tab/:room_id: Fetch unpaid restaurant charges ---
router.get('/tab/:room_id', async (req, res) => {
    try {
        const { room_id } = req.params;
        const [result] = await db.query(
            `SELECT COALESCE(SUM(ro.total_amount), 0) as tab_total 
             FROM restaurant_orders ro
             JOIN bookings b ON ro.booking_id = b.booking_id
             WHERE b.room_id = ? AND b.status = 'Active' AND ro.status = 'Unpaid'`,
            [room_id]
        );
        res.status(200).json({ total: Number(result[0].tab_total) });
    } catch (error) {
        console.error('Fetch tab error:', error);
        res.status(500).json({ error: 'Failed to fetch restaurant tab.' });
    }
});

// --- GET /api/restaurant/room-orders: All pending room service orders (for waiter) ---
router.get('/room-orders', verifyToken, async (req, res) => {
    try {
        const [orders] = await db.query(
            `SELECT 
                ro.order_id,
                ro.total_amount,
                ro.status,
                ro.order_type,
                ro.created_at,
                r.room_number,
                g.name AS guest_name,
                g.phone AS guest_phone
             FROM restaurant_orders ro
             JOIN bookings b ON ro.booking_id = b.booking_id
             JOIN rooms r    ON b.room_id = r.room_id
             JOIN guests g   ON b.guest_id = g.guest_id
             WHERE ro.order_type = 'room_service'
               AND ro.status IN ('Unpaid', 'Pending')
             ORDER BY ro.created_at DESC
             LIMIT 50`
        );
        res.json(orders);
    } catch (error) {
        console.error('Fetch room orders error:', error);
        res.status(500).json({ error: 'Failed to fetch room orders.' });
    }
});

// --- PATCH /api/restaurant/room-orders/:id/serve: Mark order as served ---
router.patch('/room-orders/:id/serve', verifyToken, async (req, res) => {
    try {
        // Keep status 'Unpaid' so it gets added to the room bill at checkout
        // Just add a 'served_at' timestamp concept via a note update
        // We update order_type to 'room_service_served' to differentiate
        await db.query(
            `UPDATE restaurant_orders SET status = 'Unpaid', order_type = 'room_service_served' WHERE order_id = ?`,
            [req.params.id]
        );
        res.json({ message: 'Order marked as served. Charge added to room bill.' });
    } catch (error) {
        console.error('Serve order error:', error);
        res.status(500).json({ error: 'Failed to update order.' });
    }
});

// --- MENU ENDPOINTS FOR POS / PREVIEW ---
router.get('/menu', listMenuItems);

router.get('/menu/admin', verifyToken, requireAdmin, listAllMenuItemsAdmin);
router.post('/menu/admin', verifyToken, requireAdmin, upsertMenuItem);
router.put('/menu/admin/:id', verifyToken, requireAdmin, (req, res, next) => {
    req.body = { ...req.body, menu_item_id: Number(req.params.id) };
    next();
}, upsertMenuItem);
router.delete('/menu/admin/:id', verifyToken, requireAdmin, deleteMenuItem);

router.put('/highlights', verifyToken, requireAdmin, updateDiningShowcase);

module.exports = router;
