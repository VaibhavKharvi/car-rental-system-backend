const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  cancelBooking,
  payBooking,
  getBookingById,
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');

// All booking routes are protected
router.use(protect);

router.post('/', createBooking);
router.get('/mine', getMyBookings);
router.get('/:id', getBookingById);
router.put('/:id/cancel', cancelBooking);
router.put('/:id/pay', payBooking);

module.exports = router;
