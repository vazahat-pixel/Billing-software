const crypto = require('crypto');

/**
 * Generates a license key in format CMP-XXXX-YYYY
 * XXXX is random hex, YYYY is a checksum
 */
exports.generateLicenseKey = (companyId) => {
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    const data = `${companyId}-${random}`;
    const checksum = crypto.createHash('sha256').update(data + process.env.JWT_SECRET).digest('hex').substring(0, 4).toUpperCase();
    return `CMP-${random}-${checksum}`;
};

/**
 * Validates a license key
 */
exports.validateLicenseKey = (key, companyId) => {
    if (!key || !key.startsWith('CMP-')) return false;
    const parts = key.split('-');
    if (parts.length !== 3) return false;
    
    const random = parts[1];
    const providedChecksum = parts[2];
    
    const data = `${companyId}-${random}`;
    const expectedChecksum = crypto.createHash('sha256').update(data + process.env.JWT_SECRET).digest('hex').substring(0, 4).toUpperCase();
    
    return providedChecksum === expectedChecksum;
};
