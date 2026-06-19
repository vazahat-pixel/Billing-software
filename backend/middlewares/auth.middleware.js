const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Attach user and companyId to request object
        req.user = user;
        req.companyId = user.companyId;

        // Super admin has no tenant — use first company for ERP data APIs
        if (!req.companyId && user.role === 'super_admin') {
            const Company = require('../models/Company');
            const fallback = await Company.findOne().sort({ createdAt: 1 });
            if (fallback) {
                req.companyId = fallback._id;
                req.superAdminTenant = true;
            }
        }

        if (req.companyId) {
            const Company = require('../models/Company');
            const company = await Company.findById(req.companyId);
            if (company) {
                req.planId = company.planId;
                req.companyStatus = company.status;
                if (company.status === 'suspended') {
                    return res.status(403).json({ message: 'Your company account is suspended. Please contact support.' });
                }
            }
        }

        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
