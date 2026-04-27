/**
 * ============================================================================
 * NOTIFICATION SERVICE — Multi-channel incident alert coordinator
 * ============================================================================
 * Handles alert fan-out with deduplication and lightweight escalation.
 *
 * FLOW:
 *   incident -> dedupe check -> enabled channels -> send -> escalation register
 * ============================================================================
 */

class NotificationService {
  /**
   * @param {Object} deps
   * @param {Array} deps.channels - Channel strategy instances
   * @param {Object} deps.deduplicator - AlertDeduplicator instance
   * @param {Object} deps.escalationPolicy - EscalationPolicy instance
   */
  constructor({ channels, deduplicator, escalationPolicy }) {
    this.channels = Array.isArray(channels) ? channels : [];
    this.deduplicator = deduplicator;
    this.escalationPolicy = escalationPolicy;

    this._maxAttempts = 3;
    this._baseDelayMs = 250;
    this._sendTimeoutMs = 5000;
  }

  /**
   * Sends notifications for one incident when applicable.
   *
   * @param {Object} incident - Incident object
   * @returns {Promise<Object>} Notification summary
   */
  async notify(incident) {
    const dedupeKey = this._buildDedupeKey(incident);

    if (this.deduplicator && this.deduplicator.isDuplicate(dedupeKey)) {
      return {
        sent: false,
        reason: 'duplicate',
        results: [],
      };
    }

    const results = [];

    for (const channel of this.channels) {
      if (!channel || typeof channel.isEnabled !== 'function') continue;
      if (!channel.isEnabled(incident)) continue;
      if (typeof channel.shouldTrigger === 'function' && !channel.shouldTrigger(incident.severity, incident)) {
        continue;
      }

      try {
        await this._retryWithBackoff(() => this._sendWithTimeout(channel, incident));
        results.push({ channel: channel.name || 'unknown', status: 'sent' });
      } catch (error) {
        results.push({
          channel: channel.name || 'unknown',
          status: 'failed',
          message: error.message,
        });
      }
    }

    if (results.some((r) => r.status === 'sent') && this.deduplicator) {
      this.deduplicator.record(dedupeKey);
    }

    if (incident.severity === 'CRITICAL' && this.escalationPolicy) {
      this.escalationPolicy.register(incident);
    }

    return {
      sent: results.some((r) => r.status === 'sent'),
      reason: results.length ? 'processed' : 'no-enabled-channels',
      results,
    };
  }

  _buildDedupeKey(incident) {
    const type = incident.type || 'unknown';
    const source = incident.source || 'unknown';
    const severity = incident.severity || 'UNKNOWN';
    const message = (incident.message || '').toLowerCase().slice(0, 120);
    const recipient = String(
      incident.notificationPreferences?.email ||
      incident.notificationRecipientEmail ||
      incident.recipientEmail ||
      incident.userEmail ||
      incident.ownerId ||
      'global'
    ).toLowerCase();
    return `${recipient}:${severity}:${type}:${source}:${message}`;
  }

  async _sendWithTimeout(channel, incident) {
    let timeoutId = null;
    try {
      return await Promise.race([
        channel.send(incident),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Channel timeout after ${this._sendTimeoutMs}ms`));
          }, this._sendTimeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async _retryWithBackoff(task) {
    let lastError;

    for (let attempt = 1; attempt <= this._maxAttempts; attempt++) {
      try {
        return await task();
      } catch (error) {
        lastError = error;
        if (attempt === this._maxAttempts) {
          break;
        }

        const delay = this._baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

module.exports = NotificationService;
