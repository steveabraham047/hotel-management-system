const express = require('express');
const router = express.Router();
const db = require('../config/db');

// --- GET /api/analytics/dashboard: Fetch Real-Time Metrics ---
router.get('/dashboard', async (req, res) => {
    try {
        // 1. Get exact revenue breakdown directly from the new invoices table!
        const [revenueData] = await db.query(`
            SELECT 
                COALESCE(SUM(room_total), 0) AS room_revenue,
                COALESCE(SUM(restaurant_total), 0) AS pos_revenue,
                COALESCE(SUM(grand_total), 0) AS total_revenue
            FROM invoices
            WHERE payment_status = 'Paid'
        `);

        // 2. Get "Currently Hosted" (Guests physically in a room right now)
        const [activeResult] = await db.query(`
            SELECT COUNT(*) AS active_guests
            FROM bookings
            WHERE status = 'Active'
        `);

        // 3. Get "Today's Arrivals" using strict local system date matching
        const [arrivalsResult] = await db.query(`
            SELECT COUNT(*) AS todays_arrivals
            FROM bookings
            WHERE DATE(check_in) = CURDATE()
        `);

        res.status(200).json({
            revenue: Number(revenueData[0].total_revenue),
            roomRevenue: Number(revenueData[0].room_revenue),
            posRevenue: Number(revenueData[0].pos_revenue),
            hosted: activeResult[0].active_guests,
            arrivals: arrivalsResult[0].todays_arrivals
        });

    } catch (error) {
        console.error('Analytics Engine Error:', error);
        res.status(500).json({ error: 'Failed to generate financial report.' });
    }
});

