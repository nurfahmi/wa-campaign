const db = require('../config/database');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const CampaignTarget = require('../models/CampaignTarget');
const Job = require('../models/Job');
const SystemSetting = require('../models/SystemSetting');
const AppError = require('../utils/AppError');
const config = require('../config/env');

/**
 * Send message via WA API directly (no queue needed — 1 msg per user per cooldown)
 */
async function sendMessage(sessionId, phoneNumber, campaignData) {
  const baseUrl = config.wa.baseUrl;
  const jid = `${phoneNumber}@s.whatsapp.net`;

  try {
    if (campaignData.messageType === 'button') {
      const payload = {
        jid,
        text: campaignData.body,
        header: campaignData.header || '',
        footer: campaignData.footer || '',
        buttons: campaignData.buttonJson ? JSON.parse(campaignData.buttonJson) : [],
      };
      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/send-button`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`WA API ${res.status}`);
      const result = await res.json();
      return result.messageId || result.response?.key?.id;
    } else {
      const message = {};
      if (campaignData.imageUrl) {
        message.image = { url: campaignData.imageUrl };
        message.caption = campaignData.body;
      } else {
        message.text = campaignData.body;
      }
      const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid, message }),
      });
      if (!res.ok) throw new Error(`WA API ${res.status}`);
      const result = await res.json();
      return result.messageId || result.response?.key?.id;
    }
  } catch (err) {
    console.error(`[SendMessage] Failed:`, err.message);
    throw err;
  }
}

class JobService {
  /**
   * Core "Take Job" flow — transaction-safe, concurrency-safe.
   * Sends message directly (no Redis/BullMQ needed).
   */
  async takeJob(userId) {
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.status !== 'active') throw new AppError('Account suspended', 403);
    if (!user.wa_connected) throw new AppError('Connect your WhatsApp first', 400);

    // Check cooldown
    if (user.cooldown_until && new Date(user.cooldown_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.cooldown_until) - new Date()) / 1000);
      throw new AppError(`Cooldown active. Wait ${remaining}s`, 429);
    }

    // Check daily limit
    const dailyCount = await User.getJobCountToday(userId);
    if (dailyCount >= user.daily_limit) {
      throw new AppError('Daily job limit reached', 429);
    }

    // Check hourly limit
    const hourlyCount = await User.getJobCountLastHour(userId);
    if (hourlyCount >= user.hourly_limit) {
      throw new AppError('Hourly job limit reached', 429);
    }

    // Find active campaign matching user country
    const campaigns = await Campaign.findActive(user.country);
    if (!campaigns.length) {
      throw new AppError('No campaigns available', 404);
    }

    // Try each campaign until we lock a target
    let assigned = null;
    let selectedCampaign = null;

    for (const campaign of campaigns) {
      // Check per-campaign daily limit
      const campaignDailyCount = await Job.getUserJobsToday(userId, campaign.id);
      if (campaignDailyCount >= campaign.daily_limit_per_user) continue;

      // Transaction: lock and assign one target
      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        // SELECT FOR UPDATE – locks the row
        const [targets] = await conn.query(
          `SELECT id FROM campaign_targets 
           WHERE campaign_id = ? AND status = 0 
           LIMIT 1 FOR UPDATE`,
          [campaign.id]
        );

        if (!targets.length) {
          await conn.rollback();
          continue;
        }

        const targetId = targets[0].id;

        // Assign the target
        await conn.query(
          `UPDATE campaign_targets 
           SET status = 1, assigned_to_user_id = ?, assigned_at = NOW() 
           WHERE id = ?`,
          [userId, targetId]
        );

        // Increment campaign assigned count
        await conn.query(
          'UPDATE campaigns SET target_assigned = target_assigned + 1 WHERE id = ?',
          [campaign.id]
        );

        // Update user cooldown
        const cooldownUntil = new Date(Date.now() + campaign.cooldown_seconds * 1000);
        await conn.query(
          'UPDATE users SET cooldown_until = ?, last_job_at = NOW() WHERE id = ?',
          [cooldownUntil, userId]
        );

        // Create job record
        const [jobResult] = await conn.query(
          `INSERT INTO jobs (user_id, campaign_id, campaign_target_id, status, reward_amount, created_at, updated_at) 
           VALUES (?, ?, ?, 'pending', ?, NOW(), NOW())`,
          [userId, campaign.id, targetId, campaign.reward_per_job]
        );

        await conn.commit();

        assigned = { targetId, jobId: jobResult.insertId };
        selectedCampaign = campaign;
        break;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }

    if (!assigned) {
      throw new AppError('No targets available right now. Try again later.', 404);
    }

    // Get target and pick a random template (A/B rotation)
    const target = await CampaignTarget.findById(assigned.targetId);
    const sessionId = user.wa_session_id || `user-${userId}`;

    const CampaignService = require('./CampaignService');
    const template = await CampaignService.getRandomTemplate(selectedCampaign.id);
    if (!template) {
      // No template assigned — mark failed
      await CampaignTarget.update(assigned.targetId, { status: 4, failed_at: new Date() });
      await Job.update(assigned.jobId, { status: 'failed' });
      throw new AppError('No message template assigned to this campaign', 500);
    }

    try {
      const messageId = await sendMessage(sessionId, target.phone_number, {
        messageType: template.message_type,
        header: template.header,
        body: template.body,
        footer: template.footer,
        buttonJson: template.button_json,
        imageUrl: template.image_url,
      });

      // Mark as sent
      await CampaignTarget.update(assigned.targetId, {
        status: 2, message_id: messageId, sent_at: new Date(),
      });
      await Job.update(assigned.jobId, { status: 'sent', message_id: messageId });

      console.log(`[Job] #${assigned.jobId} sent → ${target.phone_number} via ${sessionId} (tpl: ${template.name})`);
    } catch (sendErr) {
      // Message send failed — mark job as failed but keep the cooldown
      await CampaignTarget.update(assigned.targetId, { status: 4, failed_at: new Date() });
      await Job.update(assigned.jobId, { status: 'failed' });
      console.error(`[Job] #${assigned.jobId} send failed:`, sendErr.message);
    }

    return {
      jobId: assigned.jobId,
      campaignName: selectedCampaign.name,
      reward: selectedCampaign.reward_per_job,
      cooldownSeconds: selectedCampaign.cooldown_seconds,
    };
  }

  async getUserJobHistory(userId, page = 1, limit = 20) {
    return Job.getAllPaginated(page, limit, { userId });
  }
}

module.exports = new JobService();
