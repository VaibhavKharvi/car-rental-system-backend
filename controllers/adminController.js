const Car = require('../models/Car');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

// ─── CAR MANAGEMENT ───────────────────────────────────────────────────────────

/**
 * POST /api/admin/cars
 * Admin: Add a new car with image uploads.
 */
exports.addCar = [
  upload.array('images', 5), // Accept up to 5 images
  async (req, res) => {
    try {
      const { name, brand, type, fuel, transmission, seats, rentPerDay, description, features } =
        req.body;

      // Validate required fields
      if (!name || !brand || !type || !fuel || !transmission || !seats || !rentPerDay) {
        return res.status(400).json({ success: false, message: 'All required fields must be provided' });
      }

      // Upload images to Cloudinary
      let imageUrls = [];
      if (req.files && req.files.length > 0) {
        imageUrls = await Promise.all(
          req.files.map((file) => uploadToCloudinary(file.buffer, 'car-rental/cars'))
        );
      }

      // Parse features (can come as JSON string or array)
      let parsedFeatures = [];
      if (features) {
        parsedFeatures = typeof features === 'string' ? JSON.parse(features) : features;
      }

      const car = await Car.create({
        name,
        brand,
        type,
        fuel,
        transmission,
        seats: Number(seats),
        rentPerDay: Number(rentPerDay),
        description,
        features: parsedFeatures,
        images: imageUrls,
      });

      res.status(201).json({ success: true, car });
    } catch (err) {
      console.error('Add car error:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  },
];

/**
 * PUT /api/admin/cars/:id
 * Admin: Update car details and optionally add new images.
 */
exports.updateCar = [
  upload.array('images', 5),
  async (req, res) => {
    try {
      const car = await Car.findById(req.params.id);
      if (!car) {
        return res.status(404).json({ success: false, message: 'Car not found' });
      }

      const { name, brand, type, fuel, transmission, seats, rentPerDay, description, features, isActive } =
        req.body;

      const updateFields = {};
      if (name) updateFields.name = name;
      if (brand) updateFields.brand = brand;
      if (type) updateFields.type = type;
      if (fuel) updateFields.fuel = fuel;
      if (transmission) updateFields.transmission = transmission;
      if (seats) updateFields.seats = Number(seats);
      if (rentPerDay) updateFields.rentPerDay = Number(rentPerDay);
      if (description !== undefined) updateFields.description = description;
      if (isActive !== undefined) updateFields.isActive = isActive === 'true' || isActive === true;
      if (features) {
        updateFields.features = typeof features === 'string' ? JSON.parse(features) : features;
      }

      // Upload new images if provided
      if (req.files && req.files.length > 0) {
        const newUrls = await Promise.all(
          req.files.map((file) => uploadToCloudinary(file.buffer, 'car-rental/cars'))
        );
        updateFields.images = [...car.images, ...newUrls];
      }

      const updatedCar = await Car.findByIdAndUpdate(req.params.id, updateFields, {
        new: true,
        runValidators: true,
      });

      res.status(200).json({ success: true, car: updatedCar });
    } catch (err) {
      console.error('Update car error:', err);
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  },
];

/**
 * DELETE /api/admin/cars/:id
 * Admin: Soft delete a car (set isActive = false).
 * Booking history is preserved.
 */
exports.deleteCar = async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    res.status(200).json({ success: true, message: 'Car deactivated successfully', car });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/admin/cars
 * Admin: Get all cars (including inactive) with booking counts.
 */
exports.getAllCarsAdmin = async (req, res) => {
  try {
    const { type, search, isActive } = req.query;
    const query = {};
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) query.$text = { $search: search };

    // Aggregate booking count per car
    const bookingCounts = await Booking.aggregate([
      { $group: { _id: '$car', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    bookingCounts.forEach((b) => (countMap[b._id.toString()] = b.count));

    const cars = await Car.find(query).sort('-createdAt');
    const carsWithCount = cars.map((c) => ({
      ...c.toObject(),
      bookingCount: countMap[c._id.toString()] || 0,
    }));

    res.status(200).json({ success: true, count: cars.length, cars: carsWithCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── BOOKING MANAGEMENT ───────────────────────────────────────────────────────

/**
 * GET /api/admin/bookings
 * Admin: Get all bookings with filters.
 */
exports.getAllBookings = async (req, res) => {
  try {
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('user', 'name email phone')
        .populate('car', 'name brand type rentPerDay images')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      bookings,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/admin/bookings/:id
 * Admin: Update booking status (approve, cancel, complete).
 * On cancel: notify the user.
 */
exports.updateBookingAdmin = async (req, res) => {
  try {
    const { status, cancellationReason } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const prevStatus = booking.status;
    booking.status = status;
    booking.actionBy = 'admin';
    booking.actionById = req.user._id;

    if (status === 'cancelled' && cancellationReason) {
      booking.cancellationReason = cancellationReason;
    }

    await booking.save();

    // If admin cancels → notify the user
    if (status === 'cancelled' && prevStatus !== 'cancelled') {
      const reason = cancellationReason || 'No reason provided';
      await User.findByIdAndUpdate(booking.user, {
        $push: {
          notifications: {
            message: `Your booking #${booking._id} was cancelled by the admin. Reason: ${reason}`,
            createdAt: new Date(),
            read: false,
          },
        },
      });
    }

    await booking.populate([
      { path: 'user', select: 'name email' },
      { path: 'car', select: 'name brand' },
    ]);

    res.status(200).json({ success: true, booking });
  } catch (err) {
    console.error('Admin update booking error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 * Admin: Get all registered users.
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 20 } = req.query;
    const query = { role: 'user' }; // Only regular users
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query).sort('-createdAt').skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    // Attach booking counts
    const bookingCounts = await Booking.aggregate([
      { $match: { user: { $in: users.map((u) => u._id) } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    bookingCounts.forEach((b) => (countMap[b._id.toString()] = b.count));

    const usersWithCount = users.map((u) => ({
      ...u.toObject(),
      bookingCount: countMap[u._id.toString()] || 0,
    }));

    res.status(200).json({ success: true, count: users.length, total, users: usersWithCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/admin/users/:id
 * Admin: Get a user's profile and their booking history.
 */
exports.getUserAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const bookings = await Booking.find({ user: req.params.id })
      .populate('car', 'name brand type rentPerDay')
      .sort('-createdAt');

    res.status(200).json({ success: true, user, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/admin/users/:id
 * Admin: Activate/deactivate a user or change their role.
 * Deactivating cancels all their active bookings.
 */
exports.updateUserAdmin = async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If deactivating, cancel all pending/confirmed bookings
    if (isActive === false || isActive === 'false') {
      await Booking.updateMany(
        { user: req.params.id, status: { $in: ['pending', 'confirmed'] } },
        { status: 'cancelled', cancellationReason: 'Account deactivated by admin', actionBy: 'admin' }
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: isActive === 'true' || isActive === true },
      { new: true }
    );

    res.status(200).json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── DASHBOARD & REPORTS ─────────────────────────────────────────────────────

/**
 * GET /api/admin/stats
 * Admin: Get dashboard overview metrics.
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [totalCars, totalUsers, totalBookings, recentBookings, revenueAgg] = await Promise.all([
      Car.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'user' }),
      Booking.countDocuments(),
      Booking.find()
        .populate('user', 'name email')
        .populate('car', 'name brand type')
        .sort('-createdAt')
        .limit(5),
      Booking.aggregate([
        { $match: { status: { $in: ['confirmed', 'completed'] } } },
        { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } },
      ]),
    ]);

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;

    // Bookings by status
    const statusCounts = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statusMap = {};
    statusCounts.forEach((s) => (statusMap[s._id] = s.count));

    res.status(200).json({
      success: true,
      stats: {
        totalCars,
        totalUsers,
        totalBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        bookingsByStatus: statusMap,
      },
      recentBookings,
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/admin/reports
 * Admin: Aggregated data for charts.
 */
exports.getReports = async (req, res) => {
  try {
    // Monthly revenue (last 12 months)
    const monthlyRevenue = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalPrice' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]);

    // Most booked cars (top 5)
    const popularCars = await Booking.aggregate([
      { $group: { _id: '$car', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'cars',
          localField: '_id',
          foreignField: '_id',
          as: 'car',
        },
      },
      { $unwind: '$car' },
      { $project: { 'car.name': 1, 'car.brand': 1, 'car.type': 1, count: 1 } },
    ]);

    // Monthly user registrations (last 12 months)
    const userGrowth = await User.aggregate([
      { $match: { role: 'user' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]);

    res.status(200).json({ success: true, monthlyRevenue, popularCars, userGrowth });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── SETTINGS MANAGEMENT ──────────────────────────────────────────────────────

/**
 * GET /api/admin/settings
 * Admin: Get all pricing settings.
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await Settings.find();
    res.status(200).json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/admin/settings
 * Admin: Update pricing settings (upsert each key).
 * Body: { demandMultiplier, weekendSurcharge, luxuryMarkup }
 */
exports.updateSettings = async (req, res) => {
  try {
    const allowedKeys = ['demandMultiplier', 'weekendSurcharge', 'luxuryMarkup'];

    const updates = [];
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        updates.push(
          Settings.findOneAndUpdate(
            { key },
            { key, value: Number(req.body[key]) },
            { upsert: true, new: true }
          )
        );
      }
    }

    const results = await Promise.all(updates);
    res.status(200).json({ success: true, settings: results });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
