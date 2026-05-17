const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
    getGuestProfile,
    updateGuestProfile,
    changeGuestPassword,
    getGuestMembership,
    getAvailableRooms,
    getGuestBookings,
    getGuestInvoices,
    getGuestPreferences,
    updateGuestPreferences,
    toggleSavedRoom,
    toggleSavedOffer,
    cancelGuestBooking,
    rebookGuestBooking,
    createGuestBooking
} = require('../controllers/userController');
const { getGuestMenu, placeRoomServiceOrder, getGuestOrders } = require('../controllers/roomServiceController');
const { getGuestDigitalKey } = require('../controllers/digitalKeyController');
const { getEligibleReviews, submitGuestReview } = require('../controllers/reviewController');

const verifyGuest = (req, res, next) => {
    if (req.user?.role !== 'Guest' || req.user?.type !== 'guest') {
        return res.status(403).json({ error: 'Guest access only.' });
    }

    next();
};

router.use(verifyToken);
router.use(verifyGuest);

router.get('/profile', getGuestProfile);
router.put('/profile', updateGuestProfile);
router.put('/password', changeGuestPassword);
router.get('/membership', getGuestMembership);
router.get('/rooms/available', getAvailableRooms);
router.get('/bookings', getGuestBookings);
router.post('/bookings', createGuestBooking);
router.post('/bookings/:booking_id/cancel', cancelGuestBooking);
router.post('/bookings/:booking_id/rebook', rebookGuestBooking);
router.get('/invoices', getGuestInvoices);
router.get('/digital-key', getGuestDigitalKey);
router.get('/reviews/eligible', getEligibleReviews);
router.post('/reviews', submitGuestReview);
router.get('/preferences', getGuestPreferences);
router.put('/preferences', updateGuestPreferences);
router.post('/saved-rooms/toggle', toggleSavedRoom);
router.post('/saved-offers/toggle', toggleSavedOffer);

// Room Service
router.get('/menu', getGuestMenu);
router.post('/room-service', placeRoomServiceOrder);
router.get('/room-service/orders', getGuestOrders);

module.exports = router;
