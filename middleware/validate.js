const { validationResult } = require('express-validator');

/**
 * Middleware: validate
 * Collects validation errors from express-validator and returns them
 * in a consistent format if any errors are present.
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return first error message for simplicity
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};
