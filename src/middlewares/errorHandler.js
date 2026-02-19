const AppError = require('../utils/AppError');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal Server Error';

  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  }

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  }

  req.flash && req.flash('error', message);
  if (statusCode === 401) return res.redirect('/login');
  if (statusCode === 403) return res.redirect('back');

  res.status(statusCode).render('user/error', {
    title: 'Error',
    message,
    statusCode,
    user: req.user || null,
  });
}

module.exports = errorHandler;
