const db = require('../config/database');

class BaseModel {
  constructor(table) {
    this.table = table;
  }

  async findById(id) {
    const [rows] = await db.query(`SELECT * FROM ${this.table} WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  async findOne(where, params = []) {
    const [rows] = await db.query(`SELECT * FROM ${this.table} WHERE ${where} LIMIT 1`, params);
    return rows[0] || null;
  }

  async findAll(where = '1=1', params = [], orderBy = 'id DESC', limit = 100, offset = 0) {
    const [rows] = await db.query(
      `SELECT * FROM ${this.table} WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    return rows;
  }

  async count(where = '1=1', params = []) {
    const [rows] = await db.query(`SELECT COUNT(*) as total FROM ${this.table} WHERE ${where}`, params);
    return rows[0].total;
  }

  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const [result] = await db.query(
      `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return result.insertId;
  }

  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const [result] = await db.query(
      `UPDATE ${this.table} SET ${setClause} WHERE id = ?`,
      [...values, id]
    );
    return result.affectedRows;
  }

  async delete(id) {
    const [result] = await db.query(`DELETE FROM ${this.table} WHERE id = ?`, [id]);
    return result.affectedRows;
  }

  async query(sql, params = []) {
    const [rows] = await db.query(sql, params);
    return rows;
  }

  async execute(sql, params = []) {
    const [result] = await db.execute(sql, params);
    return result;
  }
}

module.exports = BaseModel;
