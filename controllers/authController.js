const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const User = require('../models/User');

// ─── Validation Rules ─────────────────────────────────────────────────────────

exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }).withMessage('Name max 50 characters'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

exports.loginRules = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ─── Helper: Send token response ─────────────────────────────────────────────

const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  // Cookie options
  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };

  // Remove password from output
  user.password = undefined;

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        avatar: user.avatar,
        notifications: user.notifications,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Register a new user (role: user).
 * Admin registration requires ADMIN_SECRET_KEY in request body.
 */
exports.register = [
  ...exports.registerRules,
  validate,
  async (req, res) => {
    try {
      const { name, email, password, phone, address, adminSecret } = req.body;

      // Determine role
      let role = 'user';
      if (adminSecret) {
        if (adminSecret !== process.env.ADMIN_SECRET_KEY) {
          return res.status(403).json({ success: false, message: 'Invalid admin secret key' });
        }
        role = 'admin';
      }

      // Check duplicate email
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }

      const user = await User.create({ name, email, password, phone, address, role });
      sendTokenResponse(user, 201, res);
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ success: false, message: 'Server error during registration' });
    }
  },
];

/**
 * POST /api/auth/login
 * Login user or admin. Returns JWT in cookie and body.
 */
exports.login = [
  ...exports.loginRules,
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Include password (excluded by default via select: false)
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Check active status
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.',
        });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      sendTokenResponse(user, 200, res);
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, message: 'Server error during login' });
    }
  },
];

/**
 * GET /api/auth/me
 * Return the currently logged-in user's profile.
 * Protected route.
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/auth/updatedetails
 * Update user's own profile details (name, phone, address).
 * Protected route.
 */
exports.updateDetails = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;
    if (phone) fieldsToUpdate.phone = phone;
    if (address) fieldsToUpdate.address = address;

    const user = await User.findByIdAndUpdate(req.user._id, fieldsToUpdate, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('Update details error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/auth/updatepassword
 * Change the current user's password.
 * Requires currentPassword and newPassword.
 * Protected route.
 */
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide currentPassword and newPassword',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    user.password = newPassword;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * POST /api/auth/logout
 * Clear the JWT cookie and log out.
 */
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // expires in 10s
    httpOnly: true,
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * GET /api/auth/notifications
 * Return the logged-in user's notifications.
 */
exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');
    res.status(200).json({ success: true, notifications: user.notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/auth/notifications/:notifId/read
 * Mark a specific notification as read.
 */
exports.markNotificationRead = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id, 'notifications._id': req.params.notifId },
      { $set: { 'notifications.$.read': true } }
    );
    res.status(200).json({ success: true, message: 'Notification marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
