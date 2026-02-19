const BaseModel = require('./BaseModel');

class User extends BaseModel {
  constructor() {
    super('users');
  }

  async findByGoogleId(googleId) {
    return this.findOne('google_id = ?', [googleId]);
  }

  async findByEmail(email) {
    return this.findOne('email = ?', [email]);
  }

  async findByReferralCode(code) {
    return this.findOne('referral_code = ?', [code]);
  }

  async addCredit(userId, amount) {
    return this.execute(
      'UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?',
      [amount, userId]
    );
  }

  async getJobCountToday(userId) {
    const rows = await this.query(
      `SELECT COUNT(*) as cnt FROM jobs WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [userId]
    );
    return rows[0].cnt;
  }

  async getJobCountLastHour(userId) {
    const rows = await this.query(
      `SELECT COUNT(*) as cnt FROM jobs WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [userId]
    );
    return rows[0].cnt;
  }

  async getAllPaginated(page = 1, limit = 20, search = '') {
    const offset = (page - 1) * limit;
    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    const total = await this.count(where, params);
    const rows = await this.findAll(where, params, 'id DESC', limit, offset);
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

module.exports = new User();
