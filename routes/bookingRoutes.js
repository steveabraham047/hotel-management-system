const express = require('express');
const router = express.Router();
const db = require('../config/db'); 
const { createNotification } = require('./notificationRoutes');
const { createDigitalKey, revokeDigitalKeyForBooking } = require('../controllers/digitalKeyController');
const { setRoomCleaningStatus } = require('../controllers/housekeepingController');
const auditLogger = require('../middleware/auditLogger');

// --- POST /api/bookings: Process a Guest Check-In ---
router.post('/', auditLogger('Check-In Guest'), async (req, res) => {
    const { guest_name, guest_email, guest_phone, room_id, check_in, check_out } = req.body;

    try {
        const [roomCheck] = await db.query('SELECT status FROM rooms WHERE room_id = ?', [room_id]);
        if (roomCheck.length === 0 || (roomCheck[0].status !== 'Available' && roomCheck[0].status !== 'AVAILABLE')) {
            return res.status(400).json({ error: 'Room is currently not available.' });
        }

        const [overlapCheck] = await db.query(
            `SELECT booking_id FROM bookings
             WHERE room_id = ? AND status IN ('Active', 'Pending', 'Confirmed')
             AND NOT (check_out <= ? OR check_in >= ?)`,
            [room_id, check_in, check_out]
        );
        if (overlapCheck.length > 0) {
            return res.status(400).json({ error: 'Room is already reserved for these dates.' });
        }

        const [guestResult] = await db.query(
            'INSERT INTO guests (name, email, phone) VALUES (?, ?, ?)',
            [guest_name, guest_email, guest_phone]
        );
        const newGuestId = guestResult.insertId; 

        const insertBookingQuery = `
            INSERT INTO bookings (guest_id, room_id, check_in, check_out, status)
            VALUES (?, ?, ?, ?, 'Active')
        `;
        const [bookingResult] = await db.query(insertBookingQuery, [newGuestId, room_id, check_in, check_out]);

        await db.query('UPDATE rooms SET status = ? WHERE room_id = ?', ['Occupied', room_id]);
        await createDigitalKey(db, {
            booking_id: bookingResult.insertId,
            guest_id: newGuestId,
            room_id,
            check_out
        });

        // Add to booking history
        await db.query(
            'INSERT INTO booking_history (booking_id, status, notes, created_by) VALUES (?, ?, ?, ?)',
            [bookingResult.insertId, 'Active', 'Guest checked in at front desk', req.user?.name || 'Staff']
        );

        res.status(201).json({ message: 'Check-in successful!' });

        // Auto-fire notification
        createNotification('booking', 'New Check-In', `${guest_name} checked into Room ${room_id}.`, 'login', '/dashboard/guest');
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ error: 'Database transaction failed.' });
    }
});

// --- POST /api/bookings/checkout/:room_id: Process a Guest Checkout & Generate Invoice ---
router.post('/checkout/:room_id', auditLogger('Checkout Guest'), async (req, res) => {
    const { room_id } = req.params;

    try {
        // 1. Find the active booking and room details
        const [activeBooking] = await db.query(`
            SELECT b.booking_id, b.check_in, b.check_out, r.price_per_night 
            FROM bookings b 
            JOIN rooms r ON b.room_id = r.room_id 
            WHERE b.room_id = ? AND b.status = "Active"
            ORDER BY b.booking_id DESC
            LIMIT 1
        `, [room_id]);

        if (activeBooking.length === 0) {
            return res.status(400).json({ error: 'No active booking found for this room.' });
        }

        const booking = activeBooking[0];

        // 2. Fetch Restaurant Charges
        const [foodData] = await db.query(
            "SELECT COALESCE(SUM(total_amount), 0) as food_total FROM restaurant_orders WHERE booking_id = ? AND status = 'Unpaid'", 
            [booking.booking_id]
        );
        const foodTotal = Number(foodData[0].food_total);

        await db.query(`
            CREATE TABLE IF NOT EXISTS booking_addons (
                booking_addon_id INT AUTO_INCREMENT PRIMARY KEY,
                booking_id INT NOT NULL,
                addon_code VARCHAR(80) NOT NULL,
                addon_title VARCHAR(160) NOT NULL,
                addon_price DECIMAL(10,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY idx_booking_addons_booking (booking_id)
            )
        `);
        const [addonData] = await db.query(
            'SELECT COALESCE(SUM(addon_price), 0) as addon_total FROM booking_addons WHERE booking_id = ?',
            [booking.booking_id]
        );
        const addonTotal = Number(addonData[0].addon_total);

        // 3. The Math Engine
        const nights = Math.max(1, Math.ceil((new Date(booking.check_out) - new Date(booking.check_in)) / (1000 * 60 * 60 * 24)));
        const roomSubtotal = nights * booking.price_per_night;
        const roomTax = roomSubtotal * 0.12; 
        const foodTax = foodTotal * 0.05;   
        const grandTotal = roomSubtotal + roomTax + foodTotal + foodTax + addonTotal;

        // 4. Save to YOUR existing Invoices Table!
        const [invoiceResult] = await db.query(`
            INSERT INTO invoices (booking_id, room_total, restaurant_total, grand_total, payment_status) 
            VALUES (?, ?, ?, ?, 'Paid')
        `, [booking.booking_id, (roomSubtotal + roomTax), (foodTotal + foodTax), grandTotal]);

        // Use the auto-generated database ID to create a professional invoice number (e.g., INV-00005)
        const invoiceNo = `INV-${String(invoiceResult.insertId).padStart(5, '0')}`;

        // 5. Clean up the database
        await db.query('UPDATE bookings SET status = "Completed" WHERE booking_id = ?', [booking.booking_id]);
        await db.query('UPDATE restaurant_orders SET status = "Paid" WHERE booking_id = ?', [booking.booking_id]);
        await db.query('UPDATE rooms SET status = "Available" WHERE room_id = ?', [room_id]);
        await revokeDigitalKeyForBooking(db, booking.booking_id);
        await setRoomCleaningStatus(db, room_id, 'Dirty', 'System', 'Auto-marked dirty after checkout.');

        // Add to booking history
        await db.query(
            'INSERT INTO booking_history (booking_id, status, notes, created_by) VALUES (?, ?, ?, ?)',
            [booking.booking_id, 'Completed', `Checked out. Invoice ${invoiceNo} generated.`, req.user?.name || 'Staff']
        );

        // Return the final numbers to the frontend
        res.status(200).json({ 
            message: 'Checkout successful!',
            invoiceData: { invoiceNo, roomSubtotal, foodTotal, addonTotal, taxes: roomTax + foodTax, grandTotal }
        });

        // Auto-fire notification
        createNotification('checkout', 'Guest Checked Out', `Room ${room_id} has been checked out. Invoice ${invoiceNo} generated for ₹${grandTotal.toLocaleString('en-IN')}.`, 'logout', '/dashboard/bookings');

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Database transaction failed during checkout.' });
    }
});

// --- GET /api/bookings/:id/history: Fetch Booking Status Timeline ---
router.get('/:id/history', async (req, res) => {
    try {
        const [history] = await db.query(
            'SELECT * FROM booking_history WHERE booking_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );
        res.status(200).json(history);
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch booking history.' });
    }
});

module.exports = router;
