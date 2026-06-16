const AuditLog = require('../models/AuditLog');

class AuditService {
    async log(req, action, module, referenceId = null, before = null, after = null) {
        try {
            if (!req.user) return; // Don't log if no user context

            const log = new AuditLog({
                userId: req.user._id,
                companyId: req.user.companyId || req.companyId,
                action,
                module,
                referenceId,
                before,
                after,
                ip: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers['user-agent']
            });

            await log.save();
        } catch (error) {
            console.error('Audit Log Failed:', error);
            // We usually don't want an audit failure to break the main transaction
        }
    }
}

module.exports = new AuditService();
