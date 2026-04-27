/**
 * ============================================================================
 * ALERT CHANNELS CONFIG — Notification Channel Configuration
 * ============================================================================
 * Centralizes all notification channel settings. Values are loaded from
 * environment variables so no secrets are committed to source control.
 *
 * CHANNELS:
 *   - Slack   → Incoming Webhook URL
 *   - Email   → SMTP credentials (Nodemailer)
 *   - Webhook → Generic HTTP POST endpoint
 *
 * USAGE:
 *   const alertChannels = require('../config/alertChannels');
 *   const slack = new SlackChannel(alertChannels.slack);
 * ============================================================================
 */

module.exports = {
  /**
   * Slack incoming webhook configuration.
   * Set SLACK_WEBHOOK_URL in your .env to enable.
   */
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    minSeverity: process.env.SLACK_MIN_SEVERITY || 'HIGH', // CRITICAL | HIGH | MEDIUM | LOW
    enabled: !!process.env.SLACK_WEBHOOK_URL,
  },

  /**
   * Email/SMTP configuration (Nodemailer).
   * Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_TO in your .env.
   */
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
    to: process.env.EMAIL_TO || '',
    minSeverity: process.env.EMAIL_MIN_SEVERITY || 'CRITICAL',
    enabled: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_TO),
  },

  /**
   * Generic HTTP webhook configuration.
   * Set WEBHOOK_URL in your .env to enable.
   */
  webhook: {
    url: process.env.WEBHOOK_URL || '',
    secret: process.env.WEBHOOK_SECRET || '',
    minSeverity: process.env.WEBHOOK_MIN_SEVERITY || 'HIGH',
    enabled: !!process.env.WEBHOOK_URL,
  },
};
