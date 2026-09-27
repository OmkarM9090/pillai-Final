const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoURI) {
  console.error('❌ MONGODB_URI not found in .env file!');
  process.exit(1);
}

// ================= SCHEMAS =================
const RoomSchema = new mongoose.Schema({
  room_number: { type: String, required: true, unique: true },
  type: { type: String, enum: ['Standard', 'Deluxe', 'Suite'], default: 'Standard' },
  status: { type: String, enum: ['available', 'occupied', 'cleaning', 'maintenance', 'out-of-order'], default: 'available' },
  rate_per_night: { type: Number, default: 150 },
  floor: { type: Number, default: 1 },
  last_cleaned: { type: Date, default: Date.now },
  maintenance_notes: { type: String, default: '' }
}, { timestamps: true });

const BookingSchema = new mongoose.Schema({
  guest_name: { type: String, required: true },
  room_number: { type: String, required: true },
  check_in: { type: Date, required: true },
  check_out: { type: Date, required: true },
  status: { type: String, enum: ['confirmed', 'checked-in', 'checked-out', 'cancelled'], default: 'checked-in' },
  guests_count: { type: Number, default: 2 },
  rate_locked: { type: Number, default: 150 },
  source: { type: String, default: 'direct' },
  special_requests: { type: String, default: '' }
}, { timestamps: true });

const StaffRosterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  department: { type: String, enum: ['housekeeping', 'front_desk', 'fnb', 'maintenance', 'spa', 'security'], required: true },
  role: { type: String, default: 'Staff' },
  skills: [{ type: String }],
  cross_trained: [{ type: String }],
  shift_start: { type: String, default: '08:00' },
  shift_end: { type: String, default: '16:00' },
  max_hours_per_day: { type: Number, default: 8 },
  is_available: { type: Boolean, default: true },
  fatigue_score: { type: Number, default: 20 },
  overtime_hours_this_week: { type: Number, default: 0 },
  hourly_rate: { type: Number, default: 18 }
}, { timestamps: true });

const PantryInventorySchema = new mongoose.Schema({
  item_name: { type: String, required: true, unique: true },
  category: { type: String, default: 'produce' },
  current_stock_kg: { type: Number, required: true },
  safety_threshold_kg: { type: Number, required: true },
  unit_cost: { type: Number, default: 10 },
  supplier: { type: String, default: 'Primary Supplier' },
  lead_time_days: { type: Number, default: 2 },
  last_replenished: { type: Date, default: Date.now },
  daily_consumption_rate_kg: { type: Number, required: true }
}, { timestamps: true });

const OperationalTicketSchema = new mongoose.Schema({
  ticket_id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  department: { type: String, required: true },
  priority: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
  status: { type: String, enum: ['todo', 'in_progress', 'blocked', 'completed'], default: 'todo' },
  source: { type: String, enum: ['review', 'maintenance', 'guest_request', 'system'], default: 'system' },
  room_number: { type: String },
  assigned_to: { type: String },
  sla_deadline: { type: Date },
  resolution_notes: { type: String },
  sentiment_score: { type: Number },
  evidence_terms: [{ type: String }]
}, { timestamps: true });

const MaintenanceAssetSchema = new mongoose.Schema({
  asset_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, default: 'Main Building' },
  type: { type: String, enum: ['HVAC', 'plumbing', 'electrical', 'elevator', 'kitchen'], default: 'HVAC' },
  install_date: { type: Date, default: Date.now },
  last_maintenance: { type: Date, default: Date.now },
  condition_score: { type: Number, default: 80 },
  anomaly_score: { type: Number, default: 0.1 },
  failure_risk: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
  sensor_readings: {
    vibration: { type: Number, default: 0.02 },
    temperature: { type: Number, default: 22.5 },
    pressure: { type: Number, default: 1.0 },
    humidity: { type: Number, default: 45 },
    power_consumption: { type: Number, default: 3.5 }
  }
}, { timestamps: true });

