const BaseModel = require('./BaseModel');

class Job extends BaseModel {
  constructor() {
    super('jobs');
  }

  async findByMessageId(messageId) {
    return this.findOne('message_id = ?', [messageId]);
  }

  async getUserJobsToday(userId, campaignId = null) {
    let where = 'user_id = ? AND DATE(created_at) = CURDATE()';
    const params = [userId];
    if (campaignId) {
      where += ' AND campaign_id = ?';
      params.push(campaignId);
    }
    return this.count(where, params);
  }

  async getAllPaginated(page = 1, limit = 20, filters = {}) {
    const offset = (page - 1) * limit;
    let where = '1=1';
    const params = [];
    if (filters.userId) {
      where += ' AND user_id = ?';
      params.push(filters.userId);
    }
    if (filters.campaignId) {
      where += ' AND campaign_id = ?';
      params.push(filters.campaignId);
    }
    if (filters.status) {
      where += ' AND status = ?';
      params.push(filters.status);
    }
    const total = await this.count(where, params);
    const rows = await this.query(
      `SELECT j.*, u.name as user_name, c.name as campaign_name
       FROM jobs j
       LEFT JOIN users u ON j.user_id = u.id
       LEFT JOIN campaigns c ON j.campaign_id = c.id
       WHERE ${where.replace(/user_id/g, 'j.user_id').replace(/campaign_id/g, 'j.campaign_id').replace(/status/g, 'j.status').replace(/1=1 AND j\./, '1=1 AND j.')}
       ORDER BY j.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getStats() {
    const rows = await this.query(`
      SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered_jobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
        SUM(reward_amount) as total_rewards
      FROM jobs
    `);
    return rows[0];
  }
}

module.exports = new Job();
