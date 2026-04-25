const express = require('express');
const router = express.Router();
const {
  addCar,
  updateCar,
  deleteCar,
  getAllCarsAdmin,
  getAllBookings,
  updateBookingAdmin,
  getAllUsers,
  getUserAdmin,
  updateUserAdmin,
  getDashboardStats,
  getReports,
  getSettings,
  updateSettings,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require valid JWT + admin role
router.use(protect, authorize('admin'));

// ─── Cars ─────────────────────────────────────────────────────────────────────
router.route('/cars')
  .get(getAllCarsAdmin)
  .post(addCar);

router.route('/cars/:id')
  .put(updateCar)
  .delete(deleteCar);

// ─── Bookings ─────────────────────────────────────────────────────────────────
router.route('/bookings')
  .get(getAllBookings);

router.route('/bookings/:id')
  .put(updateBookingAdmin);

// ─── Users ────────────────────────────────────────────────────────────────────
router.route('/users')
  .get(getAllUsers);

router.route('/users/:id')
  .get(getUserAdmin)
  .put(updateUserAdmin);

// ─── Dashboard & Reports ──────────────────────────────────────────────────────
router.get('/stats', getDashboardStats);
router.get('/reports', getReports);

// ─── Settings ─────────────────────────────────────────────────────────────────
router.route('/settings')
  .get(getSettings)
  .put(updateSettings);

module.exports = router;
