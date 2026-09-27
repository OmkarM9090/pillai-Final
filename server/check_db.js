require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  
  const rooms = await db.collection('rooms').countDocuments();
  const bookings = await db.collection('bookings').countDocuments();
  const staffs = await db.collection('staffrosters').countDocuments();
  const staffs2 = await db.collection('staffs').countDocuments();
  const requests = await db.collection('guestrequests').countDocuments();
  const tickets = await db.collection('operationaltickets').countDocuments();
  
  console.log({ rooms, bookings, staffs, staffs2, requests, tickets });

  process.exit(0);
})();
