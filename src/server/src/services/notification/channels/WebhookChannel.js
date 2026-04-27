/**
 * ============================================================================
 * WEBHOOK CHANNEL — Sends incident alerts to a generic webhook endpoint
 * ============================================================================
 */

const axios = require('axios');

class WebhookChannel {
  /**
   * @param {Object} config - App config
   */
  constructor(config) {
    this.name = 'webhook';
    this.url = config.WEBHOOK_URL || '';
  }

  isEnabled() {
    return Boolean(this.url);
  }

  shouldTrigger(severity) {
    return severity === 'CRITICAL' || severity === 'HIGH';
  }

  async send(incident) {
    await axios.post(this.url, {
      type: 'incident-alert',
      sentAt: new Date().toISOString(),
      incident: {
        id: incident.id || null,
        severity: incident.severity || 'UNKNOWN',
        source: incident.source || 'unknown',
        timestamp: incident.timestamp || null,
        message: incident.message || '',
        playbook: incident.playbook || 'manual-triage',
        actions: Array.isArray(incident.actions) ? incident.actions : [],
      },
    });
  }
}

module.exports = WebhookChannel;
