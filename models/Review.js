const mongoose = require('mongoose');

/**
 * Review Schema
 * Optional: users can rate and review cars they've rented.
 */
const reviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    car: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Car',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: [500, 'Comment cannot exceed 500 characters'],
    },
  },
  { timestamps: true }
);

// Prevent duplicate reviews: one review per user per car
reviewSchema.index({ user: 1, car: 1 }, { unique: true });

/**
 * Static method: After save/remove, recalculate average rating on Car.
 */
reviewSchema.statics.calcAverageRating = async function (carId) {
  const Car = require('./Car');
  const stats = await this.aggregate([
    { $match: { car: carId } },
    {
      $group: {
        _id: '$car',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Car.findByIdAndUpdate(carId, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      totalReviews: stats[0].count,
    });
  } else {
    await Car.findByIdAndUpdate(carId, {
      averageRating: 0,
      totalReviews: 0,
    });
  }
};

reviewSchema.post('save', function () {
  this.constructor.calcAverageRating(this.car);
});

reviewSchema.post('remove', function () {
  this.constructor.calcAverageRating(this.car);
});

module.exports = mongoose.model('Review', reviewSchema);
