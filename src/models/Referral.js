const BaseModel = require('./BaseModel');

class Referral extends BaseModel {
  constructor() {
    super('referrals');
  }

  async findByPair(referrerId, referredUserId) {
    return this.findOne('referrer_id = ? AND referred_user_id = ?', [referrerId, referredUserId]);
  }

  async addBonus(referrerId, referredUserId, amount) {
    return this.execute(
      'UPDATE referrals SET total_bonus_earned = total_bonus_earned + ? WHERE referrer_id = ? AND referred_user_id = ?',
      [amount, referrerId, referredUserId]
    );
  }

  async getReferralsByUser(userId) {
    return this.query(
      `SELECT r.*, u.name as referred_name, u.email as referred_email
       FROM referrals r
       LEFT JOIN users u ON r.referred_user_id = u.id
       WHERE r.referrer_id = ?
       ORDER BY r.id DESC`,
      [userId]
    );
  }
}

module.exports = new Referral();
