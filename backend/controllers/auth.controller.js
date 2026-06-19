const authService = require('../services/auth.service');

exports.register = async (req, res) => {
    try {
        const { name, email, password, companyName } = req.body;
        if (!name || !email || !password || !companyName) {
            return res.status(400).json({ message: 'Name, email, password and company name are required' });
        }
        const result = await authService.register(name, email, password, companyName);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }
        const result = await authService.login(email, password);
        res.status(200).json(result);
    } catch (err) {
        res.status(401).json({ message: err.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        const User = require('../models/User');
        const Company = require('../models/Company');
        const CompanyModuleConfig = require('../models/CompanyModuleConfig');
        const CompanySettings = require('../models/CompanySettings');
        
        const user = req.user;
        let planFeatures = null;
        let companyInfo = null;
        let moduleConfig = null;
        let settings = null;

        let resolvedCompanyId = user.companyId;
        if (user.role === 'user' && user.companyId) {
            const company = await Company.findById(user.companyId).populate('planId');
            planFeatures = company?.planId?.features || null;
            companyInfo = company ? { name: company.name, status: company.status } : null;

            moduleConfig = await CompanyModuleConfig.findOne({ companyId: user.companyId });
            if (!moduleConfig) {
                moduleConfig = await CompanyModuleConfig.create({ companyId: user.companyId });
            }

            settings = await CompanySettings.findOne({ companyId: user.companyId });
            if (!settings) {
                settings = await CompanySettings.create({
                    companyId: user.companyId,
                    legalName: company.name
                });
            }
        } else if (user.role === 'super_admin') {
            const company = await Company.findOne().sort({ createdAt: 1 }).populate('planId');
            if (company) {
                resolvedCompanyId = company._id;
                planFeatures = company?.planId?.features || null;
                companyInfo = { name: company.name, status: company.status };
                moduleConfig = await CompanyModuleConfig.findOne({ companyId: company._id });
                settings = await CompanySettings.findOne({ companyId: company._id });
            }
        }

        res.status(200).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                companyRole: user.companyRole || 'owner',
                companyId: resolvedCompanyId || req.companyId,
                plan: planFeatures,
                company: companyInfo,
                moduleConfig: moduleConfig,
                settings: settings
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });
        const result = await authService.forgotPassword(email);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ message: 'Token and new password are required' });
        const result = await authService.resetPassword(token, password);
        res.status(200).json(result);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

