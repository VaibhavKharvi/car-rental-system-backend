/**
 * Content-Based Car Recommendation Engine
 * Uses a simple cosine similarity algorithm over encoded car feature vectors.
 * Features used: type, fuel, transmission, seats (normalized), rentPerDay (normalized)
 */

// ─── One-hot encoding maps ────────────────────────────────────────────────────
const TYPES = ['sedan', 'suv', 'hatchback', 'luxury', 'convertible', 'truck', 'van'];
const FUELS = ['petrol', 'diesel', 'electric', 'hybrid'];
const TRANSMISSIONS = ['automatic', 'manual'];

/**
 * encodeCarVector
 * Converts a car document into a numeric feature vector.
 * Structure: [type_one_hot (7), fuel_one_hot (4), transmission_one_hot (2),
 *             seats_normalized, price_normalized]
 *
 * @param {object} car      - Car document
 * @param {number} maxSeats - Max seats in the dataset (for normalization)
 * @param {number} maxPrice - Max rentPerDay in the dataset (for normalization)
 * @returns {number[]}
 */
const encodeCarVector = (car, maxSeats = 12, maxPrice = 1000) => {
  // Type one-hot
  const typeVec = TYPES.map((t) => (car.type === t ? 1 : 0));
  // Fuel one-hot
  const fuelVec = FUELS.map((f) => (car.fuel === f ? 1 : 0));
  // Transmission one-hot
  const transVec = TRANSMISSIONS.map((t) => (car.transmission === t ? 1 : 0));
  // Numeric – normalize to [0, 1]
  const seatsNorm = car.seats / maxSeats;
  const priceNorm = car.rentPerDay / maxPrice;

  return [...typeVec, ...fuelVec, ...transVec, seatsNorm, priceNorm];
};

/**
 * cosineSimilarity
 * Returns cosine similarity between two numeric vectors (0 = orthogonal, 1 = identical).
 */
const cosineSimilarity = (vecA, vecB) => {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
};

/**
 * averageVector
 * Returns the element-wise average of an array of vectors.
 */
const averageVector = (vectors) => {
  if (vectors.length === 0) return null;
  const length = vectors[0].length;
  const sum = new Array(length).fill(0);
  vectors.forEach((v) => v.forEach((val, i) => (sum[i] += val)));
  return sum.map((s) => s / vectors.length);
};

/**
 * getRecommendedCars
 * Returns up to `topN` recommended car IDs for a user based on:
 *  - If user has booking history → content-based filtering (cosine similarity)
 *  - If new user with no history → returns most-booked cars (popularity-based)
 *
 * @param {string[]} bookedCarIds - IDs of cars the user has booked previously
 * @param {object[]} allActiveCars - All active car documents from DB
 * @param {number} topN - How many recommendations to return (default 4)
 * @returns {string[]} - Array of recommended car IDs
 */
const getRecommendedCars = (bookedCarIds, allActiveCars, topN = 4) => {
  if (!allActiveCars || allActiveCars.length === 0) return [];

  // Normalize stats across the whole dataset
  const maxSeats = Math.max(...allActiveCars.map((c) => c.seats), 1);
  const maxPrice = Math.max(...allActiveCars.map((c) => c.rentPerDay), 1);

  const bookedSet = new Set(bookedCarIds.map((id) => id.toString()));

  if (bookedCarIds.length === 0) {
    // Popularity-based: return cars with most bookings (already sorted by caller)
    return allActiveCars.slice(0, topN).map((c) => c._id.toString());
  }

  // Build user preference vector = average of booked car vectors
  const bookedCars = allActiveCars.filter((c) => bookedSet.has(c._id.toString()));
  if (bookedCars.length === 0) {
    return allActiveCars.slice(0, topN).map((c) => c._id.toString());
  }

  const bookedVectors = bookedCars.map((c) => encodeCarVector(c, maxSeats, maxPrice));
  const userVector = averageVector(bookedVectors);

  // Score all NON-booked active cars by similarity to user vector
  const scored = allActiveCars
    .filter((c) => !bookedSet.has(c._id.toString()))
    .map((c) => ({
      id: c._id.toString(),
      score: cosineSimilarity(userVector, encodeCarVector(c, maxSeats, maxPrice)),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map((s) => s.id);
};

module.exports = { getRecommendedCars, encodeCarVector, cosineSimilarity };
