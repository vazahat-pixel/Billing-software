const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        enum: ['user', 'super_admin'],
        default: 'user'
    },
    companyRole: {
        type: String,
        enum: ['owner', 'admin', 'manager', 'accountant', 'salesman', 'sales', 'viewer'],
        default: 'owner'
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        default: null
    },
    isActive: { type: Boolean, default: true },
    // Stage 7.1 — brute-force / lockout
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastFailedLoginAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: '' },
    // Password reset fields
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > new Date());
};

module.exports = mongoose.model('User', userSchema);

