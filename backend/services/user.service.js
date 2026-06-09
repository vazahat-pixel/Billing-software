const User = require('../models/User');
const Company = require('../models/Company');

const MANAGER_ROLES = ['owner', 'admin'];

class UserService {
  canManageUsers(requester) {
    return MANAGER_ROLES.includes(requester.companyRole || 'owner');
  }

  async listUsers(companyId) {
    return User.find({ companyId, role: 'user' })
      .select('-password')
      .sort({ createdAt: 1 });
  }

  async createUser(companyId, data, requester) {
    if (!this.canManageUsers(requester)) {
      throw new Error('You do not have permission to manage users.');
    }

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) throw new Error('Email already registered');

    const company = await Company.findById(companyId).populate('planId');
    const userLimit = company?.planId?.limits?.users || 5;
    const currentCount = await User.countDocuments({ companyId, role: 'user', isActive: true });
    if (currentCount >= userLimit) {
      throw new Error(`User limit reached (${userLimit}). Upgrade your plan to add more users.`);
    }

    const user = new User({
      name: data.name,
      email: data.email,
      password: data.password,
      role: 'user',
      companyId,
      companyRole: data.companyRole || 'sales',
      isActive: true
    });
    await user.save();

    const result = user.toObject();
    delete result.password;
    return result;
  }

  async updateUser(userId, companyId, data, requester) {
    if (!this.canManageUsers(requester)) {
      throw new Error('You do not have permission to manage users.');
    }

    const user = await User.findOne({ _id: userId, companyId, role: 'user' });
    if (!user) throw new Error('User not found');

    if (user.companyRole === 'owner' && requester.companyRole !== 'owner') {
      throw new Error('Only the company owner can modify the owner account.');
    }

    if (data.name) user.name = data.name;
    if (data.companyRole) user.companyRole = data.companyRole;
    if (typeof data.isActive === 'boolean') user.isActive = data.isActive;
    if (data.password) user.password = data.password;

    await user.save();
    const result = user.toObject();
    delete result.password;
    return result;
  }

  async deactivateUser(userId, companyId, requester) {
    if (!this.canManageUsers(requester)) {
      throw new Error('You do not have permission to manage users.');
    }

    const user = await User.findOne({ _id: userId, companyId, role: 'user' });
    if (!user) throw new Error('User not found');
    if (user.companyRole === 'owner') throw new Error('Cannot deactivate the company owner.');

    user.isActive = false;
    await user.save();
    return { message: 'User deactivated' };
  }
}

module.exports = new UserService();
