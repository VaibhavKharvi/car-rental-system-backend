const express = require('express');
const router = express.Router();
const {
  getCars,
  getCarById,
  getRecommendations,
  getCarPrice,
  addReview,
  getCarReviews,
} = require('../controllers/carController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/', getCars);
router.get('/recommendations', protect, getRecommendations); // Must be before /:id to avoid conflict
router.get('/:id', getCarById);
router.get('/:id/price', getCarPrice);
router.get('/:id/reviews', getCarReviews);

// Protected routes
router.post('/:id/reviews', protect, addReview);

module.exports = router;
