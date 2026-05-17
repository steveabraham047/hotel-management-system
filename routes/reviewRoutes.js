const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getAdminReviews, moderateReview } = require('../controllers/reviewController');

const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'Admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
};

router.use(verifyToken);
router.use(adminOnly);

router.get('/', getAdminReviews);
router.patch('/:review_id', moderateReview);

module.exports = router;
