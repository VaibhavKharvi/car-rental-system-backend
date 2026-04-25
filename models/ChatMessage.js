const mongoose = require('mongoose');

/**
 * ChatMessage Schema
 * Optionally persists chatbot conversations for future admin review.
 */
const chatMessageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for unauthenticated/guest sessions
    },
    sessionId: {
      type: String,
      required: [true, 'Session ID is required'],
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
    },
    sender: {
      type: String,
      enum: ['user', 'bot'],
      required: [true, 'Sender is required'],
    },
  },
  { timestamps: true }
);

// Index for fast session lookups
chatMessageSchema.index({ sessionId: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
