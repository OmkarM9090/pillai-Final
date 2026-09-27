require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Find a manager user
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ role: { $in: ['MANAGER', 'GENERAL_MANAGER'] } });
  
  if (!user) {
    console.log("No manager user found.");
    process.exit(1);
  }

  const token = jwt.sign({ userId: user._id.toString(), role: user.role }, process.env.JWT_SECRET);
  
  const res = await fetch('http://localhost:5000/api/v1/dashboard', { headers: { Authorization: 'Bearer ' + token } });
  const data = await res.json();
  console.log("DASHBOARD DATA:", JSON.stringify(data, null, 2));
  
  const res2 = await fetch('http://localhost:5000/api/v1/tickets', { headers: { Authorization: 'Bearer ' + token } });
  const data2 = await res2.json();
  console.log("TICKETS DATA:", JSON.stringify(data2, null, 2));

  process.exit(0);
})();
