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
        const company = await Company.create(req.body);
        res.status(201).json(company);
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

        res.status(200).json({ 
            totalCompanies, 
            activeSubs, 
            expiringSoon,
            mrr: Math.round(mrr)
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
