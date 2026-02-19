const JobService = require('../services/JobService');
const UserService = require('../services/UserService');
const Campaign = require('../models/Campaign');
const Job = require('../models/Job');
const User = require('../models/User');
const db = require('../config/database');
const config = require('../config/env');

class UserController {
  async homePage(req, res, next) {
    try {
      // Refresh user data from DB (to get latest wa_connected status)
      const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
      const user = rows[0];

      const profile = await UserService.getProfile(user.id);
      const campaigns = await Campaign.findActive(user.country);
      const activeCampaign = campaigns[0] || null;
      let cooldownRemaining = 0;
      if (user.cooldown_until) {
        cooldownRemaining = Math.max(0, Math.ceil((new Date(user.cooldown_until) - new Date()) / 1000));
      }
      res.render('user/home', {
        title: 'Home',
        user,
        profile,
        activeCampaign,
        cooldownRemaining,
        baseUrl: config.baseUrl,
      });
    } catch (err) {
      next(err);
    }
  }

  async connectWhatsApp(req, res) {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
      }

      // Clean phone number (remove +, spaces, dashes)
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const sessionId = `user-${req.user.id}`;

      // Call WA API to create session with pairing code
      const response = await fetch(`${config.wa.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, phoneNumber: cleanPhone }),
      });

      const data = await response.json();

      if (data.pairingCode) {
        // Save phone number and session ID to user
        await db.query(
          'UPDATE users SET phone_number = ?, wa_session_id = ? WHERE id = ?',
          [cleanPhone, sessionId, req.user.id]
        );

        return res.json({
          success: true,
          pairingCode: data.pairingCode,
          message: 'Enter this code in WhatsApp → Settings → Linked Devices → Link a Device',
        });
      }

      return res.status(400).json({ success: false, message: data.message || 'Failed to generate pairing code' });
    } catch (err) {
      console.error('WA connect error:', err.message);
      return res.status(500).json({ success: false, message: 'Failed to connect to WhatsApp service' });
    }
  }

  async checkWaStatus(req, res) {
    try {
      const sessionId = `user-${req.user.id}`;

      const response = await fetch(`${config.wa.baseUrl}/api/sessions/${sessionId}`);
      const data = await response.json();

      const status = data?.status || data?.[sessionId]?.status || 'disconnected';
      const connected = status === 'connected';

      // Update user wa_connected status
      if (connected) {
        await db.query(
          'UPDATE users SET wa_connected = 1 WHERE id = ?',
          [req.user.id]
        );
      }

      return res.json({ success: true, status, connected });
    } catch (err) {
      return res.json({ success: true, status: 'disconnected', connected: false });
    }
  }

  async disconnectWhatsApp(req, res) {
    try {
      const sessionId = `user-${req.user.id}`;

      // Call WA API to delete session
      await fetch(`${config.wa.baseUrl}/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      // Clear user WA fields
      await db.query(
        'UPDATE users SET wa_connected = 0, wa_session_id = NULL, phone_number = NULL WHERE id = ?',
        [req.user.id]
      );

      return res.json({ success: true, message: 'WhatsApp disconnected' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to disconnect' });
    }
  }

  async takeJob(req, res, next) {
    try {
      // Check WA connected
      const [rows] = await db.query('SELECT wa_connected FROM users WHERE id = ?', [req.user.id]);
      if (!rows[0]?.wa_connected) {
        return res.status(400).json({ success: false, message: 'Connect your WhatsApp first' });
      }

      const result = await JobService.takeJob(req.user.id);
      res.json({ success: true, data: result });
    } catch (err) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ success: false, message: err.message });
    }
  }

  async profilePage(req, res, next) {
    try {
      const profile = await UserService.getProfile(req.user.id);
      res.render('user/profile', {
        title: 'Profile',
        user: req.user,
        profile,
        baseUrl: config.baseUrl,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      await UserService.updateProfile(req.user.id, req.body);
      req.flash('success', 'Profile updated');
      res.redirect('/profile');
    } catch (err) {
      next(err);
    }
  }

  async referralsPage(req, res, next) {
    try {
      const profile = await UserService.getProfile(req.user.id);
      res.render('user/referrals', {
        title: 'My Referrals',
        user: req.user,
        referrals: profile.referrals || [],
        baseUrl: config.baseUrl,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
