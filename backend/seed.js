const mongoose = require('mongoose');
const User = require('./models/User');
const Plan = require('./models/Plan');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/billing_software');
        console.log('✅ Connected to MongoDB');

        // Create default plans if they don't exist
        const plansCount = await Plan.countDocuments();
        if (plansCount === 0) {
            const defaultPlans = [
                {
                    name: 'Basic',
                    priceMonthly: 999,
                    priceYearly: 9999,
                    features: {
                        modules: { purchase: true, inventory: true, sales: true },
                        fields: { purchase: { broker: false }, sales: { bale: false } }
                    },
                    limits: { users: 2, invoicesPerMonth: 500, storageMb: 1024 }
                },
                {
                    name: 'Pro',
                    priceMonthly: 2999,
                    priceYearly: 29999,
                    features: {
                        modules: { purchase: true, inventory: true, sales: true, jobWork: true, accounting: true, gst: true, reports: true },
                        fields: { purchase: { broker: true, lrNo: true }, sales: { bale: true, weight: true, challan: true } }
                    },
                    limits: { users: 10, invoicesPerMonth: 5000, storageMb: 5120 }
                }
            ];
            await Plan.create(defaultPlans);
            console.log('✅ Default plans created');
        }

        const adminEmail = process.env.ADMIN_EMAIL || 'admin@textileerp.com';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

        const existingAdmin = await User.findOne({ email: adminEmail });
        if (existingAdmin) {
            console.log('ℹ️ Super Admin already exists');
        } else {
            await User.create({
                name: 'Super Admin',
                email: adminEmail,
                password: adminPassword,
                role: 'super_admin'
            });
            console.log('✅ Super Admin created successfully');
        }

        // Create default normal tenant user if they don't exist
        const userEmail = 'user@textileerp.com';
        const existingUser = await User.findOne({ email: userEmail });
        if (existingUser) {
            console.log('ℹ️ Default Test User already exists');
        } else {
            const authService = require('./services/auth.service');
            await authService.register(
                'Test User',
                userEmail,
                'User@123',
                'Acme Textile Mills'
            );
            console.log('✅ Default Test User and Company created successfully');
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
};

seedAdmin();
