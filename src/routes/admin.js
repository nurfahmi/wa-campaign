const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const { isAuthenticated, isAdmin } = require('../middlewares/auth');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// All admin routes require auth + admin role
router.use(isAuthenticated, isAdmin);

// Dashboard
router.get('/', AdminController.dashboard);

// Message Templates
router.get('/templates', AdminController.templateList);
router.get('/templates/new', AdminController.templateCreate);
router.post('/templates', AdminController.templateStore);
router.get('/templates/:id/edit', AdminController.templateEdit);
router.post('/templates/:id', AdminController.templateUpdate);
router.post('/templates/:id/delete', AdminController.templateDelete);

// Target Lists
router.get('/targets', AdminController.targetListPage);
router.post('/targets', upload.single('csv'), AdminController.targetListCreate);
router.get('/targets/:id', AdminController.targetListDetail);
router.post('/targets/:id/upload', upload.single('csv'), AdminController.targetListUpload);
router.post('/targets/:id/delete', AdminController.targetListDelete);

// Campaigns
router.get('/campaigns', AdminController.campaignList);
router.get('/campaigns/new', AdminController.campaignCreate);
router.post('/campaigns', AdminController.campaignStore);
router.get('/campaigns/:id', AdminController.campaignDetail);
router.post('/campaigns/:id', AdminController.campaignUpdate);

// Users
router.get('/users', AdminController.userList);
router.post('/users/:id', AdminController.userUpdate);
router.post('/users/:id/credit', AdminController.userAdjustCredit);

// Job Logs
router.get('/jobs', AdminController.jobLogs);

// Credit Logs
router.get('/credits', AdminController.creditLogs);

// WhatsApp Sessions
router.get('/sessions', AdminController.sessionsList);
router.post('/sessions', AdminController.sessionCreate);
router.post('/sessions/:id', AdminController.sessionUpdate);
router.post('/sessions/:id/delete', AdminController.sessionDelete);

// Webhook Logs
router.get('/webhooks', AdminController.webhookLogs);

// Settings
router.get('/settings', AdminController.settingsPage);
router.post('/settings', AdminController.settingsUpdate);

module.exports = router;
