const BaseModel = require('./BaseModel');

class SystemSetting extends BaseModel {
  constructor() {
    super('system_settings');
  }

  async get(keyName, defaultValue = null) {
    const row = await this.findOne('key_name = ?', [keyName]);
    return row ? row.value : defaultValue;
  }

  async set(keyName, value) {
    const existing = await this.findOne('key_name = ?', [keyName]);
    if (existing) {
      return this.update(existing.id, { value });
    }
    return this.create({ key_name: keyName, value });
  }

  async getAll() {
    return this.findAll('1=1', [], 'key_name ASC', 1000);
  }
}

module.exports = new SystemSetting();
