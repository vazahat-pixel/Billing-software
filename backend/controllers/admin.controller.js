const User = require('../models/User');
const Company = require('../models/Company');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const License = require('../models/License');
const Usage = require('../models/Usage');
const AuditLog = require('../models/AuditLog');
const { generateLicenseKey } = require('../utils/license');

// COMPANIES
exports.getAllCompanies = async (req, res) => {
    try {
        const companies = await Company.find()
            .populate('ownerId', 'name email')
            .populate('planId');
        res.status(200).json(companies);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createCompany = async (req, res) => {
    try {
        const { name, ownerName, ownerEmail, ownerPassword, planId } = req.body;
        
        // 1. Validate ownerEmail
        const existingUser = await User.findOne({ email: ownerEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'Owner email is already registered.' });
        }

        // 2. Create User
        const user = new User({
            name: ownerName,
            email: ownerEmail,
            password: ownerPassword,
            role: 'user',
            companyRole: 'owner'
        });
        await user.save();

        // 3. Create Company
        const company = new Company({
            name,
            ownerId: user._id,
            planId
        });
        await company.save();

        // 4. Update User with companyId
        user.companyId = company._id;
        await user.save();

        // 5. Seed system ledgers
        const accountingService = require('../services/accountingService');
        const configService = require('../services/configService');
        try {
            await accountingService.seedSystemLedgers(company._id);
            await configService.seedCompanyDefaults(company._id, user._id);
            await require('../models/CompanySettings').findOneAndUpdate(
              { companyId: company._id },
              { legalName: name },
              { upsert: true }
            );
        } catch (seedErr) {
            console.error('Failed to seed company defaults during admin company creation:', seedErr);
        }

        // 6. Create default active Subscription
        const trialStart = new Date();
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);
        await Subscription.create({
            companyId: company._id,
            planId,
            status: 'active',
            startDate: trialStart,
            endDate: trialEnd,
            billingCycle: 'monthly',
            autoRenew: false
        });

        // 7. Create License
        const crypto = require('crypto');
        const key = generateLicenseKey(company._id);
        const licenseChecksum = crypto.createHash('sha256')
            .update(`${company._id}-TRIAL`)
            .digest('hex')
            .substring(0, 8)
            .toUpperCase();
        await License.create({
            companyId: company._id,
            licenseKey: key,
            expiresAt: trialEnd,
            isActive: true,
            checksum: licenseChecksum
        });

        company.licenseKey = key;
        await company.save();

        // Return populated company
        const populated = await Company.findById(company._id)
            .populate('ownerId', 'name email')
            .populate('planId');

        res.status(201).json(populated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Company.findByIdAndUpdate(id, req.body, { new: true });
        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.lockCompany = async (req, res) => {
    try {
        const company = await Company.findByIdAndUpdate(req.params.id, { status: 'suspended' }, { new: true });
        res.status(200).json(company);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.unlockCompany = async (req, res) => {
    try {
        const company = await Company.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
        res.status(200).json(company);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PLANS
exports.getAllPlans = async (req, res) => {
    try {
        const plans = await Plan.find();
        res.status(200).json(plans);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createPlan = async (req, res) => {
    try {
        const plan = await Plan.create(req.body);
        res.status(201).json(plan);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await Plan.findByIdAndUpdate(id, req.body, { new: true });
        res.status(200).json(plan);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deletePlan = async (req, res) => {
    try {
        await Plan.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Plan deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// SUBSCRIPTIONS
exports.getAllSubscriptions = async (req, res) => {
    try {
        const subs = await Subscription.find().populate('companyId').populate('planId');
        res.status(200).json(subs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateSubscription = async (req, res) => {
    try {
        const { companyId } = req.params;
        const updated = await Subscription.findOneAndUpdate({ companyId }, req.body, { new: true, upsert: true });
        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// LICENSE
exports.generateLicense = async (req, res) => {
    try {
        const { companyId, expiresAt } = req.body;
        const key = generateLicenseKey(companyId);
        
        const license = await License.create({
            companyId,
            licenseKey: key,
            expiresAt,
            checksum: 'CHECKSUM_PLACEHOLDER' // Ideally actual checksum
        });
        
        await Company.findByIdAndUpdate(companyId, { licenseKey: key });
        
        res.status(201).json(license);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.renewLicense = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { expiresAt } = req.body;
        const license = await License.findOneAndUpdate(
            { companyId }, 
            { expiresAt, isActive: true }, 
            { new: true }
        );
        res.status(200).json(license);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// USAGE
exports.getUsage = async (req, res) => {
    try {
        const { companyId, period } = req.query;
        const query = {};
        if (companyId) query.companyId = companyId;
        if (period) query.period = period;
        
        const usage = await Usage.find(query).populate('companyId');
        res.status(200).json(usage);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// AUDIT
exports.getAuditLogs = async (req, res) => {
    try {
        const { companyId, module } = req.query;
        const query = {};
        if (companyId) query.companyId = companyId;
        if (module) query.module = module;
        
        const logs = await AuditLog.find(query)
            .populate('userId', 'name email')
            .populate('companyId', 'name')
            .sort({ createdAt: -1 })
            .limit(100);
        res.status(200).json(logs);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DASHBOARD STATS
exports.getAdminStats = async (req, res) => {
    try {
        const totalCompanies = await Company.countDocuments();
        const activeSubs = await Subscription.countDocuments({ status: 'active' });
        const expiringSoon = await Subscription.countDocuments({ 
            status: 'active', 
            endDate: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } 
        });
        
        // MRR Calculation
        const monthlyPlans = await Subscription.find({ status: 'active', billingCycle: 'monthly' }).populate('planId');
        const yearlyPlans = await Subscription.find({ status: 'active', billingCycle: 'yearly' }).populate('planId');
        
        const mrr = monthlyPlans.reduce((acc, sub) => acc + (sub.planId?.priceMonthly || 0), 0) +
                    yearlyPlans.reduce((acc, sub) => acc + ((sub.planId?.priceYearly || 0) / 12), 0);

        // Fetch Plan Distribution
        const plans = await Plan.find();
        const planDistribution = [];
        for (const p of plans) {
            const count = await Company.countDocuments({ planId: p._id });
            planDistribution.push({ name: p.name, count });
        }

        // 6 months historical MRR trend
        const revenueTrend = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = monthNames[date.getMonth()];
            
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
            const activeInMonth = await Subscription.find({
                startDate: { $lte: endOfMonth },
                endDate: { $gte: date }
            }).populate('planId');

            const monthlyRev = activeInMonth.reduce((acc, sub) => {
                if (sub.billingCycle === 'monthly') {
                    return acc + (sub.planId?.priceMonthly || 0);
                } else {
                    return acc + ((sub.planId?.priceYearly || 0) / 12);
                }
            }, 0);

            revenueTrend.push({
                month: monthName,
                revenue: Math.round(monthlyRev)
            });
        }

        // Fetch Recent Audit Logs
        const recentLogs = await AuditLog.find()
            .populate('companyId', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        res.status(200).json({ 
            totalCompanies, 
            activeSubs, 
            expiringSoon,
            mrr: Math.round(mrr),
            planDistribution,
            revenueTrend,
            recentLogs
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ─── MODULE CONFIG ───────────────────────────────────────────────────────────
const CompanyModuleConfig = require('../models/CompanyModuleConfig');

exports.getModuleConfig = async (req, res) => {
    try {
        const config = await CompanyModuleConfig.findOne({ companyId: req.params.id });
        if (!config) return res.status(404).json({ message: 'No config found' });
        res.json(config);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.saveModuleConfig = async (req, res) => {
    try {
        const config = await CompanyModuleConfig.findOneAndUpdate(
            { companyId: req.params.id },
            { ...req.body, companyId: req.params.id },
            { new: true, upsert: true }
        );
        res.json(config);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── COMPANY SETTINGS ─────────────────────────────────────────────────────────
const CompanySettings = require('../models/CompanySettings');

exports.getCompanyConfig = async (req, res) => {
    try {
        const settings = await CompanySettings.findOne({ companyId: req.params.id });
        if (!settings) return res.status(404).json({ message: 'No settings found' });
        res.json(settings);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.saveCompanyConfig = async (req, res) => {
    try {
        const settings = await CompanySettings.findOneAndUpdate(
            { companyId: req.params.id },
            { ...req.body, companyId: req.params.id },
            { new: true, upsert: true }
        );
        res.json(settings);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────
exports.getCompanyUsers = async (req, res) => {
    try {
        const users = await User.find({ companyId: req.params.id }).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.addCompanyUser = async (req, res) => {
    try {
        const { name, email, password, companyRole, isActive, companyId } = req.body;
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: 'Email already registered' });
        const user = new User({ name, email, password, role: 'user', companyRole: companyRole || 'accountant', companyId: companyId || req.params.id, isActive: isActive !== undefined ? isActive : true });
        await user.save();
        const saved = user.toObject(); delete saved.password;
        res.status(201).json(saved);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.updateUserRole = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.userId, { companyRole: req.body.companyRole }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.toggleUserActive = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });
        user.isActive = !user.isActive;
        await user.save();
        const saved = user.toObject(); delete saved.password;
        res.json(saved);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteCompanyUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.userId);
        res.json({ message: 'User deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
};
