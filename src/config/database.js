const mysql = require('mysql2/promise');
const config = require('./env');

const poolConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  socketPath: process.env.DB_SOCKET || undefined,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  timezone: '+00:00',
  decimalNumbers: true,
};

const pool = mysql.createPool(poolConfig);

// Auto-init: create database + tables if they don't exist
async function initDatabase() {
  // 1. Connect WITHOUT a specific database to create it
  const initConn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    socketPath: process.env.DB_SOCKET || undefined,
  });

  await initConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await initConn.end();

  // 2. Now run CREATE TABLE IF NOT EXISTS on the pool
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id BIGINT NOT NULL AUTO_INCREMENT,
      role ENUM('superadmin','admin','user') NOT NULL DEFAULT 'user',
      google_id VARCHAR(191) NULL,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL,
      country VARCHAR(5) NULL,
      credit_balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      referral_code VARCHAR(20) NULL,
      referred_by BIGINT NULL,
      referral_percent DECIMAL(5,2) NOT NULL DEFAULT 105.00,
      hourly_limit INT NOT NULL DEFAULT 10,
      daily_limit INT NOT NULL DEFAULT 100,
      cooldown_until DATETIME NULL,
      last_job_at DATETIME NULL,
      status ENUM('active','suspended') NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_google_id (google_id),
      UNIQUE KEY uk_email (email),
      UNIQUE KEY uk_referral_code (referral_code),
      KEY idx_role (role),
      KEY idx_referral (referred_by),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS campaigns (
      id BIGINT NOT NULL AUTO_INCREMENT,
      name VARCHAR(191) NOT NULL,
      country_target VARCHAR(5) NULL,
      reward_per_job DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      cooldown_seconds INT NOT NULL DEFAULT 30,
      daily_limit_per_user INT NOT NULL DEFAULT 50,
      message_type ENUM('text','button') NOT NULL DEFAULT 'text',
      header TEXT NULL,
      body TEXT NOT NULL,
      footer TEXT NULL,
      button_json JSON NULL,
      image_url TEXT NULL,
      target_total INT NOT NULL DEFAULT 0,
      target_assigned INT NOT NULL DEFAULT 0,
      target_delivered INT NOT NULL DEFAULT 0,
      status ENUM('draft','active','paused','completed') NOT NULL DEFAULT 'draft',
      created_by BIGINT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_status (status),
      KEY idx_country (country_target),
      CONSTRAINT fk_campaigns_created_by FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS campaign_targets (
      id BIGINT NOT NULL AUTO_INCREMENT,
      campaign_id BIGINT NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      status TINYINT NOT NULL DEFAULT 0,
      assigned_to_user_id BIGINT NULL,
      assigned_at DATETIME NULL,
      message_id VARCHAR(191) NULL,
      sent_at DATETIME NULL,
      delivered_at DATETIME NULL,
      failed_at DATETIME NULL,
      retry_count INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_campaign_status (campaign_id, status),
      KEY idx_phone (phone_number),
      KEY idx_message (message_id),
      KEY idx_assigned (assigned_to_user_id),
      CONSTRAINT fk_ct_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_ct_user FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS jobs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      campaign_id BIGINT NOT NULL,
      campaign_target_id BIGINT NOT NULL,
      status ENUM('pending','sent','delivered','failed') NOT NULL DEFAULT 'pending',
      message_id VARCHAR(191) NULL,
      reward_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user (user_id),
      KEY idx_campaign (campaign_id),
      KEY idx_message_id (message_id),
      CONSTRAINT fk_jobs_user FOREIGN KEY (user_id) REFERENCES users(id),
      CONSTRAINT fk_jobs_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
      CONSTRAINT fk_jobs_target FOREIGN KEY (campaign_target_id) REFERENCES campaign_targets(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS credit_logs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      type ENUM('job_reward','referral_bonus','manual_adjust') NOT NULL,
      reference_id BIGINT NULL,
      description TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_user (user_id),
      KEY idx_type (type),
      CONSTRAINT fk_cl_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS referrals (
      id BIGINT NOT NULL AUTO_INCREMENT,
      referrer_id BIGINT NOT NULL,
      referred_user_id BIGINT NOT NULL,
      total_bonus_earned DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_referral_pair (referrer_id, referred_user_id),
      CONSTRAINT fk_ref_referrer FOREIGN KEY (referrer_id) REFERENCES users(id),
      CONSTRAINT fk_ref_referred FOREIGN KEY (referred_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id BIGINT NOT NULL AUTO_INCREMENT,
      session_id VARCHAR(191) NOT NULL,
      phone_number VARCHAR(20) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'disconnected',
      last_used_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_session_id (session_id),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS system_settings (
      id BIGINT NOT NULL AUTO_INCREMENT,
      key_name VARCHAR(100) NOT NULL,
      value TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_key_name (key_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS webhook_logs (
      id BIGINT NOT NULL AUTO_INCREMENT,
      event_type VARCHAR(50) NULL,
      payload JSON NULL,
      processed TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_event (event_type),
      KEY idx_processed (processed)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS setup_tokens (
      id BIGINT NOT NULL AUTO_INCREMENT,
      token VARCHAR(191) NOT NULL,
      used TINYINT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_token (token)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const sql of tables) {
    await pool.query(sql);
  }

  // Seed default system settings (ignore if already exist)
  const defaults = [
    ['anti_spam_delay_min', '3000'],
    ['anti_spam_delay_max', '8000'],
    ['default_referral_percent', '5.00'],
    ['prevent_duplicate_phone_across_campaigns', 'false'],
    ['max_retry_count', '3'],
  ];
  for (const [key, value] of defaults) {
    await pool.query(
      `INSERT IGNORE INTO system_settings (key_name, value) VALUES (?, ?)`,
      [key, value]
    );
  }

  console.log('✅ Database & tables ready');
}

module.exports = pool;
module.exports.initDatabase = initDatabase;
