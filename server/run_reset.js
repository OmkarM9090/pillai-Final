require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const token = require('jsonwebtoken').sign({ userId: (await mongoose.connection.db.collection('users').findOne({ email: 'manager@smartresort.demo' }))._id.toString(), role: 'MANAGER' }, process.env.JWT_SECRET);
  
  const res = await fetch('http://localhost:5000/api/v1/reset-demo', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
  const data = await res.json();
  console.log('RESET DEMO:', data);
  process.exit(0);
})();
