const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = 'qa.dev.admin@textileerp.dev';
    const password = 'QaTenant@123';

    // Get user from DB
    const user = await User.findOne({email});

    if (!user) {
      console.log('User not found!');
      process.exit(1);
    }

    console.log('User found:', email);
    console.log('Stored password hash:', user.password);

    // Test if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password matches?', isMatch);

    if (!isMatch) {
      console.log('\n❌ Password mismatch! Resetting password...');
      const newHash = await bcrypt.hash(password, 10);
      user.password = newHash;
      await user.save();
      console.log('✅ Password reset!');

      // Test again
      const isMatchNow = await bcrypt.compare(password, user.password);
      console.log('Password matches now?', isMatchNow);
    } else {
      console.log('✅ Password is correct!');
    }

    await mongoose.connection.close();
  } catch(e) {
    console.error('Error:', e.message);
  }
})();
