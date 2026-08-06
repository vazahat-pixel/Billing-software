const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find().select('email name role').limit(3);
    console.log('\n=== SEEDED USERS ===');
    users.forEach((u, i) => {
      console.log(`${i+1}. Email: ${u.email} | Name: ${u.name} | Role: ${u.role}`);
    });
    console.log('\nPassword: (check seedUsers.js for default seed password)');
    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
