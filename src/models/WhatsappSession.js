const BaseModel = require('./BaseModel');

class WhatsappSession extends BaseModel {
  constructor() {
    super('whatsapp_sessions');
  }

  async getLeastRecentlyUsed() {
    const rows = await this.query(
      `SELECT * FROM whatsapp_sessions 
       WHERE status = 'connected' 
       ORDER BY last_used_at ASC 
       LIMIT 1`
    );
    return rows[0] || null;
  }

  async markUsed(id) {
    return this.update(id, { last_used_at: new Date() });
  }

  async findBySessionId(sessionId) {
    return this.findOne('session_id = ?', [sessionId]);
  }
}

module.exports = new WhatsappSession();
