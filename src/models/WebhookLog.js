const BaseModel = require('./BaseModel');

class WebhookLog extends BaseModel {
  constructor() {
    super('webhook_logs');
  }

  async getAllPaginated(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const total = await this.count();
    const rows = await this.findAll('1=1', [], 'id DESC', limit, offset);
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}

module.exports = new WebhookLog();
