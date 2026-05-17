const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize App
const app = express();

// Import Database connection
const db = require('./config/db');

// 1. IMPORT ALL ROUTES (Grouped cleanly together)
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes'); 
const bookingRoutes = require('./routes/bookingRoutes'); 
const restaurantRoutes = require('./routes/restaurantRoutes');
const hallRoutes = require('./routes/hallRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const guestRoutes = require('./routes/guestRoutes');
const guestAuthRoutes = require('./routes/guestAuthRoutes');
const userRoutes = require('./routes/userRoutes');
const publicRoutes = require('./routes/publicRoutes');
const promoRoutes = require('./routes/promoRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const housekeepingRoutes = require('./routes/housekeepingRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');

// 2. MIDDLEWARE
app.use(cors()); 
app.use(express.json());

// 3. USE ROUTES (No duplicates!)
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes); 
app.use('/api/bookings', bookingRoutes); 
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/halls', hallRoutes);   
app.use('/api/invoices', invoiceRoutes); 
app.use('/api/analytics', analyticsRoutes); 
app.use('/api/guests', guestRoutes);
app.use('/api/guest-auth', guestAuthRoutes);
app.use('/api/user', userRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/service-requests', serviceRequestRoutes);

// Basic Test Route
app.get('/', (req, res) => {
    res.send('Hotel Management API is running...');
});

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ ERROR: Port ${PORT} is already in use.`);
        console.error(`   Run: netstat -ano | findstr ":${PORT}" to find the PID`);
        console.error(`   Then: Stop-Process -Id <PID> -Force\n`);
    } else {
        console.error('Server error:', err);
    }
    process.exit(1);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 Unhandled Rejection:', reason);
    process.exit(1);
});
