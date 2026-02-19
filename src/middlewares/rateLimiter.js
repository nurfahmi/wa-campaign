const rateLimit = require('express-rate-limit');
const config = require('../config/env');

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const jobLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { success: false, message: 'Job request rate limit exceeded.' },
  validate: { xForwardedForHeader: false },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts.' },
});

module.exports = { globalLimiter, jobLimiter, authLimiter };