// --- GET /api/analytics/charts: Full chart data for the premium dashboard ---
router.get('/charts', async (req, res) => {
    try {
        // 1. Revenue by day (last 7 days)
        const [revenueByDay] = await db.query(`
            SELECT 
                DATE(i.checkout_time) AS day,
                COALESCE(SUM(i.room_total), 0) AS room_revenue,
                COALESCE(SUM(i.restaurant_total), 0) AS restaurant_revenue,
                COALESCE(SUM(i.grand_total), 0) AS total_revenue
            FROM invoices i
            WHERE i.payment_status = 'Paid'
              AND i.checkout_time >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(i.checkout_time)
            ORDER BY day ASC
        `);

        // Fill in missing days with zeroes
        const revenueTimeline = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const found = revenueByDay.find(r => {
                const rDay = new Date(r.day).toISOString().slice(0, 10);
                return rDay === dateStr;
            });
            revenueTimeline.push({
                day: dateStr,
                label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
                room_revenue: found ? Number(found.room_revenue) : 0,
                restaurant_revenue: found ? Number(found.restaurant_revenue) : 0,
                total_revenue: found ? Number(found.total_revenue) : 0
            });
        }

        // 2. Occupancy trend (last 7 days) — count of active bookings per day
        const [totalRoomsResult] = await db.query('SELECT COUNT(*) AS total FROM rooms');
        const totalRooms = totalRoomsResult[0].total || 1;

        const [occupancyByDay] = await db.query(`
            SELECT 
                dates.day,
                COUNT(b.booking_id) AS occupied
            FROM (
                SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) AS day
                FROM (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) numbers
            ) dates
            LEFT JOIN bookings b ON dates.day BETWEEN DATE(b.check_in) AND DATE(DATE_SUB(b.check_out, INTERVAL 1 DAY))
                AND b.status IN ('Active', 'Completed', 'Confirmed')
            GROUP BY dates.day
            ORDER BY dates.day ASC
        `);

        const occupancyTimeline = occupancyByDay.map(row => ({
            day: new Date(row.day).toISOString().slice(0, 10),
            label: new Date(row.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
            occupied: Number(row.occupied),
            total: totalRooms,
            rate: Math.round((Number(row.occupied) / totalRooms) * 100)
        }));

        // 3. Room type breakdown (current bookings distribution)
        const [roomTypeData] = await db.query(`
            SELECT 
                r.type,
                COUNT(*) AS count,
                SUM(CASE WHEN LOWER(r.status) = 'occupied' THEN 1 ELSE 0 END) AS occupied,
                SUM(CASE WHEN LOWER(r.status) = 'available' THEN 1 ELSE 0 END) AS available,
                SUM(CASE WHEN LOWER(r.status) = 'maintenance' THEN 1 ELSE 0 END) AS maintenance
            FROM rooms r
            GROUP BY r.type
            ORDER BY count DESC
        `);

        // 4. Restaurant top sellers
        // Note: order_items table is not implemented in the current POS logic, so we provide mock data for the demo.
        const topSellers = [
            { name: "Signature Burger", category: "Mains", total_sold: 124, total_revenue: 1860 },
            { name: "Truffle Fries", category: "Sides", total_sold: 98, total_revenue: 784 },
            { name: "Iced Latte", category: "Beverages", total_sold: 156, total_revenue: 780 },
            { name: "Avocado Toast", category: "Breakfast", total_sold: 84, total_revenue: 1008 }
        ];

        // 5. Booking status distribution
        const [bookingStatuses] = await db.query(`
            SELECT 
                status,
                COUNT(*) AS count
            FROM bookings
            GROUP BY status
            ORDER BY count DESC
        `);


        // 6. Recent activity feed (last 15 events)
        const [recentBookings] = await db.query(`
            SELECT 
                b.booking_id,
                g.name AS guest_name,
                r.room_number,
                r.type AS room_type,
                b.status,
                b.check_in,
                b.check_out,
                CASE 
                    WHEN b.status = 'Active' THEN 'check_in'
                    WHEN b.status = 'Completed' THEN 'checkout'
                    WHEN b.status = 'Cancelled' THEN 'cancelled'
                    ELSE 'booking'
                END AS event_type
            FROM bookings b
            JOIN guests g ON b.guest_id = g.guest_id
            JOIN rooms r ON b.room_id = r.room_id
            ORDER BY b.booking_id DESC
            LIMIT 15
        `);

        // 7. Monthly comparison
        const [thisMonth] = await db.query(`
            SELECT COALESCE(SUM(grand_total), 0) AS revenue
            FROM invoices
            WHERE payment_status = 'Paid'
              AND MONTH(checkout_time) = MONTH(CURDATE())
              AND YEAR(checkout_time) = YEAR(CURDATE())
        `);

        const [lastMonth] = await db.query(`
            SELECT COALESCE(SUM(grand_total), 0) AS revenue
            FROM invoices
            WHERE payment_status = 'Paid'
              AND MONTH(checkout_time) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
              AND YEAR(checkout_time) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        `);

        const thisMonthRev = Number(thisMonth[0].revenue);
        const lastMonthRev = Number(lastMonth[0].revenue);
        const growthPercent = lastMonthRev > 0 
            ? Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 100) 
            : (thisMonthRev > 0 ? 100 : 0);

        res.status(200).json({
            revenueTimeline,
            occupancyTimeline,
            roomTypeBreakdown: roomTypeData.map(r => ({
                type: r.type,
                count: Number(r.count),
                occupied: Number(r.occupied),
                available: Number(r.available),
                maintenance: Number(r.maintenance)
            })),
            topSellers: topSellers.map(s => ({
                name: s.name,
                category: s.category,
                totalSold: Number(s.total_sold),
                totalRevenue: Number(s.total_revenue)
            })),
            bookingStatuses: bookingStatuses.map(s => ({
                status: s.status,
                count: Number(s.count)
            })),
            recentActivity: recentBookings,
            monthlyComparison: {
                thisMonth: thisMonthRev,
                lastMonth: lastMonthRev,
                growth: growthPercent
            },
            totalRooms
        });

    } catch (error) {
        console.error('Chart Analytics Error:', error);
        res.status(500).json({ error: 'Failed to generate chart data.' });
    }
});

