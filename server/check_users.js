require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({}).toArray();
  console.log('USERS:', users.map(u => ({ email: u.email, role: u.role })));
  process.exit(0);
})();
