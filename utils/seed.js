/**
 * Seed Script
 * Creates an admin user, sample cars, and default pricing settings.
 * Run with: npm run seed
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load .env from backend root (works whether run from backend/ or backend/utils/)
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');
const Car = require('../models/Car');
const Settings = require('../models/Settings');

const sampleCars = [
  {
    name: 'Camry Elegance',
    brand: 'Toyota',
    type: 'sedan',
    fuel: 'petrol',
    transmission: 'automatic',
    seats: 5,
    rentPerDay: 75,
    images: [
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800',
    ],
    description: 'A comfortable and reliable sedan perfect for business trips and family outings.',
    features: ['GPS Navigation', 'Bluetooth', 'Backup Camera', 'Heated Seats'],
    isActive: true,
  },
  {
    name: 'Explorer Adventure',
    brand: 'Ford',
    type: 'suv',
    fuel: 'petrol',
    transmission: 'automatic',
    seats: 7,
    rentPerDay: 120,
    images: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800',
    ],
    description: 'Spacious SUV ideal for family vacations and off-road adventures.',
    features: ['4WD', 'GPS Navigation', 'Sunroof', 'Apple CarPlay', 'Android Auto'],
    isActive: true,
  },
  {
    name: 'Swift City',
    brand: 'Suzuki',
    type: 'hatchback',
    fuel: 'petrol',
    transmission: 'manual',
    seats: 5,
    rentPerDay: 45,
    images: [
      'https://images.unsplash.com/photo-1552519507-da3b142a6bd3?w=800',
    ],
    description: 'Compact and fuel-efficient hatchback perfect for city driving.',
    features: ['Bluetooth', 'USB Ports', 'Air Conditioning'],
    isActive: true,
  },
  {
    name: 'S-Class Executive',
    brand: 'Mercedes-Benz',
    type: 'luxury',
    fuel: 'hybrid',
    transmission: 'automatic',
    seats: 4,
    rentPerDay: 15000,
    images: [
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800',
    ],
    description: 'Ultimate luxury sedan with cutting-edge technology and unmatched comfort.',
    features: ['Massage Seats', 'Premium Sound', 'Night Vision', 'Chauffeur Mode', 'WiFi Hotspot'],
    isActive: true,
  },
  {
    name: 'Mustang GT',
    brand: 'Ford',
    type: 'convertible',
    fuel: 'petrol',
    transmission: 'manual',
    seats: 4,
    rentPerDay: 200,
    images: [
      'https://images.unsplash.com/photo-1584345604476-8ec5f82d718d?w=800',
    ],
    description: 'Iconic American muscle convertible for an unforgettable driving experience.',
    features: ['Convertible Top', 'V8 Engine', 'Performance Package', 'Launch Control'],
    isActive: true,
  },
  {
    name: 'Leaf EcoDriver',
    brand: 'Nissan',
    type: 'hatchback',
    fuel: 'electric',
    transmission: 'automatic',
    seats: 5,
    rentPerDay: 60,
    images: [
      'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800',
    ],
    description: '100% electric city car with zero emissions and low running costs.',
    features: ['Fast Charging', 'Autopilot', 'Heated Seats', 'Smart Parking'],
    isActive: true,
  },
];

const seedSettings = [
  { key: 'demandMultiplier', value: 1.0, description: 'General demand multiplier applied to all bookings' },
  { key: 'weekendSurcharge', value: 1.15, description: 'Surcharge applied when booking includes Friday or Saturday' },
  { key: 'luxuryMarkup', value: 1.25, description: 'Additional markup applied to luxury car bookings' },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅  Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Car.deleteMany({});
    await Settings.deleteMany({});
    console.log('🗑️   Cleared existing data');

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Admin123',
      role: 'admin',
      phone: '+1-555-0100',
      isActive: true,
    });
    console.log(`👤  Admin created: ${admin.email}`);

    // Create sample regular user
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'User1234',
      role: 'user',
      phone: '+1-555-0101',
      isActive: true,
    });
    console.log(`👤  Sample user created: ${user.email}`);

    // Insert cars
    const cars = await Car.insertMany(sampleCars);
    console.log(`🚗  Inserted ${cars.length} sample cars`);

    // Insert pricing settings
    await Settings.insertMany(seedSettings);
    console.log('⚙️   Inserted pricing settings');

    console.log('\n✅  Seed completed successfully!\n');
    console.log('Admin credentials → email: admin@example.com | password: Admin123');
    console.log('User credentials  → email: john@example.com  | password: User1234');

    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  }
};

seedDB();
