/**
 * ============================================================================
 * ALERT EVENT MODEL — Notification Event Shape
 * ============================================================================
 * Represents a single alert notification dispatched for an incident.
 * Persisted in the DB 'alerts' collection after a notification is sent.
 *
 * SCHEMA (matches MongoDB 'alerts' collection):
 *   _id         {ObjectId}  Auto-assigned
 *   incidentId  {string}    The incident that triggered this alert
 *   channel     {string}    'slack' | 'email' | 'webhook'
 *   status      {string}    'sent' | 'failed' | 'skipped'
 *   dedupeKey   {string}    Deduplication key used
 *   retryCount  {number}    Number of send attempts made
 *   sentAt      {Date}      Timestamp of successful send (null if failed)
 * ============================================================================
 */

class AlertEvent {
  /**
   * @param {Object} params
   * @param {string}  params.incidentId
   * @param {string}  params.channel
   * @param {string}  params.status
   * @param {string}  params.dedupeKey
   * @param {number}  [params.retryCount=0]
   * @param {Date}    [params.sentAt]
   */
  constructor({ incidentId, channel, status, dedupeKey, retryCount = 0, sentAt = null }) {
    this.incidentId = incidentId;
    this.channel = channel;
    this.status = status;           // 'sent' | 'failed' | 'skipped'
    this.dedupeKey = dedupeKey;
    this.retryCount = retryCount;
    this.sentAt = sentAt;
  }

  toJSON() {
    return {
      incidentId: this.incidentId,
      channel: this.channel,
      status: this.status,
      dedupeKey: this.dedupeKey,
      retryCount: this.retryCount,
      sentAt: this.sentAt,
    };
  }
}

module.exports = AlertEvent;
