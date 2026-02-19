const User = require('../models/User');
const Referral = require('../models/Referral');
const CreditLog = require('../models/CreditLog');
const AppError = require('../utils/AppError');
const { generateReferralCode } = require('../utils/helpers');

class UserService {
  async findOrCreateFromGoogle(profile) {
    let user = await User.findByGoogleId(profile.id);
    if (user) return user;

    // Check if email already exists
    user = await User.findByEmail(profile.emails[0].value);
    if (user) {
      await User.update(user.id, { google_id: profile.id });
      return User.findById(user.id);
    }

    const referralCode = generateReferralCode();
    const id = await User.create({
      google_id: profile.id,
      name: profile.displayName,
      email: profile.emails[0].value,
      referral_code: referralCode,
      role: 'user',
    });
    return User.findById(id);
  }

  async processReferral(userId, referralCode) {
    if (!referralCode) return;
    const referrer = await User.findByReferralCode(referralCode);
    if (!referrer || referrer.id === userId) return;

    const existing = await Referral.findByPair(referrer.id, userId);
    if (existing) return;

    await User.update(userId, { referred_by: referrer.id });
    await Referral.create({
      referrer_id: referrer.id,
      referred_user_id: userId,
    });
  }

  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    const referrals = await Referral.getReferralsByUser(userId);
    const dailyJobs = await User.getJobCountToday(userId);
    const hourlyJobs = await User.getJobCountLastHour(userId);
    return { user, referrals, dailyJobs, hourlyJobs };
  }

  async updateProfile(userId, data) {
    const allowed = ['country'];
    const filtered = {};
    for (const key of allowed) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }
    if (Object.keys(filtered).length) {
      await User.update(userId, filtered);
    }
    return User.findById(userId);
  }

  async listUsers(page, limit, search) {
    return User.getAllPaginated(page, limit, search);
  }

  async updateUserAdmin(userId, data) {
    const allowed = ['role', 'status', 'hourly_limit', 'daily_limit', 'referral_percent', 'country'];
    const filtered = {};
    for (const key of allowed) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }
    await User.update(userId, filtered);
    return User.findById(userId);
  }

  async adjustCredit(userId, amount, description) {
    await User.addCredit(userId, amount);
    await CreditLog.create({
      user_id: userId,
      amount,
      type: 'manual_adjust',
      description: description || 'Manual credit adjustment',
    });
    return User.findById(userId);
  }
}

module.exports = new UserService();
