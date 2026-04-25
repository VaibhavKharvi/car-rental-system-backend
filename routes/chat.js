const express = require('express');
const router = express.Router();
const { chat } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

// Chat is accessible to authenticated users
// We use a try-catch in middleware so unauthenticated users still get a response
router.post(
  '/',
  (req, res, next) => {
    // Optionally attach user if token present, but don't block if not
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return protect(req, res, next);
    }
    next();
  },
  chat
);

module.exports = router;
