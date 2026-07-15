const AuditLog = require('../models/AuditLog');

class AuditService {
    async log(req, action, module, referenceId = null, before = null, after = null, reason = '') {
        try {
            if (!req?.user && !req?.companyId) return;

            const log = new AuditLog({
                userId: req.user?._id || req.user?.id,
                companyId: req.user?.companyId || req.companyId,
                action,
                module,
                referenceId,
                before,
                after,
                reason: reason || '',
                requestId: req.headers?.['x-request-id'] || req.requestId || '',
                ip: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers?.['user-agent']
            });

            await log.save();
        } catch (error) {
            console.error('Audit Log Failed:', error.message || error);
        }
    }

    /** System/service-context audit without Express req */
    async logSystem({ companyId, userId, action, module, referenceId, before, after, reason }) {
        try {
            await AuditLog.create({
                companyId,
                userId: userId || null,
                action,
                module,
                referenceId,
                before,
                after,
                reason: reason || '',
            });
        } catch (error) {
            console.error('Audit Log Failed:', error.message || error);
        }
    }
}

module.exports = new AuditService();
