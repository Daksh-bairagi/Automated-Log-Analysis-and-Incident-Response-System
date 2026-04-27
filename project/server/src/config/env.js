/**
 * ============================================================================
 * ENVIRONMENT CONFIGURATION
 * ============================================================================
 * Loads environment variables from .env and exposes them as a frozen config
 * object. Every module that needs runtime configuration imports this file
 * instead of reading process.env directly — providing a single, validated
 * source of truth.
 *
 * FLOW:
 *   .env file → dotenv.config() → process.env → resolveConfig() → config{}
 *
 * USAGE:
 *   const config = require('./config/env');
 *   console.log(config.PORT); // 3001
 * ============================================================================
 */

const path = require('path');
const dotenv = require('dotenv');

// ---------------------------------------------------------------------------
// Load .env from the server directory root (one level up from src/config/)
// ---------------------------------------------------------------------------
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * resolveConfig() — Reads process.env and returns a normalized config object.
 * Provides sensible defaults so the app can run even without a .env file.
 *
 * @returns {Object} Frozen configuration object
 */

function resolveConfig() {
  return Object.freeze({
    // ---- Server ----
    PORT: parseInt(process.env.PORT, 10) || 3001,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // ---- MongoDB ----
    MONGO_URI: process.env.MONGO_URI || '',
    DB_NAME: process.env.DB_NAME || 'log_analyzer',

    // ---- Redis (for BullMQ / future use) ----


    // ---- Log Configuration ----
    LOG_DIR: process.env.LOG_DIR || path.resolve(__dirname, '../../../logs'),
    UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../uploads'),
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024,

    // ---- Notification channels (optional) ----
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL || '',
    EMAIL_PROVIDER: (process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase(),
    SMTP_HOST: process.env.SMTP_HOST || '',
    SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || '',
    RESEND_API_BASE_URL: process.env.RESEND_API_BASE_URL || 'https://api.resend.com',
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO || '',
    WEBHOOK_URL: process.env.WEBHOOK_URL || '',
    GOOGLE_CHAT_WEBHOOK_URL: process.env.GOOGLE_CHAT_WEBHOOK_URL || '',
    GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_EMAIL || '',
    GOOGLE_CHAT_PRIVATE_KEY: (process.env.GOOGLE_CHAT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    GOOGLE_CHAT_MIN_SEVERITY: process.env.GOOGLE_CHAT_MIN_SEVERITY || 'LOW',

    // ---- JWT Auth ----
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

    // ---- Google OAuth ----
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',

    // ---- Output ----
    OUTPUT_DIR: process.env.OUTPUT_DIR || path.resolve(__dirname, '../../output'),

    // ---- ML Classifier Microservice ----
    ML_SERVICE_URL:          process.env.ML_SERVICE_URL          || 'http://localhost:5001',
    ML_ENABLED:              process.env.ML_ENABLED              !== 'false', // default true
    ML_CONFIDENCE_THRESHOLD: parseFloat(process.env.ML_CONFIDENCE_THRESHOLD || '0.75'),
    ML_TIMEOUT_MS:           parseInt(process.env.ML_TIMEOUT_MS  || '300', 10),
  });
}

// Export the resolved configuration as a singleton
module.exports = resolveConfig();
