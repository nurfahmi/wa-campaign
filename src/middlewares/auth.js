const AppError = require('../utils/AppError');

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return next(new AppError('Unauthorized', 401));
  }
  return res.redirect('/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Unauthorized', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: insufficient permissions', 403));
    }
    next();
  };
}

function isAdmin(req, res, next) {
  return requireRole('superadmin', 'admin')(req, res, next);
}

function isSuperAdmin(req, res, next) {
  return requireRole('superadmin')(req, res, next);
}

module.exports = {
  isAuthenticated,
  requireRole,
  isAdmin,
  isSuperAdmin,
};
