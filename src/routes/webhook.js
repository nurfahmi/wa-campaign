const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/WebhookController');

router.post('/whatsapp', WebhookController.handleWhatsApp);

module.exports = router;