const WorldSignalSchema = new mongoose.Schema({
  signal_type: { type: String, enum: ['weather', 'demand_shock', 'local_event'], required: true },
  source: { type: String, default: 'synthetic' },
  data: { type: mongoose.Schema.Types.Mixed },
  severity: { type: Number, default: 0.5 },
  affected_departments: [{ type: String }],
  expected_impact: { type: String, default: '' },
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

// Compile models
const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
const Booking = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);
const StaffRoster = mongoose.models.StaffRoster || mongoose.model('StaffRoster', StaffRosterSchema);
const PantryInventory = mongoose.models.PantryInventory || mongoose.model('PantryInventory', PantryInventorySchema);
const OperationalTicket = mongoose.models.OperationalTicket || mongoose.model('OperationalTicket', OperationalTicketSchema);
const MaintenanceAsset = mongoose.models.MaintenanceAsset || mongoose.model('MaintenanceAsset', MaintenanceAssetSchema);
const WorldSignal = mongoose.models.WorldSignal || mongoose.model('WorldSignal', WorldSignalSchema);

// ================= SEED FUNCTION =================
async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB Atlas');

    // 1. Clear non-user collections
    console.log('Clearing old operational state (Users preserved)...');
    await Promise.all([
      Room.deleteMany({}),
      Booking.deleteMany({}),
      StaffRoster.deleteMany({}),
      PantryInventory.deleteMany({}),
      OperationalTicket.deleteMany({}),
      MaintenanceAsset.deleteMany({}),
      WorldSignal.deleteMany({})
    ]);

    // 2. Seed 50 Rooms (41 occupied = 82% occupancy)
    console.log('Seeding 50 Rooms...');
    const rooms = [];
    for (let i = 101; i <= 150; i++) {
      let type = 'Standard';
      let rate = 150;
      if (i > 130 && i <= 145) { type = 'Deluxe'; rate = 250; }
      else if (i > 145) { type = 'Suite'; rate = 450; }

      let status = 'occupied';
      if (i === 142 || i === 143 || i === 144 || i === 145) status = 'available';
      else if (i === 146 || i === 147 || i === 148) status = 'cleaning';
      else if (i === 149 || i === 150) status = 'maintenance';

      rooms.push({
        room_number: i.toString(),
        type,
        status,
        rate_per_night: rate,
        floor: Math.floor((i - 100) / 10) + 1,
        last_cleaned: new Date()
      });
    }
    await Room.insertMany(rooms);

    // 3. Seed 41 Active Bookings matching occupied rooms
    console.log('Seeding 41 Bookings...');
    const occupiedRooms = rooms.filter(r => r.status === 'occupied');
    const bookings = occupiedRooms.map((r, idx) => ({
      guest_name: `Guest ${String.fromCharCode(65 + (idx % 26))}${idx + 1}`,
      room_number: r.room_number,
      check_in: new Date(Date.now() - (idx % 3) * 86400000),
      check_out: new Date(Date.now() + (2 + (idx % 4)) * 86400000),
      status: 'checked-in',
      guests_count: (idx % 3) + 1,
      rate_locked: r.rate_per_night,
      source: idx % 2 === 0 ? 'direct' : 'OTA'
    }));
    await Booking.insertMany(bookings);

    // 4. Seed 30 Staff members across departments
    console.log('Seeding 30 Staff members...');
    const staffList = [
      // Housekeeping (8)
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `Maria Housekeeper ${i + 1}`,
        department: 'housekeeping',
        role: i === 0 ? 'Lead Housekeeper' : 'Room Attendant',
        skills: ['Deep Cleaning', 'Turn-down'],
        cross_trained: i < 2 ? ['front_desk'] : [],
        shift_start: '08:00',
        shift_end: '16:00',
        is_available: i !== 7, // 1 unavailable/sick
        fatigue_score: 25 + i * 5,
        hourly_rate: 19
      })),
      // Front Desk (5)
      ...Array.from({ length: 5 }, (_, i) => ({
        name: `Alex FrontDesk ${i + 1}`,
        department: 'front_desk',
        role: i === 0 ? 'Front Desk Supervisor' : 'Receptionist',
        skills: ['PMS Check-in', 'Concierge'],
        cross_trained: ['housekeeping'],
        shift_start: '07:00',
        shift_end: '15:00',
        is_available: true,
        fatigue_score: 20 + i * 4,
        hourly_rate: 22
      })),
      // F&B (7)
      ...Array.from({ length: 7 }, (_, i) => ({
        name: `Chef F&B ${i + 1}`,
        department: 'fnb',
        role: i < 2 ? 'Sous Chef' : 'Line Cook',
        skills: ['Grill', 'Prep', 'Inventory'],
        cross_trained: [],
        shift_start: '11:00',
        shift_end: '22:00',
        is_available: i !== 6,
        fatigue_score: 30 + i * 5,
        hourly_rate: 24
      })),
      // Maintenance (4)
      ...Array.from({ length: 4 }, (_, i) => ({
        name: `Tech Maintenance ${i + 1}`,
        department: 'maintenance',
        role: 'Engineering Specialist',
        skills: ['HVAC', 'Plumbing', 'Electrical'],
        cross_trained: [],
        shift_start: '08:00',
        shift_end: '17:00',
        is_available: true,
        fatigue_score: 35 + i * 5,
        hourly_rate: 26
      })),
      // Spa (3) - 2 cross trained for front desk surge support!
      ...Array.from({ length: 3 }, (_, i) => ({
        name: `Elena Spa ${i + 1}`,
        department: 'spa',
        role: 'Therapist',
        skills: ['Wellness', 'Reception'],
        cross_trained: ['front_desk'],
        shift_start: '09:00',
        shift_end: '18:00',
        is_available: true,
        fatigue_score: 15,
        hourly_rate: 20
      })),
      // Security (3)
      ...Array.from({ length: 3 }, (_, i) => ({
        name: `Officer Security ${i + 1}`,
        department: 'security',
        role: 'Safety Officer',
        skills: ['Surveillance', 'First Aid'],
        cross_trained: [],
        shift_start: '18:00',
        shift_end: '06:00',
        is_available: true,
        fatigue_score: 20,
        hourly_rate: 21
      }))
    ];
    await StaffRoster.insertMany(staffList);

    // 5. Seed 5 Pantry Inventory Items (Hero: Fresh Salmon)
    console.log('Seeding Pantry Inventory...');
    const pantryItems = [
      { item_name: 'Fresh Salmon', category: 'protein', current_stock_kg: 15, safety_threshold_kg: 10, unit_cost: 28, supplier: 'OceanFresh Seafood', lead_time_days: 1, daily_consumption_rate_kg: 3.5 },
      { item_name: 'Organic Avocado', category: 'produce', current_stock_kg: 20, safety_threshold_kg: 8, unit_cost: 6, supplier: 'Valley Greens', lead_time_days: 2, daily_consumption_rate_kg: 2.2 },
      { item_name: 'French Butter', category: 'dairy', current_stock_kg: 30, safety_threshold_kg: 10, unit_cost: 9, supplier: 'EuroDairy', lead_time_days: 3, daily_consumption_rate_kg: 4.0 },
      { item_name: 'Champagne Reserve', category: 'beverage', current_stock_kg: 50, safety_threshold_kg: 15, unit_cost: 55, supplier: 'Vineyard Direct', lead_time_days: 4, daily_consumption_rate_kg: 6.0 },
      { item_name: 'Prime Ribeye Steak', category: 'protein', current_stock_kg: 25, safety_threshold_kg: 8, unit_cost: 38, supplier: 'Prime Meats Ltd', lead_time_days: 2, daily_consumption_rate_kg: 4.5 }
    ];
    await PantryInventory.insertMany(pantryItems);

    // 6. Seed 5 Maintenance Assets
    console.log('Seeding Maintenance Assets...');
    const assets = [
      { asset_id: 'HVAC-01', name: 'Rooftop Chiller Unit A', location: 'Main Roof', type: 'HVAC', condition_score: 74, anomaly_score: 0.32, failure_risk: 'medium' },
      { asset_id: 'ELEV-01', name: 'Guest Elevator Bank A', location: 'Lobby Core', type: 'elevator', condition_score: 88, anomaly_score: 0.08, failure_risk: 'low' },
      { asset_id: 'KIT-01', name: 'Walk-In Deep Freezer', location: 'Main Kitchen', type: 'kitchen', condition_score: 42, anomaly_score: 0.76, failure_risk: 'high' },
      { asset_id: 'BOIL-01', name: 'Central Water Boiler', location: 'Basement Utility', type: 'plumbing', condition_score: 80, anomaly_score: 0.15, failure_risk: 'low' },
      { asset_id: 'HVAC-02', name: 'Lobby Fresh Air Unit', location: 'East Wing', type: 'HVAC', condition_score: 82, anomaly_score: 0.12, failure_risk: 'low' }
    ];
    await MaintenanceAsset.insertMany(assets);

    // 7. Seed 1 Active Weather World Signal
    console.log('Seeding World Weather Signal...');
    await WorldSignal.create({
      signal_type: 'weather',
      source: 'synthetic',
      severity: 0.72,
      data: {
        condition: 'Severe Coastal Storm',
        wind_gusts_kmh: 65,
        precipitation_mm: 45,
        forecast_duration_hours: 12
      },
      affected_departments: ['housekeeping', 'fnb', 'front_desk', 'maintenance'],
      expected_impact: 'High indoor dining surge, outdoor patio closure, check-in arrival delays.'
    });

    // 8. Seed 2 Operational Tickets
    console.log('Seeding Initial Tickets...');
    await OperationalTicket.insertMany([
      {
        ticket_id: 'TKT-0001',
        title: 'AC unit rattling and leaking',
        description: 'Guest reported noise and slight condensation leakage in Room 204.',
        department: 'maintenance',
        priority: 'High',
        status: 'todo',
        source: 'review',
        room_number: '204',
        evidence_terms: ['rattling', 'leaking', 'AC']
      },
      {
        ticket_id: 'TKT-0002',
        title: 'Elevator door delay calibration',
        description: 'Elevator Bank A sensor hesitation on Floor 3.',
        department: 'maintenance',
        priority: 'Medium',
        status: 'in_progress',
        source: 'system',
        evidence_terms: ['sensor', 'delay']
      }
    ]);

    console.log('\n=========================================');
    console.log('🎉 SMART RESORT 360 SEEDED SUCCESSFULLY');
    console.log('=========================================');
    console.log('• Rooms: 50 (Occupancy: 82%)');
    console.log('• Bookings: 41 Active');
    console.log('• Staff: 30 Across 6 Departments');
    console.log('• Pantry Items: 5 Active Inventory Streams');
    console.log('• Assets: 5 Monitored Hardware Assets');
    console.log('• World Signals: 1 Active Storm Alert');
    console.log('• Tickets: 2 Active Work Orders');
    console.log('=========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

seedDatabase();