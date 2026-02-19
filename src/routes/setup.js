const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../config/database');

// GET /setup/:token — show superadmin creation form
router.get('/setup/:token', async (req, res) => {
  try {
    // Validate token
    const [tokens] = await db.query(
      'SELECT * FROM setup_tokens WHERE token = ? AND used = 0',
      [req.params.token]
    );
    if (!tokens.length) {
      return res.status(403).render('user/error', {
        title: 'Invalid Setup Link',
        message: 'This setup link is invalid or has already been used.',
        statusCode: 403,
        user: null,
      });
    }

    res.render('setup', {
      title: 'Create Superadmin',
      token: req.params.token,
      user: null,
      flash: { success: null, error: null },
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// POST /setup/:token — create superadmin and log in
router.post('/setup/:token', async (req, res) => {
  try {
    // Validate token
    const [tokens] = await db.query(
      'SELECT * FROM setup_tokens WHERE token = ? AND used = 0',
      [req.params.token]
    );
    if (!tokens.length) {
      return res.status(403).render('user/error', {
        title: 'Invalid Setup Link',
        message: 'This setup link is invalid or has already been used.',
        statusCode: 403,
        user: null,
      });
    }

    const { name, email } = req.body;
    if (!name || !email) {
      return res.render('setup', {
        title: 'Create Superadmin',
        token: req.params.token,
        user: null,
        flash: { success: null, error: 'Name and email are required.' },
      });
    }

    // Create superadmin user
    const code = crypto.randomBytes(4).toString('hex');
    const [result] = await db.query(
      `INSERT INTO users (role, name, email, referral_code, status, created_at, updated_at)
       VALUES ('superadmin', ?, ?, ?, 'active', NOW(), NOW())`,
      [name, email, code]
    );

    // Mark token as used
    await db.query('UPDATE setup_tokens SET used = 1 WHERE token = ?', [req.params.token]);

    // Log the user in
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const user = rows[0];

    req.login(user, (err) => {
      if (err) return res.status(500).send(err.message);
      res.redirect('/admin');
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Generate setup token if no users exist — called during boot
async function generateSetupToken(baseUrl) {
  const [rows] = await db.query('SELECT COUNT(*) as cnt FROM users');
  if (rows[0].cnt > 0) return null; // users already exist, skip

  // Check if there's already an unused token
  const [existing] = await db.query('SELECT token FROM setup_tokens WHERE used = 0 LIMIT 1');
  if (existing.length) return `${baseUrl}/setup/${existing[0].token}`;

  const token = crypto.randomBytes(32).toString('hex');
  await db.query('INSERT INTO setup_tokens (token) VALUES (?)', [token]);
  return `${baseUrl}/setup/${token}`;
}

module.exports = router;
module.exports.generateSetupToken = generateSetupToken;
