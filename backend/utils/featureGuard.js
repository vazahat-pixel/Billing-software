const Plan = require('../models/Plan');

/**
 * Server-side feature guard
 */
exports.checkFeature = async (req, module, field = null) => {
    // Super admin has access to everything
    if (req.user && req.user.role === 'super_admin') return true;

    if (!req.planId) {
        throw new Error("No plan associated with this request");
    }

    const plan = await Plan.findById(req.planId);
    if (!plan) throw new Error("Plan not found");

    if (!plan.features.modules[module]) {
        throw new Error(`Module '${module}' not allowed in your current plan`);
    }

    if (field && !plan.features.fields[module]?.[field]) {
        throw new Error(`Field '${field}' not allowed in your current plan`);
    }

    return true;
};
