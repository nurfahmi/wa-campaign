const crypto = require('crypto');

function generateReferralCode(length = 8) {
  return crypto.randomBytes(length).toString('hex').slice(0, length).toUpperCase();
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCurrency(amount) {
  return parseFloat(amount).toFixed(2);
}

function sanitizePhone(phone) {
  return phone.replace(/[^0-9+]/g, '');
}

module.exports = {
  generateReferralCode,
  randomDelay,
  sleep,
  formatCurrency,
  sanitizePhone,
};
