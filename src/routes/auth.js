const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');

router.get('/login', AuthController.loginPage);
router.get('/auth/google', AuthController.googleAuth);
router.get('/auth/google/callback', AuthController.googleCallback);
router.get('/logout', AuthController.logout);

// Dev-only login (bypasses Google OAuth)
if (process.env.NODE_ENV !== 'production') {
  const db = require('../config/database');
  router.get('/dev-login', async (req, res) => {
    try {
      const role = req.query.role || 'superadmin';
      const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [`dev-${role}@localhost`]);
      let user;
      if (rows.length) {
        user = rows[0];
      } else {
        const code = Math.random().toString(36).slice(2, 10);
        const [result] = await db.query(
          `INSERT INTO users (role, google_id, name, email, referral_code, status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
          [role, `dev-${role}`, `Dev ${role}`, `dev-${role}@localhost`, code]
        );
        const [newRows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
        user = newRows[0];
      }
      req.login(user, (err) => {
        if (err) return res.status(500).send(err.message);
        res.redirect(role === 'user' ? '/home' : '/admin');
      });
    } catch (err) {
      res.status(500).send(err.message);
    }
  });
}

module.exports = router;

