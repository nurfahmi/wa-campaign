const BaseModel = require('./BaseModel');

class Campaign extends BaseModel {
  constructor() {
    super('campaigns');
  }

  async findActive(country = null) {
    let where = "status = 'active' AND target_delivered < target_total";
    const params = [];
    if (country) {
      where += ' AND (country_target = ? OR country_target IS NULL)';
      params.push(country);
    }
    return this.findAll(where, params, 'id ASC');
  }

  async incrementAssigned(campaignId) {
    return this.execute(
      'UPDATE campaigns SET target_assigned = target_assigned + 1 WHERE id = ?',
      [campaignId]
    );
  }

  async incrementDelivered(campaignId) {
    return this.execute(
      'UPDATE campaigns SET target_delivered = target_delivered + 1 WHERE id = ?',
      [campaignId]
    );
  }

  async checkCompleted(campaignId) {
    const campaign = await this.findById(campaignId);
    if (campaign && campaign.target_delivered >= campaign.target_total) {
      await this.update(campaignId, { status: 'completed' });
    }
  }

  async getAllPaginated(page = 1, limit = 20, status = null) {
    const offset = (page - 1) * limit;
    let where = '1=1';
    const params = [];
    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }
    const total = await this.count(where, params);
    const rows = await this.findAll(where, params, 'id DESC', limit, offset);
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getStats() {
    const rows = await this.query(`
      SELECT 
        COUNT(*) as total_campaigns,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_campaigns,
        SUM(target_total) as total_targets,
        SUM(target_delivered) as total_delivered,
        SUM(target_assigned) as total_assigned
      FROM campaigns
    `);
    return rows[0];
  }
}

module.exports = new Campaign();
