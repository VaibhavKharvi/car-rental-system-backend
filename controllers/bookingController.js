const Booking = require('../models/Booking');
const Car = require('../models/Car');
const User = require('../models/User');
const { calculateDynamicPrice } = require('../utils/pricing');

/**
 * POST /api/bookings
 * Protected (user): Create a new booking for a car.
 * Validates no date overlap with existing confirmed/pending bookings.
 * Calculates dynamic total price.
 */
exports.createBooking = async (req, res) => {
  try {
    const { carId, startDate, endDate } = req.body;

    if (!carId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'carId, startDate, and endDate are required',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    // Validate dates
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'endDate must be after startDate',
      });
    }
    if (start < now) {
      return res.status(400).json({
        success: false,
        message: 'startDate cannot be in the past',
      });
    }

    // Fetch car
    const car = await Car.findById(carId);
    if (!car || !car.isActive) {
      return res.status(404).json({ success: false, message: 'Car not found or unavailable' });
    }

    // Check for overlapping bookings for this car
    const overlap = await Booking.findOne({
      car: carId,
      status: { $in: ['pending', 'confirmed'] },
      startDate: { $lt: end },
      endDate: { $gt: start },
    });

    if (overlap) {
      return res.status(409).json({
        success: false,
        message: 'Car is not available for the selected dates',
      });
    }

    // Calculate price with dynamic pricing
    const { totalPrice, breakdown } = await calculateDynamicPrice(
      car.rentPerDay,
      car.type,
      start,
      end
    );

    // Create booking
    const booking = await Booking.create({
      user: req.user._id,
      car: carId,
      startDate: start,
      endDate: end,
      totalPrice,
      pricingBreakdown: breakdown,
      status: 'pending',
      actionBy: 'user',
      actionById: req.user._id,
    });

    // Add booking reference to the car
    await Car.findByIdAndUpdate(carId, { $push: { bookings: booking._id } });

    // Populate for response
    await booking.populate([
      { path: 'user', select: 'name email' },
      { path: 'car', select: 'name brand type images rentPerDay' },
    ]);

    res.status(201).json({ success: true, booking });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/bookings/mine
 * Protected (user): Get all bookings made by the current user.
 */
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('car', 'name brand type images rentPerDay')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    console.error('Get my bookings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/bookings/:id/cancel
 * Protected (user): Cancel a booking.
 * Rules: only 'pending' or 'confirmed', pickup > 24 hours away.
 */
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Ensure the booking belongs to this user
    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking',
      });
    }

    // Check status
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or confirmed bookings can be cancelled',
      });
    }

    // Check: pickup must be > 24 hours away
    const hoursUntilPickup = (new Date(booking.startDate) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilPickup < 24) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking within 24 hours of pickup',
      });
    }

    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason || 'Cancelled by user';
    booking.actionBy = 'user';
    booking.actionById = req.user._id;
    await booking.save();

    res.status(200).json({ success: true, booking });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/bookings/:id/pay
 * Protected (user): Mock payment – moves booking from pending to confirmed.
 */
exports.payBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be paid',
      });
    }

    booking.status = 'confirmed';
    booking.paymentStatus = 'paid';
    // Mock payment reference
    booking.paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await booking.save();

    await booking.populate([
      { path: 'user', select: 'name email' },
      { path: 'car', select: 'name brand type images rentPerDay' },
    ]);

    res.status(200).json({ success: true, booking });
  } catch (err) {
    console.error('Pay booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/bookings/:id
 * Protected: Get a single booking by ID (user can only see their own, admin sees all).
 */
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('car', 'name brand type images rentPerDay');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Non-admin users can only see their own bookings
    if (req.user.role !== 'admin' && booking.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.status(200).json({ success: true, booking });
  } catch (err) {
    console.error('Get booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
