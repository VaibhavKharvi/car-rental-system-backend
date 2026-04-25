const mongoose = require('mongoose');

/**
 * Booking Schema
 * Records a reservation made by a user for a specific car.
 */
const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Car',
      required: [true, 'Car reference is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    // Who initiated the booking or cancellation action
    actionBy: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    actionById: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Payment simulation – mock payment reference
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    paymentId: {
      type: String,
      default: '',
    },
    // Dynamic pricing breakdown (for transparency)
    pricingBreakdown: {
      basePricePerDay: Number,
      numberOfDays: Number,
      baseTotal: Number,
      demandMultiplier: Number,
      weekendSurcharge: Number,
      luxuryMarkup: Number,
      finalTotal: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);
