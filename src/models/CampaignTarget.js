const BaseModel = require('./BaseModel');

class CampaignTarget extends BaseModel {
  constructor() {
    super('campaign_targets');
  }

  async findByMessageId(messageId) {
    return this.findOne('message_id = ?', [messageId]);
  }

  async bulkInsert(campaignId, phoneNumbers) {
    const BATCH_SIZE = 1000;
    let inserted = 0;
    for (let i = 0; i < phoneNumbers.length; i += BATCH_SIZE) {
      const batch = phoneNumbers.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '(?, ?)').join(', ');
      const values = batch.flatMap(phone => [campaignId, phone]);
      await this.execute(
        `INSERT INTO campaign_targets (campaign_id, phone_number) VALUES ${placeholders}`,
        values
      );
      inserted += batch.length;
    }
    return inserted;
  }

  async countByCampaign(campaignId) {
    return this.count('campaign_id = ?', [campaignId]);
  }

  async getStatsByCampaign(campaignId) {
    const rows = await this.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM campaign_targets
      WHERE campaign_id = ?
      GROUP BY status
    `, [campaignId]);
    const stats = { pending: 0, assigned: 0, sent: 0, delivered: 0, failed: 0 };
    rows.forEach(r => {
      const map = { 0: 'pending', 1: 'assigned', 2: 'sent', 3: 'delivered', 4: 'failed' };
      stats[map[r.status]] = r.count;
    });
    return stats;
  }

  async findDuplicatePhones(campaignId, phoneNumbers) {
    if (!phoneNumbers.length) return [];
    const placeholders = phoneNumbers.map(() => '?').join(', ');
    const rows = await this.query(
      `SELECT DISTINCT phone_number FROM campaign_targets WHERE campaign_id = ? AND phone_number IN (${placeholders})`,
      [campaignId, ...phoneNumbers]
    );
    return rows.map(r => r.phone_number);
  }

  async findDuplicatePhonesAcrossCampaigns(phoneNumbers) {
    if (!phoneNumbers.length) return [];
    const placeholders = phoneNumbers.map(() => '?').join(', ');
    const rows = await this.query(
      `SELECT DISTINCT phone_number FROM campaign_targets WHERE phone_number IN (${placeholders})`,
      phoneNumbers
    );
    return rows.map(r => r.phone_number);
  }
}

module.exports = new CampaignTarget();
