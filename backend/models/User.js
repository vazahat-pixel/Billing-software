const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true 
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
        enum: ['owner', 'admin', 'accountant', 'sales', 'viewer'],
        default: 'owner'
    },
    companyId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Company',
        default: null 
    },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
