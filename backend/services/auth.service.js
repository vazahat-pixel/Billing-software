const User = require('../models/User');
const Company = require('../models/Company');
const Plan = require('../models/Plan');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id, 
            role: user.role, 
            companyId: user.companyId 
        }, 
        process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', 
        { expiresIn: '30d' }
    );
};

exports.register = async (name, email, password, companyName) => {
    // 1. Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error('Email already registered');

    // 2. Get Default Plan (Basic)
    let plan = await Plan.findOne({ name: 'Basic' });
    if (!plan) {
        // Seed Basic plan if it doesn't exist
        plan = await Plan.create({
            name: 'Basic',
            price: 29,
            features: { purchase: true, inventory: true, jobWork: false, gst: false, reports: false }
        });
    }

    // 3. Create User (Role: user)
    const user = new User({ name, email, password, role: 'user' });
    await user.save();

    // 4. Create Company
    const company = new Company({
        name: companyName,
        ownerId: user._id,
        planId: plan._id
    });
    await company.save();

    // Pre-seed system ledgers on company creation
    const accountingService = require('./accountingService');
    try {
        await accountingService.seedSystemLedgers(company._id);
    } catch (seedErr) {
        console.error('Failed to auto seed company system ledgers:', seedErr);
    }

    // 5. Update User with companyId
    user.companyId = company._id;
    await user.save();

    const token = generateToken(user);
    return { token, user: { id: user._id, name: user.name, role: user.role, companyId: user.companyId } };
};

exports.login = async (email, password) => {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
        throw new Error('Invalid credentials');
    }

    if (!user.isActive) throw new Error('Account deactivated');

    const token = generateToken(user);
    
    // Fetch company/plan details for user
    let company = null;
    if (user.role === 'user' && user.companyId) {
        company = await Company.findById(user.companyId).populate('planId');
    }

    return { 
        token, 
        user: { 
            id: user._id, 
            name: user.name, 
            role: user.role, 
            companyId: user.companyId,
            plan: company?.planId?.features || null
        } 
    };
};
