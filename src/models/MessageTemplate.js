const BaseModel = require('./BaseModel');

class MessageTemplate extends BaseModel {
  constructor() {
    super('message_templates');
  }

  async findAll() {
    return this.query('SELECT * FROM message_templates ORDER BY id DESC');
  }

  async getAllPaginated(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [countResult] = await this.query('SELECT COUNT(*) as total FROM message_templates');
    const total = countResult.total;
    const rows = await this.query('SELECT * FROM message_templates ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
    return { rows, page, totalPages: Math.ceil(total / limit), total };
  }
}

module.exports = new MessageTemplate();
