const Settings = require('../models/Settings');

/**
 * getPricingSettings
 * Fetches dynamic pricing settings from the DB.
 * Returns defaults if settings are not yet configured.
 */
const getPricingSettings = async () => {
  const settings = await Settings.find({
    key: { $in: ['demandMultiplier', 'weekendSurcharge', 'luxuryMarkup'] },
  });

  const settingsMap = {};
  settings.forEach((s) => {
    settingsMap[s.key] = s.value;
  });

  return {
    demandMultiplier: settingsMap.demandMultiplier ?? 1.0,
    weekendSurcharge: settingsMap.weekendSurcharge ?? 1.15,
    luxuryMarkup: settingsMap.luxuryMarkup ?? 1.25,
  };
};

/**
 * calculateDynamicPrice
 * Applies admin-configurable pricing factors to compute the final booking price.
 *
 * @param {number} rentPerDay - Base price per day for the car
 * @param {string} carType    - Car type (e.g. 'luxury')
 * @param {Date}   startDate  - Booking start date
 * @param {Date}   endDate    - Booking end date
 * @returns {{ totalPrice, breakdown }}
 */
const calculateDynamicPrice = async (rentPerDay, carType, startDate, endDate) => {
  const { demandMultiplier, weekendSurcharge, luxuryMarkup } = await getPricingSettings();

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Calculate number of days (minimum 1)
  const msPerDay = 1000 * 60 * 60 * 24;
  const numberOfDays = Math.max(Math.ceil((end - start) / msPerDay), 1);

  const baseTotal = rentPerDay * numberOfDays;

  // Check if any booking day falls on Friday (5) or Saturday (6)
  let hasWeekend = false;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay(); // 0=Sun, 6=Sat
    if (day === 5 || day === 6) {
      hasWeekend = true;
      break;
    }
    current.setDate(current.getDate() + 1);
  }

  // Apply multipliers
  let total = baseTotal * demandMultiplier;
  if (hasWeekend) total *= weekendSurcharge;
  if (carType === 'luxury') total *= luxuryMarkup;

  const finalTotal = Math.round(total * 100) / 100; // Round to 2 decimal places

  return {
    totalPrice: finalTotal,
    breakdown: {
      basePricePerDay: rentPerDay,
      numberOfDays,
      baseTotal,
      demandMultiplier,
      weekendSurcharge: hasWeekend ? weekendSurcharge : 1.0,
      luxuryMarkup: carType === 'luxury' ? luxuryMarkup : 1.0,
      finalTotal,
    },
  };
};

module.exports = { calculateDynamicPrice, getPricingSettings };
