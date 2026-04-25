const mongoose = require('mongoose');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const { getRecommendedCars } = require('../utils/recommendations');
const { calculateDynamicPrice } = require('../utils/pricing');

/**
 * GET /api/cars
 * Public endpoint: returns all active cars with optional filters and date availability.
 * Query params: type, fuel, transmission, seats, minPrice, maxPrice,
 *               search (text), startDate, endDate (for availability check)
 */
exports.getCars = async (req, res) => {
  try {
    const { type, fuel, transmission, seats, minPrice, maxPrice, search, startDate, endDate } = req.query;

    // Build the base query – only active cars
    const query = { isActive: true };

    if (type) query.type = type;
    if (fuel) query.fuel = fuel;
    if (transmission) query.transmission = transmission;
    if (seats) query.seats = Number(seats);
    if (minPrice || maxPrice) {
      query.rentPerDay = {};
      if (minPrice) query.rentPerDay.$gte = Number(minPrice);
      if (maxPrice) query.rentPerDay.$lte = Number(maxPrice);
    }
    if (search) query.$text = { $search: search };

    let cars = await Car.find(query).sort('-createdAt');

    // Availability filter: exclude cars that have overlapping CONFIRMED bookings
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Find all bookings that overlap with the requested date range
      const overlappingBookings = await Booking.find({
        status: { $in: ['pending', 'confirmed'] },
        startDate: { $lt: end },
        endDate: { $gt: start },
      }).select('car');

      const bookedCarIds = new Set(overlappingBookings.map((b) => b.car.toString()));
      cars = cars.filter((c) => !bookedCarIds.has(c._id.toString()));
    }

    res.status(200).json({ success: true, count: cars.length, cars });
  } catch (err) {
    console.error('Get cars error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/cars/:id
 * Public endpoint: returns a single car with its reviews.
 */
exports.getCarById = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car || !car.isActive) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    res.status(200).json({ success: true, car });
  } catch (err) {
    console.error('Get car by ID error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/cars/recommendations
 * Protected (user): returns 4 content-based recommended cars.
 * Falls back to most-booked cars for new users.
 */
exports.getRecommendations = async (req, res) => {
  try {
    // Get user's booking history to extract booked car IDs
    const userBookings = await Booking.find({ user: req.user._id }).select('car');
    const bookedCarIds = userBookings.map((b) => b.car.toString());

    // Fetch all active cars sorted by booking count (popularity as tiebreaker)
    const popularCarsAgg = await Booking.aggregate([
      { $group: { _id: '$car', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const popularCarIds = popularCarsAgg.map((p) => p._id.toString());

    // Fetch all active cars in popularity order
    let allActiveCars = await Car.find({ isActive: true });
    allActiveCars.sort((a, b) => {
      const aIdx = popularCarIds.indexOf(a._id.toString());
      const bIdx = popularCarIds.indexOf(b._id.toString());
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    // Run recommendation engine
    const recommendedIds = getRecommendedCars(bookedCarIds, allActiveCars, 4);

    const recommendedCars = await Car.find({ _id: { $in: recommendedIds } });

    // Maintain the ranked order returned by the engine
    const orderedCars = recommendedIds
      .map((id) => recommendedCars.find((c) => c._id.toString() === id))
      .filter(Boolean);

    res.status(200).json({ success: true, count: orderedCars.length, cars: orderedCars });
  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/cars/:id/price?startDate=...&endDate=...
 * Public/user: Returns dynamically calculated price for a given car and date range.
 */
exports.getCarPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Car ID' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }

    const car = await Car.findById(req.params.id);
    if (!car || !car.isActive) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    const result = await calculateDynamicPrice(car.rentPerDay, car.type, startDate, endDate);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Get car price error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/cars/:id/reviews
 * Protected (user): Add a review for a car they've rented.
 */
exports.addReview = async (req, res) => {
  try {
    const Review = require('../models/Review');
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Verify user has a completed booking for this car
    const completedBooking = await Booking.findOne({
      user: req.user._id,
      car: req.params.id,
      status: 'completed',
    });

    if (!completedBooking) {
      return res.status(403).json({
        success: false,
        message: 'You can only review cars you have rented and completed',
      });
    }

    const review = await Review.create({
      user: req.user._id,
      car: req.params.id,
      booking: completedBooking._id,
      rating,
      comment,
    });

    res.status(201).json({ success: true, review });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this car' });
    }
    console.error('Add review error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/cars/:id/reviews
 * Public: Get all reviews for a car.
 */
exports.getCarReviews = async (req, res) => {
  try {
    const Review = require('../models/Review');
    const reviews = await Review.find({ car: req.params.id })
      .populate('user', 'name avatar')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
