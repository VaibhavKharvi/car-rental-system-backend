const mongoose = require('mongoose');

/**
 * Car Schema
 * Represents a car available for rental. Admin adds/edits/deactivates cars.
 */
const carSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Car name is required'],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Car type is required'],
      enum: ['sedan', 'suv', 'hatchback', 'luxury', 'convertible', 'truck', 'van'],
    },
    fuel: {
      type: String,
      required: [true, 'Fuel type is required'],
      enum: ['petrol', 'diesel', 'electric', 'hybrid'],
    },
    transmission: {
      type: String,
      required: [true, 'Transmission type is required'],
      enum: ['automatic', 'manual'],
    },
    seats: {
      type: Number,
      required: [true, 'Number of seats is required'],
      min: [2, 'Seats must be at least 2'],
      max: [12, 'Seats cannot exceed 12'],
    },
    rentPerDay: {
      type: Number,
      required: [true, 'Rent per day is required'],
      min: [0, 'Rent per day cannot be negative'],
    },
    images: {
      type: [String], // Array of Cloudinary URLs
      default: [],
    },
    description: {
      type: String,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    features: {
      type: [String], // e.g. ["GPS", "Bluetooth", "Sunroof"]
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Reference to bookings (lightweight list for quick queries)
    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
      },
    ],
    // Average rating (denormalized for quick access)
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ─── Index for text search ────────────────────────────────────────────────────
carSchema.index({ name: 'text', brand: 'text', description: 'text' });

module.exports = mongoose.model('Car', carSchema);
