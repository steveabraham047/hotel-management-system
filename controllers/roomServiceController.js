// File: controllers/roomServiceController.js
const db = require('../config/db');
const { ensureDiningTables } = require('./diningController');

// 1. Get the restaurant menu for guests (active items only)
const getGuestMenu = async (_req, res) => {
    try {
        await ensureDiningTables();
        const [items] = await db.execute(
            `SELECT item_id AS menu_item_id, name, category, price, image_url, description, is_bestseller, is_chef_pick
             FROM menu_items
             WHERE is_active = 1
             ORDER BY is_bestseller DESC, category ASC, name ASC`
        );
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Place a room service order (guest must have an active booking)
const placeRoomServiceOrder = async (req, res) => {
    const guestId = req.user.id;
    const { items } = req.body; // [{ menu_item_id, quantity }]

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Please add at least one item to your order.' });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();
        await ensureDiningTables();

        // Find the guest's active booking
        const [activeBookings] = await connection.execute(
            `SELECT booking_id, room_id FROM bookings WHERE guest_id = ? AND status = 'Active' LIMIT 1`,
            [guestId]
        );

        if (activeBookings.length === 0) {
            throw new Error('You must have an active booking (checked-in) to order room service.');
        }

        const bookingId = activeBookings[0].booking_id;

        // Fetch prices for all requested items
        const itemIds = items.map(i => i.menu_item_id);
        const placeholders = itemIds.map(() => '?').join(',');
        const [menuItems] = await connection.execute(
            `SELECT item_id, name, price FROM menu_items WHERE item_id IN (${placeholders}) AND is_active = 1`,
            itemIds
        );

        if (menuItems.length !== itemIds.length) {
            throw new Error('One or more items are no longer available.');
        }

        const priceMap = {};
        for (const mi of menuItems) {
            priceMap[mi.item_id] = { name: mi.name, price: Number(mi.price) };
        }

        // Calculate total
        let totalAmount = 0;
        const orderItems = [];
        for (const item of items) {
            const menuItem = priceMap[item.menu_item_id];
            if (!menuItem) throw new Error(`Item ${item.menu_item_id} not found.`);
            const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
            const lineTotal = menuItem.price * qty;
            totalAmount += lineTotal;
            orderItems.push({ ...menuItem, quantity: qty, line_total: lineTotal });
        }

        // Insert the restaurant order with item details as JSON note
        const itemSummary = orderItems.map(i => `${i.quantity}x ${i.name}`).join(', ');
        const [orderResult] = await connection.execute(
            `INSERT INTO restaurant_orders (booking_id, order_type, total_amount, status, notes)
             VALUES (?, 'room_service', ?, 'Unpaid', ?)`,
            [bookingId, totalAmount, itemSummary]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Room service order placed successfully! 🍽️ Our team will bring it to your room.',
            order_id: orderResult.insertId,
            items: orderItems,
            total: totalAmount
        });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
};

// 3. Get the guest's room service orders for their active booking
const getGuestOrders = async (req, res) => {
    const guestId = req.user.id;

    try {
        const [orders] = await db.execute(
            `SELECT ro.order_id, ro.total_amount, ro.status, ro.order_type,
                    b.room_id, r.room_number
             FROM restaurant_orders ro
             JOIN bookings b ON ro.booking_id = b.booking_id
             JOIN rooms r ON b.room_id = r.room_id
             WHERE b.guest_id = ? AND b.status = 'Active'
             ORDER BY ro.order_id DESC`,
            [guestId]
        );

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getGuestMenu, placeRoomServiceOrder, getGuestOrders };
