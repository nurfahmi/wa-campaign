const WebhookService = require('../services/WebhookService');

class WebhookController {
  async handleWhatsApp(req, res) {
    try {
      await WebhookService.processDeliveryUpdate(req.body);
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Webhook error:', err);
      // Always return 200 to prevent webhook retries from the sender
      res.status(200).json({ success: false, message: err.message });
    }
  }
}

module.exports = new WebhookController();
