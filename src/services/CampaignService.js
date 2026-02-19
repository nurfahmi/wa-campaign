const Campaign = require('../models/Campaign');
const CampaignTarget = require('../models/CampaignTarget');
const SystemSetting = require('../models/SystemSetting');
const AppError = require('../utils/AppError');
const db = require('../config/database');

class CampaignService {
  async create(data, userId) {
    const { template_ids, target_list_ids, ...campaignData } = data;
    campaignData.created_by = userId;
    campaignData.target_total = 0;
    campaignData.status = campaignData.status || 'draft';
    const result = await Campaign.create(campaignData);
    const campaignId = result.insertId || result;

    // Assign templates
    if (template_ids && template_ids.length) {
      const ids = Array.isArray(template_ids) ? template_ids : [template_ids];
      for (const tplId of ids) {
        await db.query('INSERT IGNORE INTO campaign_templates (campaign_id, message_template_id) VALUES (?, ?)', [campaignId, tplId]);
      }
    }

    // Assign target lists and copy numbers
    if (target_list_ids && target_list_ids.length) {
      const ids = Array.isArray(target_list_ids) ? target_list_ids : [target_list_ids];
      for (const listId of ids) {
        await db.query('INSERT IGNORE INTO campaign_target_lists (campaign_id, target_list_id) VALUES (?, ?)', [campaignId, listId]);
      }
      await this._syncTargetsFromLists(campaignId);
    }

    return campaignId;
  }

  async update(id, data) {
    const campaign = await Campaign.findById(id);
    if (!campaign) throw new AppError('Campaign not found', 404);

    const { template_ids, target_list_ids, ...campaignData } = data;
    await Campaign.update(id, campaignData);

    // Re-sync templates
    if (template_ids !== undefined) {
      await db.query('DELETE FROM campaign_templates WHERE campaign_id = ?', [id]);
      const ids = Array.isArray(template_ids) ? template_ids : (template_ids ? [template_ids] : []);
      for (const tplId of ids) {
        await db.query('INSERT IGNORE INTO campaign_templates (campaign_id, message_template_id) VALUES (?, ?)', [id, tplId]);
      }
    }

    // Re-sync target lists
    if (target_list_ids !== undefined) {
      await db.query('DELETE FROM campaign_target_lists WHERE campaign_id = ?', [id]);
      const ids = Array.isArray(target_list_ids) ? target_list_ids : (target_list_ids ? [target_list_ids] : []);
      for (const listId of ids) {
        await db.query('INSERT IGNORE INTO campaign_target_lists (campaign_id, target_list_id) VALUES (?, ?)', [id, listId]);
      }
      await this._syncTargetsFromLists(id);
    }

    return Campaign.findById(id);
  }

  /**
   * Copy phone numbers from assigned target lists into campaign_targets.
   * Skips duplicates already in campaign_targets.
   */
  async _syncTargetsFromLists(campaignId) {
    // Get all assigned list IDs
    const [lists] = await db.query('SELECT target_list_id FROM campaign_target_lists WHERE campaign_id = ?', [campaignId]);
    if (!lists.length) return;

    const listIds = lists.map(l => l.target_list_id);

    // Get all phones from those lists
    const [items] = await db.query(
      'SELECT DISTINCT phone_number FROM target_list_items WHERE target_list_id IN (?)',
      [listIds]
    );
    if (!items.length) return;

    const allPhones = items.map(i => i.phone_number);

    // Get existing in campaign_targets for this campaign
    const [existing] = await db.query(
      'SELECT phone_number FROM campaign_targets WHERE campaign_id = ?',
      [campaignId]
    );
    const existingSet = new Set(existing.map(e => e.phone_number));

    const toInsert = allPhones.filter(p => !existingSet.has(p));
    if (!toInsert.length) return;

    // Optionally check across campaigns
    const preventDupAcross = await SystemSetting.get('prevent_duplicate_phone_across_campaigns', 'false');
    let finalInsert = toInsert;
    if (preventDupAcross === 'true') {
      const [dups] = await db.query(
        'SELECT DISTINCT phone_number FROM campaign_targets WHERE phone_number IN (?)',
        [toInsert]
      );
      const dupSet = new Set(dups.map(d => d.phone_number));
      finalInsert = toInsert.filter(p => !dupSet.has(p));
    }

    if (!finalInsert.length) return;

    // Bulk insert
    await CampaignTarget.bulkInsert(campaignId, finalInsert);
    const totalTargets = await CampaignTarget.countByCampaign(campaignId);
    await Campaign.update(campaignId, { target_total: totalTargets });
  }

  async getById(id) {
    const campaign = await Campaign.findById(id);
    if (!campaign) throw new AppError('Campaign not found', 404);
    const stats = await CampaignTarget.getStatsByCampaign(id);

    // Get assigned templates
    const [templates] = await db.query(
      `SELECT mt.* FROM campaign_templates ct
       JOIN message_templates mt ON ct.message_template_id = mt.id
       WHERE ct.campaign_id = ?`, [id]
    );

    // Get assigned target lists
    const [targetLists] = await db.query(
      `SELECT tl.* FROM campaign_target_lists ctl
       JOIN target_lists tl ON ctl.target_list_id = tl.id
       WHERE ctl.campaign_id = ?`, [id]
    );

    return { ...campaign, targetStats: stats, templates, targetLists };
  }

  async list(page, limit, status) {
    return Campaign.getAllPaginated(page, limit, status);
  }

  /**
   * Get a random message template for a campaign (A/B rotation)
   */
  async getRandomTemplate(campaignId) {
    const [templates] = await db.query(
      `SELECT mt.* FROM campaign_templates ct
       JOIN message_templates mt ON ct.message_template_id = mt.id
       WHERE ct.campaign_id = ? ORDER BY RAND() LIMIT 1`, [campaignId]
    );
    return templates[0] || null;
  }
}

module.exports = new CampaignService();
