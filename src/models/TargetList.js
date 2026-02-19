const BaseModel = require('./BaseModel');
const db = require('../config/database');
const { sanitizePhone } = require('../utils/helpers');
const csv = require('csv-parser');
const { Readable } = require('stream');

class TargetList extends BaseModel {
  constructor() {
    super('target_lists');
  }

  async findAll() {
    return this.query('SELECT * FROM target_lists ORDER BY id DESC');
  }

  async getAllPaginated(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [countResult] = await this.query('SELECT COUNT(*) as total FROM target_lists');
    const total = countResult.total;
    const rows = await this.query('SELECT * FROM target_lists ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
    return { rows, page, totalPages: Math.ceil(total / limit), total };
  }

  async uploadCSV(listId, fileBuffer) {
    const phoneNumbers = await this._parseCSV(fileBuffer);
    if (!phoneNumbers.length) return { inserted: 0 };

    const unique = [...new Set(phoneNumbers)];

    // Check existing in this list
    const existing = await this.query(
      'SELECT phone_number FROM target_list_items WHERE target_list_id = ? AND phone_number IN (?)',
      [listId, unique]
    );
    const existingSet = new Set(existing.map(r => r.phone_number));
    const toInsert = unique.filter(p => !existingSet.has(p));

    if (toInsert.length) {
      // Batch insert
      const batchSize = 1000;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?)').join(',');
        const values = batch.flatMap(p => [listId, p]);
        await this.execute(`INSERT INTO target_list_items (target_list_id, phone_number) VALUES ${placeholders}`, values);
      }
    }

    // Update total count
    const [countResult] = await this.query('SELECT COUNT(*) as cnt FROM target_list_items WHERE target_list_id = ?', [listId]);
    await this.execute('UPDATE target_lists SET total_count = ? WHERE id = ?', [countResult.cnt, listId]);

    return { inserted: toInsert.length, duplicates: unique.length - toInsert.length, total: countResult.cnt };
  }

  async getItems(listId, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [countResult] = await this.query('SELECT COUNT(*) as total FROM target_list_items WHERE target_list_id = ?', [listId]);
    const rows = await this.query('SELECT * FROM target_list_items WHERE target_list_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', [listId, limit, offset]);
    return { rows, page, totalPages: Math.ceil(countResult.total / limit), total: countResult.total };
  }

  async deleteWithItems(listId) {
    // Items cascade delete via FK
    await this.execute('DELETE FROM target_lists WHERE id = ?', [listId]);
  }

  async _parseCSV(fileBuffer) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = Readable.from(fileBuffer.toString());
      stream
        .pipe(csv({ headers: false }))
        .on('data', (row) => {
          const value = Object.values(row)[0];
          if (value) {
            const phone = sanitizePhone(String(value).trim());
            if (phone.length >= 8) results.push(phone);
          }
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }
}

module.exports = new TargetList();
