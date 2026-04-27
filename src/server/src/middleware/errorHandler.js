/**
 * ============================================================================
 * ERROR HANDLER MIDDLEWARE — Global Express Error Handler
 * ============================================================================
 * Catches all unhandled errors in the Express request pipeline and returns
 * a consistent JSON error response. Must be registered as the LAST middleware
 * in the Express app to catch errors from all preceding routes/middleware.
 *
 * RESPONSE FORMAT:
 *   {
 *     error: true,
 *     message: "Human-readable error description",
 *     status: 500,
 *     ...(NODE_ENV === 'development' && { stack: "..." })
 *   }
 *
 * USAGE:
 *   const errorHandler = require('./middleware/errorHandler');
 *   app.use(errorHandler);  // Must be LAST
 * ============================================================================
 */

/**
 * Express error-handling middleware.
 * Signature must have 4 parameters (err, req, res, next) for Express to
 * recognize it as an error handler.
 *
 * @param {Error} err - The error that was thrown or passed via next(err)
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Log the error via structured logger
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack, code: err.code });

  // Determine HTTP status code (default to 500 Internal Server Error)
  const statusCode = err.statusCode || err.status || (err.name === 'MulterError' ? 400 : 500);

  // Build the error response body
  const response = {
    error: true,
    message: err.message || 'Internal Server Error',
    status: statusCode,
  };

  // Include stack trace in development mode for debugging
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Send the JSON error response
  res.status(statusCode).json(response);
}

module.exports = errorHandler;
