const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
    getHousekeepingRooms,
    updateHousekeepingStatus,
    getHousekeepingHistory
} = require('../controllers/housekeepingController');

const allowOps = (req, res, next) => {
    if (!['Admin', 'Manager', 'Receptionist'].includes(req.user?.role)) {
        return res.status(403).json({ error: 'Housekeeping access requires operations staff.' });
    }
    next();
};

router.use(verifyToken);
router.use(allowOps);

router.get('/rooms', getHousekeepingRooms);
router.post('/rooms/:room_id/status', updateHousekeepingStatus);
router.get('/rooms/:room_id/history', getHousekeepingHistory);

module.exports = router;
