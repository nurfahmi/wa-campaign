const db = require('../config/database');
const CampaignTarget = require('../models/CampaignTarget');
const Job = require('../models/Job');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const CreditLog = require('../models/CreditLog');
const Referral = require('../models/Referral');
const WebhookLog = require('../models/WebhookLog');
const AppError = require('../utils/AppError');

class WebhookService {
  /**
   * Process WhatsApp delivery webhook – fully transactional.
   * Called when message status updates arrive.
   */
  async processDeliveryUpdate(payload) {
    // Log the raw webhook
    await WebhookLog.create({
      event_type: 'messages.update',
      payload: JSON.stringify(payload),
    });

    const updates = payload.updates || payload;
    if (!Array.isArray(updates)) return;

    for (const update of updates) {
      const messageId = update.key?.id || update.messageId;
      const statusCode = update.update?.status || update.status;

      if (!messageId) continue;

      // Status >= 2 means delivered (2 ticks)
      const isDelivered = statusCode >= 2 ||
        statusCode === 'DELIVERY_ACK' ||
        statusCode === 'delivered' ||
        statusCode === 'read';

      if (!isDelivered) continue;

      await this._processDelivered(messageId);
    }
  }

  async _processDelivered(messageId) {
    const target = await CampaignTarget.findByMessageId(messageId);
    if (!target || target.status >= 3) return; // Already processed

    const job = await Job.findByMessageId(messageId);
    if (!job || job.status === 'delivered') return;

    const campaign = await Campaign.findById(job.campaign_id);
    const user = await User.findById(job.user_id);
    if (!campaign || !user) return;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Update campaign_targets → delivered
      await conn.query(
        'UPDATE campaign_targets SET status = 3, delivered_at = NOW() WHERE id = ?',
        [target.id]
      );

      // 2. Update job → delivered
      await conn.query(
        "UPDATE jobs SET status = 'delivered', updated_at = NOW() WHERE id = ?",
        [job.id]
      );

      // 3. Add reward to user
      const rewardAmount = parseFloat(job.reward_amount);
      await conn.query(
        'UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?',
        [rewardAmount, user.id]
      );

      // 4. Insert credit log for job reward
      await conn.query(
        `INSERT INTO credit_logs (user_id, amount, type, reference_id, description, created_at) 
         VALUES (?, ?, 'job_reward', ?, ?, NOW())`,
        [user.id, rewardAmount, job.id, `Reward for job #${job.id} - ${campaign.name}`]
      );

      // 5. Handle referral bonus
      if (user.referred_by) {
        const referrer = await User.findById(user.referred_by);
        if (referrer && referrer.status === 'active') {
          const bonusPercent = parseFloat(referrer.referral_percent) / 100;
          const bonusAmount = parseFloat((rewardAmount * bonusPercent).toFixed(2));

          if (bonusAmount > 0) {
            // Add bonus to referrer
            await conn.query(
              'UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?',
              [bonusAmount, referrer.id]
            );

            // Credit log for referral bonus
            await conn.query(
              `INSERT INTO credit_logs (user_id, amount, type, reference_id, description, created_at) 
               VALUES (?, ?, 'referral_bonus', ?, ?, NOW())`,
              [referrer.id, bonusAmount, job.id, `Referral bonus from ${user.name} - Job #${job.id}`]
            );

            // Update referral total
            await conn.query(
              `UPDATE referrals SET total_bonus_earned = total_bonus_earned + ? 
               WHERE referrer_id = ? AND referred_user_id = ?`,
              [bonusAmount, referrer.id, user.id]
            );
          }
        }
      }

      // 6. Increment campaign delivered count
      await conn.query(
        'UPDATE campaigns SET target_delivered = target_delivered + 1 WHERE id = ?',
        [campaign.id]
      );

      // 7. Auto-complete campaign if all delivered
      await conn.query(
        `UPDATE campaigns SET status = 'completed' 
         WHERE id = ? AND target_delivered >= target_total AND status = 'active'`,
        [campaign.id]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      console.error('Webhook delivery processing error:', err);
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new WebhookService();
