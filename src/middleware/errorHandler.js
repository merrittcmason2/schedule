const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation Error',
      details: errors
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field' });
  }

  // PostgreSQL errors
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({ error: 'Resource already exists' });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({ error: 'Referenced resource does not exist' });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;