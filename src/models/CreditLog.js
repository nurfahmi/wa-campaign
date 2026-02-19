const BaseModel = require('./BaseModel');

class CreditLog extends BaseModel {
  constructor() {
    super('credit_logs');
  }

  async getAllPaginated(page = 1, limit = 20, userId = null) {
    const offset = (page - 1) * limit;
    let where = '1=1';
    const params = [];
    if (userId) {
      where += ' AND cl.user_id = ?';
      params.push(userId);
    }
    const [countRows] = await require('../config/database').query(
      `SELECT COUNT(*) as total FROM credit_logs cl WHERE ${where}`, params
    );
    const total = countRows[0].total;
    const rows = await this.query(
      `SELECT cl.*, u.name as user_name
       FROM credit_logs cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE ${where}
       ORDER BY cl.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

module.exports = new CreditLog();
