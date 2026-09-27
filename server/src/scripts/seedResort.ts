import 'dotenv/config';
import mongoose from 'mongoose';
import { Room } from '../models/Room';
import { Booking } from '../models/Booking';
import { StaffRoster } from '../models/StaffRoster';
import { PantryInventory } from '../models/PantryInventory';
import { MaintenanceAsset } from '../models/MaintenanceAsset';
import { WorldSignal } from '../models/WorldSignal';
import { OperationalTicket } from '../models/OperationalTicket';
import { GuestRequest } from '../models/GuestRequest';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import { BCRYPT_SALT_ROUNDS, ROLES } from '../config/constants';
async function seed() {
  try {
    console.log('🌱 Starting Digital Twin seed...');

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // Clear collections
    await User.deleteMany({});
    await Room.deleteMany({});
    await Booking.deleteMany({});
    await StaffRoster.deleteMany({});
    await PantryInventory.deleteMany({});
    await MaintenanceAsset.deleteMany({});
    await WorldSignal.deleteMany({});
    await OperationalTicket.deleteMany({});
    
    console.log('🗑️  Cleared existing digital twin data');

    // 1. Seed Rooms
    const rooms = [];
    
    for (let floor = 1; floor <= 5; floor++) {
      for (let i = 0; i < 10; i++) {
        const roomNumber = `${floor}${String(i + 1).padStart(2, '0')}`;
        
        let type = 'Standard';
        let rate = 150;
        
        if (i >= 6 && i < 9) {
          type = 'Deluxe';
          rate = 250;
        } else if (i === 9) {
          type = 'Suite';
          rate = 450;
        }
        
        rooms.push({
          room_number: roomNumber,
          type,
          status: 'available',
          rate_per_night: rate,
          floor
        });
      }
    }
    
    // Set statuses: 41 occupied, 4 available, 3 cleaning, 2 maintenance
    for (let i = 0; i < 41; i++) {
      rooms[i].status = 'occupied';
    }
    for (let i = 41; i < 44; i++) {
      rooms[i].status = 'cleaning';
    }
    for (let i = 44; i < 46; i++) {
      rooms[i].status = 'maintenance';
    }
    // remaining 4 are available

    await Room.insertMany(rooms);
    console.log(`✅ Seeded 50 Rooms`);

    // 2. Seed Bookings
    const bookings = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    for (let i = 0; i < 41; i++) {
      const room = rooms[i];
      const checkIn = i % 2 === 0 ? today : yesterday;
      
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + (i % 5) + 1); // 1-5 days
      
      bookings.push({
        guest_name: `Guest ${room.room_number}`,
        room_number: room.room_number,
        check_in: checkIn,
        check_out: checkOut,
        status: 'checked-in',
        guests_count: (i % 4) + 1, // 1-4 guests
        rate_locked: room.rate_per_night,
        source: 'direct'
      });
    }

    await Booking.insertMany(bookings);
    console.log(`✅ Seeded 41 Bookings`);

    // 3. Seed Staff
    const staffDepts = [
      { name: 'housekeeping', count: 8 },
      { name: 'front_desk', count: 5 },
      { name: 'fnb', count: 7 },
      { name: 'maintenance', count: 4 },
      { name: 'spa', count: 3 },
      { name: 'security', count: 3 }
    ];

    const staffMembers: any[] = [];
    for (const dept of staffDepts) {
      for (let i = 0; i < dept.count; i++) {
        const prefix = dept.name === 'front_desk' ? 'FD' : dept.name === 'fnb' ? 'FNB' : dept.name.charAt(0).toUpperCase();
        
        staffMembers.push({
          name: `Staff ${prefix}${i + 1}`,
          department: dept.name,
          skills: [],
          cross_trained: [],
          fatigue_score: Math.floor(Math.random() * 46) + 15, // 15-60
          hourly_rate: Math.floor(Math.random() * 11) + 15, // 15-25
          is_available: true
        });
      }
    }
    
    // Cross train 2 spa staff for front_desk
    const spaStaff = staffMembers.filter(s => s.department === 'spa');
    if (spaStaff.length >= 2) {
      spaStaff[0].cross_trained.push('front_desk');
      spaStaff[1].cross_trained.push('front_desk');
    }

    // Set 2 sick/off-duty
    staffMembers[4].is_available = false;
    staffMembers[10].is_available = false;

    // We will save staffMembers later after creating GuestRequests

    // 4. Seed Pantry
    await PantryInventory.insertMany([
      { item_name: 'Fresh Salmon', current_stock_kg: 15, safety_threshold_kg: 10, daily_consumption_rate_kg: 3, unit_cost: 25, supplier: 'OceanFresh' },
      { item_name: 'Avocado', current_stock_kg: 20, safety_threshold_kg: 8, daily_consumption_rate_kg: 2, unit_cost: 8, supplier: 'GreenValley' },
      { item_name: 'Butter', current_stock_kg: 30, safety_threshold_kg: 10, daily_consumption_rate_kg: 4, unit_cost: 6, supplier: 'DairyCo' },
      { item_name: 'Champagne', current_stock_kg: 50, safety_threshold_kg: 15, daily_consumption_rate_kg: 8, unit_cost: 40, supplier: 'VineyardDirect' },
      { item_name: 'Steak', current_stock_kg: 25, safety_threshold_kg: 8, daily_consumption_rate_kg: 5, unit_cost: 35, supplier: 'PrimeMeats' }
    ]);
    console.log(`✅ Seeded 5 Pantry Items`);

    // 5. Seed Maintenance Assets
    await MaintenanceAsset.insertMany([
      { asset_id: 'HVAC-Roof', name: 'HVAC Roof Unit', type: 'HVAC', condition_score: 72, anomaly_score: 0.3, failure_risk: 'medium', sensor_readings: { temperature: 45, vibration: 0.2 } },
      { asset_id: 'Elevator-Main', name: 'Main Lobby Elevator', type: 'elevator', condition_score: 85, anomaly_score: 0.1, failure_risk: 'low', sensor_readings: { vibration: 0.05 } },
      { asset_id: 'Kitchen-WalkIn', name: 'Walk-in Freezer', type: 'kitchen', condition_score: 45, anomaly_score: 0.7, failure_risk: 'high', sensor_readings: { temperature: 5, humidity: 85 } },
      { asset_id: 'Boiler-Basement', name: 'Basement Boiler', type: 'plumbing', condition_score: 78, anomaly_score: 0.2, failure_risk: 'low', sensor_readings: { pressure: 120 } },
      { asset_id: 'AC-Lobby', name: 'Lobby AC', type: 'HVAC', condition_score: 80, anomaly_score: 0.15, failure_risk: 'low', sensor_readings: { temperature: 22 } }
    ]);
    console.log(`✅ Seeded 5 Maintenance Assets`);

    // 6. Seed World Signal
    await WorldSignal.create({
      signal_type: 'weather',
      severity: 0.7,
      data: { condition: 'Storm approaching', temperature: 18, wind_speed: 45, precipitation: 80 },
      affected_departments: ['front_desk', 'fnb', 'maintenance', 'housekeeping', 'spa', 'security'],
      expected_impact: 'Expected arrival delays, outdoor dining closure, increased indoor service demand',
      is_active: true
    });
    console.log(`✅ Seeded 1 World Signal`);

    // 7. Seed Operational Tickets
    await OperationalTicket.insertMany([
      { ticket_id: 'TKT-0001', title: 'AC rattling Room 204', department: 'maintenance', priority: 'High', status: 'todo', source: 'review', room_number: '204', evidence_terms: ['rattling', 'leaking'] },
      { ticket_id: 'TKT-0002', title: 'Elevator slow response', department: 'maintenance', priority: 'Medium', status: 'in_progress', source: 'guest_request' }
    ]);
    console.log(`✅ Seeded 2 Operational Tickets`);

    // 8. Seed Guest Requests
    const req1 = await GuestRequest.create({
      guest_name: 'Guest 105', room_number: '105', request_text: 'I need an extra towel please',
      intent: 'TOWEL', priority: 'LOW', autonomy_level: 'AUTO', department: 'housekeeping',
      status: 'ASSIGNED', assigned_staff: staffMembers[0].name
    });
    const req2 = await GuestRequest.create({
      guest_name: 'Guest 204', room_number: '204', request_text: 'The AC in my room is making a terrible noise',
      intent: 'AC', priority: 'MEDIUM', autonomy_level: 'SUPERVISOR', department: 'maintenance',
      status: 'CLASSIFIED'
    });
    const req3 = await GuestRequest.create({
      guest_name: 'Guest 112', room_number: '112', request_text: 'Can I get two more pillows?',
      intent: 'PILLOW', priority: 'LOW', autonomy_level: 'AUTO', department: 'housekeeping',
      status: 'ASSIGNED', assigned_staff: staffMembers[1].name
    });

    staffMembers[0].task_status = 'assigned';
    staffMembers[0].current_task_id = req1.request_id;
    staffMembers[1].task_status = 'assigned';
    staffMembers[1].current_task_id = req3.request_id;
    
    const savedStaffRoster = await StaffRoster.insertMany(staffMembers);
    console.log(`✅ Seeded 30 Staff with updated task statuses`);
    console.log(`✅ Seeded 3 Guest Requests`);

    // 9. Seed Demo Users
    const defaultPassword = await bcrypt.hash('demo123', BCRYPT_SALT_ROUNDS);

    await User.insertMany([
      {
        name: 'Manager',
        email: 'manager@smartresort.demo',
        passwordHash: defaultPassword,
        role: ROLES.MANAGER,
        isActive: true,
      },
      {
        name: 'Housekeeping Supervisor',
        email: 'housekeeping.supervisor@smartresort.demo',
        passwordHash: defaultPassword,
        role: ROLES.SUPERVISOR,
        department: 'Housekeeping',
        isActive: true,
      },
      {
        name: 'Maintenance Supervisor',
        email: 'maintenance.supervisor@smartresort.demo',
        passwordHash: defaultPassword,
        role: ROLES.SUPERVISOR,
        department: 'Maintenance',
        isActive: true,
      },
      {
        name: 'Staff H1',
        email: 'housekeeper@smartresort.demo',
        passwordHash: defaultPassword,
        role: ROLES.WORKER,
        department: 'Housekeeping',
        staffId: savedStaffRoster.find(s => s.name === 'Staff H1')?._id,
        isActive: true,
      },
      {
        name: 'Staff M1',
        email: 'technician@smartresort.demo',
        passwordHash: defaultPassword,
        role: ROLES.WORKER,
        department: 'Maintenance',
        staffId: savedStaffRoster.find(s => s.name === 'Staff M1')?._id,
        isActive: true,
      },
      {
        name: 'Guest 105',
        email: 'guest@smartresort.demo',
        passwordHash: defaultPassword,
        role: ROLES.GUEST,
        guestRoomNumber: '105',
        bookingReference: 'BK-RESORT-105',
        isActive: true,
      },
      {
        name: 'Vendor Provider',
        email: 'vendor@smartresort.demo',
        passwordHash: defaultPassword,
        role: ROLES.VENDOR_MANAGER,
        department: 'Vendor Management',
        isActive: true,
      }
    ]);
    console.log(`✅ Seeded 7 Demo Users (Password: demo123)`);



    console.log('');
    console.log('🎉 Digital Twin seed completed successfully!');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seed();
