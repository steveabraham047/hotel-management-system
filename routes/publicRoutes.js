const express = require('express');
const router = express.Router();
const { getPublicRooms, getPublicOffers } = require('../controllers/publicController');
const { getDiningShowcase } = require('../controllers/diningController');
const { getPublicReviews } = require('../controllers/reviewController');

router.get('/rooms', getPublicRooms);
router.get('/offers', getPublicOffers);
router.get('/dining', getDiningShowcase);
router.get('/reviews', getPublicReviews);

module.exports = router;
