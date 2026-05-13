const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const License = require('../models/License');

const subscriptionMiddleware = async (req, res, next) => {
    // Skip check for super admins or in development environment
    if ((req.user && req.user.role === 'super_admin') || process.env.NODE_ENV === 'development') {
        if (req.user && req.user.companyId) {
            try {
                const company = await Company.findById(req.user.companyId);
                if (company) req.planId = company.planId;
            } catch (e) {
                // Ignore database issues for dev fallback
            }
        }
        return next();
    }

    try {
        if (!req.user.companyId) {
            return res.status(403).json({ message: 'User is not associated with any company' });
        }

        const company = await Company.findById(req.user.companyId);
        if (!company || !company.isActive || company.status === 'suspended') {
            return res.status(403).json({ message: 'Account locked or inactive. Please contact support.' });
        }

        const subscription = await Subscription.findOne({ companyId: req.user.companyId });
        if (!subscription || subscription.status !== 'active' || new Date() > subscription.endDate) {
            return res.status(402).json({ message: 'Subscription expired or inactive' });
        }

        const license = await License.findOne({ companyId: req.user.companyId, isActive: true });
        if (!license || new Date() > license.expiresAt) {
            return res.status(403).json({ message: 'License key invalid or expired' });
        }

        // Attach plan to request for feature gating
        req.planId = company.planId;
        
        next();
    } catch (err) {
        res.status(500).json({ message: 'Subscription check failed', error: err.message });
    }
};

module.exports = subscriptionMiddleware;
