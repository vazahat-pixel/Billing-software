const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const License = require('../models/License');
const jwt = require('jsonwebtoken');
const { generateLicenseKey } = require('../utils/license');

// CRITICAL: Fail fast if JWT_SECRET is not set — never allow a fallback
if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
}

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: user.role,
            companyId: user.companyId
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

exports.register = async (name, email, password, companyName) => {
    // 1. Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error('Email already registered');

    // 2. Get Default Plan (Basic) or create it
    let plan = await Plan.findOne({ name: 'Basic' });
    if (!plan) {
        plan = await Plan.create({
            name: 'Basic',
            priceMonthly: 29,
            priceYearly: 290,
            features: {
                modules: { purchase: true, inventory: true, sales: true, jobWork: false, accounting: false, gst: false, reports: false }
            },
            limits: { users: 5, invoicesPerMonth: 100, storageMb: 500 }
        });
    }

    // 3. Create User (Role: user, CompanyRole: owner)
    const user = new User({ name, email, password, role: 'user', companyRole: 'owner' });
    await user.save();

    // 4. Create Company
    const company = new Company({
        name: companyName,
        ownerId: user._id,
        planId: plan._id
    });
    await company.save();

    // 5. Pre-seed system ledgers
    const accountingService = require('./accountingService');
    try {
        await accountingService.seedSystemLedgers(company._id);
    } catch (seedErr) {
        console.error('Failed to auto seed company system ledgers:', seedErr);
    }

    // 6. Update User with companyId
    user.companyId = company._id;
    await user.save();

    // 7. AUTO-CREATE trial Subscription — fixes critical bug where new users were blocked in production
    const trialStart = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30); // 30-day trial

    await Subscription.create({
        companyId: company._id,
        planId: plan._id,
        status: 'active',
        startDate: trialStart,
        endDate: trialEnd,
        billingCycle: 'monthly',
        autoRenew: false
    });

    // 8. AUTO-CREATE trial License — required by subscription middleware
    const licenseKey = generateLicenseKey(company._id);
    const licenseChecksum = crypto.createHash('sha256')
        .update(`${company._id}-TRIAL`)
        .digest('hex')
        .substring(0, 8)
        .toUpperCase();

    await License.create({
        companyId: company._id,
        licenseKey,
        expiresAt: trialEnd,
        isActive: true,
        checksum: licenseChecksum
    });

    // Update company with license key
    await Company.findByIdAndUpdate(company._id, { licenseKey });

    const CompanyModuleConfig = require('../models/CompanyModuleConfig');
    const CompanySettings = require('../models/CompanySettings');
    const configService = require('./configService');

    // Seed full dynamic config bundle (Phase 1)
    const { moduleConfig, settings } = await configService.seedCompanyDefaults(company._id, user._id);
    if (companyName) {
      await CompanySettings.findOneAndUpdate(
        { companyId: company._id },
        { legalName: companyName },
        { new: true }
      );
      settings.legalName = companyName;
    }

    const token = generateToken(user);
    return {
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            companyRole: user.companyRole,
            companyId: user.companyId,
            plan: plan.features || null,
            moduleConfig: moduleConfig,
            settings: settings,
            configVersion: moduleConfig?.version || 1
        }
    };
};

exports.login = async (email, password) => {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
        throw new Error('Invalid credentials');
    }

    if (!user.isActive) throw new Error('Account deactivated. Please contact support.');

    const token = generateToken(user);

    // Fetch company/plan details for user
    let planFeatures = null;
    let companyInfo = null;
    let moduleConfig = null;
    let settings = null;
    let resolvedCompanyId = user.companyId;
    if (user.role === 'user' && user.companyId) {
        const company = await Company.findById(user.companyId).populate('planId');
        planFeatures = company?.planId?.features || null;
        companyInfo = company ? { name: company.name, status: company.status } : null;

        const CompanyModuleConfig = require('../models/CompanyModuleConfig');
        const CompanySettings = require('../models/CompanySettings');
        const configService = require('./configService');

        moduleConfig = await CompanyModuleConfig.findOne({ companyId: user.companyId });
        if (!moduleConfig) {
            await configService.seedCompanyDefaults(user.companyId);
            moduleConfig = await CompanyModuleConfig.findOne({ companyId: user.companyId });
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

            const CompanyModuleConfig = require('../models/CompanyModuleConfig');
            const CompanySettings = require('../models/CompanySettings');
            const configService = require('./configService');

            moduleConfig = await CompanyModuleConfig.findOne({ companyId: company._id });
            if (!moduleConfig) {
                await configService.seedCompanyDefaults(company._id);
                moduleConfig = await CompanyModuleConfig.findOne({ companyId: company._id });
            }

            settings = await CompanySettings.findOne({ companyId: company._id });
            if (!settings) {
                settings = await CompanySettings.create({
                    companyId: company._id,
                    legalName: company.name
                });
            }
        }
    }

    return {
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            companyRole: user.companyRole || 'owner',
            companyId: resolvedCompanyId,
            plan: planFeatures,
            company: companyInfo,
            moduleConfig: moduleConfig,
            settings: settings,
            configVersion: moduleConfig?.version || 1
        }
    };
};

/**
 * Initiates a password reset — generates a token and stores it on the user.
 * The token should be sent via email. Email sending is pluggable (nodemailer, sendgrid, etc.)
 */
exports.forgotPassword = async (email) => {
    const user = await User.findOne({ email });
    // Always return success to prevent user enumeration attacks
    if (!user) return { message: 'If an account exists, a reset link has been sent.' };

    // Generate a secure random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store hashed version in DB
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = resetExpires;
    await user.save({ validateBeforeSave: false });

    // TODO: Send email with resetToken (raw, unhashed)
    // Example: await emailService.sendPasswordReset(email, resetToken);
    console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);

    return { message: 'If an account exists, a reset link has been sent.', devToken: process.env.NODE_ENV === 'development' ? resetToken : undefined };
};

/**
 * Validates a reset token and updates the password.
 */
exports.resetPassword = async (token, newPassword) => {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        passwordResetToken: hashed,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) throw new Error('Password reset token is invalid or has expired.');

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return { message: 'Password has been reset successfully.' };
};

