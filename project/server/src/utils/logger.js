/**
 * ============================================================================
 * LOGGER — Structured Winston Logger
 * ============================================================================
 * Provides a production-ready structured logger using Winston.
 * Falls back to console if Winston is not installed (graceful degradation).
 *
 * LEVELS: error → warn → info → http → debug
 *
 * OUTPUT:
 *   - Development: colorized, human-readable console
 *   - Production:  JSON lines to stdout (compatible with log aggregators)
 *
 * USAGE:
 *   const logger = require('./utils/logger');
 *   logger.info('Server started', { port: 3001 });
 *   logger.error('DB connection failed', { err });
 * ============================================================================
 */

let logger;

try {
  const { createLogger, format, transports } = require('winston');
  const { combine, timestamp, errors, json, colorize, printf } = format;

  const isDev = process.env.NODE_ENV !== 'production';

  const devFormat = combine(
    colorize({ all: true }),
    timestamp({ format: 'HH:mm:ss' }),
    errors({ stack: true }),
    printf(({ timestamp: ts, level, message, stack, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
      return `${ts} [${level}] ${message}${metaStr}${stack ? '\n' + stack : ''}`;
    })
  );

  const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
  );

  logger = createLogger({
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    format: isDev ? devFormat : prodFormat,
    transports: [new transports.Console()],
    exitOnError: false,
  });
} catch (_) {
  // Graceful fallback if Winston is not installed
  const noop = () => {};
  logger = {
    error: (...args) => console.error('[ERROR]', ...args),
    warn:  (...args) => console.warn('[WARN]', ...args),
    info:  (...args) => console.log('[INFO]', ...args),
    http:  noop,
    debug: noop,
  };
}

module.exports = logger;
