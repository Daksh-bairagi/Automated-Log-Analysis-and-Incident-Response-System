/**
 * ============================================================================
 * SLACK CHANNEL — Sends incident alerts to Slack Incoming Webhook
 * ============================================================================
 */

const axios = require('axios');

class SlackChannel {
  /**
   * @param {Object} config - App config
   */
  constructor(config) {
    this.name = 'slack';
    this.webhookUrl = config.SLACK_WEBHOOK_URL || '';
  }

  isEnabled() {
    return Boolean(this.webhookUrl);
  }

  shouldTrigger(severity) {
    return severity === 'CRITICAL' || severity === 'HIGH';
  }

  async send(incident) {
    const text = [
      `ALERT: ${incident.severity || 'UNKNOWN'} incident`,
      `ID: ${incident.id || 'N/A'}`,
      `Source: ${incident.source || 'unknown'}`,
      `Message: ${incident.message || ''}`,
      `Playbook: ${incident.playbook || 'manual-triage'}`,
    ].join('\n');

    await axios.post(this.webhookUrl, { text });
  }
}

module.exports = SlackChannel;