// --- GET /api/analytics/insights (Guest Segmentation & Forecasting) ---
router.get('/insights', async (req, res) => {
    try {
        // Guest Segmentation — wrap CASE in subquery since MySQL can't GROUP BY alias
        const [segmentation] = await db.query(`
            SELECT segment, COUNT(*) AS count
            FROM (
                SELECT 
                    CASE 
                        WHEN COUNT(b.booking_id) = 1 THEN 'First-time'
                        WHEN COUNT(b.booking_id) > 1 AND COUNT(b.booking_id) < 5 THEN 'Returning'
                        ELSE 'VIP'
                    END AS segment
                FROM guests g
                LEFT JOIN bookings b ON g.guest_id = b.guest_id
                GROUP BY g.guest_id
            ) AS classified
            GROUP BY segment
        `);

        // Revenue Forecasting (Naive: base on active and upcoming bookings * their room rate + 20% addon estimate)
        const [upcomingBookings] = await db.query(`
            SELECT 
                DATE(check_in) as day, 
                SUM(r.price_per_night * 1.2) as expected_revenue 
            FROM bookings b
            JOIN rooms r ON b.room_id = r.room_id
            WHERE b.status IN ('Confirmed', 'Active') 
              AND check_in >= CURDATE()
              AND check_in <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(check_in)
            ORDER BY day ASC
        `);

        res.status(200).json({
            segmentation: segmentation.map(s => ({ segment: s.segment, count: Number(s.count) })),
            forecast: upcomingBookings.map(f => ({ day: f.day, expected_revenue: Number(f.expected_revenue) }))
        });
    } catch (error) {
        console.error('Insights Error:', error);
        res.status(500).json({ error: 'Failed to generate insights.' });
    }
});

// --- GET /api/analytics/logs (Staff Activity Log) ---
router.get('/logs', async (req, res) => {
    try {
        const [logs] = await db.query(`
            SELECT * FROM activity_logs 
            ORDER BY created_at DESC 
            LIMIT 50
        `);
        res.status(200).json(logs);
    } catch (error) {
        console.error('Activity Log Error:', error);
        res.status(500).json({ error: 'Failed to fetch logs.' });
    }
});

// --- GET /api/analytics/export/:type (Data Export - CSV) ---
router.get('/export/:type', async (req, res) => {
    const { type } = req.params;
    let query = '';
    let filename = '';

    if (type === 'bookings') {
        query = `SELECT b.booking_id, g.name AS guest_name, g.email, r.room_number, b.check_in, b.check_out, b.status 
                 FROM bookings b JOIN guests g ON b.guest_id = g.guest_id JOIN rooms r ON b.room_id = r.room_id`;
        filename = 'bookings_export.csv';
    } else if (type === 'invoices') {
        query = `SELECT invoice_id, booking_id, room_total, restaurant_total, grand_total, payment_status, checkout_time 
                 FROM invoices ORDER BY checkout_time DESC`;
        filename = 'invoices_export.csv';
    } else if (type === 'guests') {
        query = `SELECT guest_id, name, email, phone, id_proof FROM guests`;
        filename = 'guests_export.csv';
    } else {
        return res.status(400).json({ error: 'Invalid export type. Use bookings, invoices, or guests.' });
    }

    try {
        const [rows] = await db.query(query);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'No data found to export.' });
        }

        // Generate CSV string
        const header = Object.keys(rows[0]).join(',');
        const csvRows = rows.map(row => 
            Object.values(row).map(val => {
                if (val === null || val === undefined) return '';
                const str = String(val);
                // Escape commas and quotes
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            }).join(',')
        );
        const csvData = [header, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvData);
    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ error: 'Failed to generate export file.' });
    }
});

module.exports = router;