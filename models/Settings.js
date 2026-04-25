const mongoose = require('mongoose');

/**
 * Settings Schema
 * Key-value store for admin-configurable parameters.
 * Used primarily for AI dynamic pricing factors.
 */
const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Setting key is required'],
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed, // Allows any data type
      required: [true, 'Setting value is required'],
    },
    description: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
