const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { isAuthenticated } = require('../middlewares/auth');
const { jobLimiter } = require('../middlewares/rateLimiter');

router.get('/home', isAuthenticated, UserController.homePage);
router.post('/api/take-job', isAuthenticated, jobLimiter, UserController.takeJob);
router.post('/api/connect-wa', isAuthenticated, UserController.connectWhatsApp);
router.get('/api/wa-status', isAuthenticated, UserController.checkWaStatus);
router.post('/api/disconnect-wa', isAuthenticated, UserController.disconnectWhatsApp);
router.get('/profile', isAuthenticated, UserController.profilePage);
router.post('/profile', isAuthenticated, UserController.updateProfile);
router.get('/referrals', isAuthenticated, UserController.referralsPage);

module.exports = router;
