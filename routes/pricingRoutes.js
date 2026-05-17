const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getPricingDashboard, updatePricingRules } = require('../controllers/pricingController');

const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'Admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
};

router.use(verifyToken);
router.use(adminOnly);

router.get('/', getPricingDashboard);
router.put('/rules', updatePricingRules);

module.exports = router;
