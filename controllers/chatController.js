const OpenAI = require('openai');
const Car = require('../models/Car');
const ChatMessage = require('../models/ChatMessage');

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory session history (per sessionId) – resets on server restart
const sessionHistory = new Map();

/**
 * POST /api/chat
 * Handles chatbot messages using OpenAI GPT.
 * Builds context from the current car fleet and maintains session history.
 */
exports.chat = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const sid = sessionId || `anon-${Date.now()}`;

    // Build a summary of the current active fleet for context
    const activeCars = await Car.find({ isActive: true }).select(
      'name brand type fuel transmission seats rentPerDay'
    );

    const fleetSummary = activeCars
      .map(
        (c) =>
          `${c.brand} ${c.name} (${c.type}, ${c.fuel}, ${c.transmission}, ${c.seats} seats) – ₹${c.rentPerDay}/day`
      )
      .join('; ');

    // System prompt with company context
    const systemPrompt = `You are a helpful and friendly car rental assistant for DriveEase Rentals.
You help customers choose cars, explain pricing, and answer general questions.

Company Policies:
- Free cancellation up to 24 hours before pickup
- Minimum rental: 1 day
- ID and valid driver's license required at pickup
- Age requirement: 21+
- Fuel policy: return car with same fuel level
- Insurance: basic insurance included, full coverage optional

Current Fleet:
${fleetSummary || 'No cars currently available.'}

Pricing Notes:
- Weekend surcharge (Friday-Saturday): +15%
- Luxury cars have an additional markup
- Prices may vary based on demand season

Always use Indian Rupees (₹) for pricing in your responses.
Always be helpful, concise, and friendly. If asked about specific availability, direct users to the booking page.`;

    // Retrieve or initialize session history
    if (!sessionHistory.has(sid)) {
      sessionHistory.set(sid, []);
    }
    const history = sessionHistory.get(sid);

    // Add user message to history
    history.push({ role: 'user', content: message });

    // Keep last 10 exchanges to stay within token limits
    const recentHistory = history.slice(-20);

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: systemPrompt }, ...recentHistory],
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;

    // Add assistant response to history
    history.push({ role: 'assistant', content: reply });

    // Optionally persist messages to DB
    try {
      await ChatMessage.insertMany([
        {
          user: req.user ? req.user._id : null,
          sessionId: sid,
          message,
          sender: 'user',
        },
        {
          user: req.user ? req.user._id : null,
          sessionId: sid,
          message: reply,
          sender: 'bot',
        },
      ]);
    } catch (dbErr) {
      // Non-critical – don't fail the request if DB save fails
      console.warn('Chat message DB save failed:', dbErr.message);
    }

    res.status(200).json({ success: true, reply, sessionId: sid });
  } catch (err) {
    console.error('Chat error:', err);

    // Return a friendly fallback if OpenAI is unavailable
    if (err.code === 'insufficient_quota' || err.status === 429) {
      return res.status(200).json({
        success: true,
        reply:
          "I'm sorry, I'm experiencing high demand right now. Please try again in a moment, or contact our support team directly!",
        sessionId: req.body.sessionId || 'fallback',
      });
    }

    res.status(500).json({ success: false, message: 'Chatbot service unavailable' });
  }
};
