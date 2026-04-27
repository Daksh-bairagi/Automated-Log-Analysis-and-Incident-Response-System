/**
 * ============================================================================
 * AUDIT LOG MODEL — Audit Trail Entry Shape
 * ============================================================================
 * Represents a single audited action in the system. Every meaningful API
 * request is captured by the audit middleware and stored here.
 *
 * SCHEMA (matches MongoDB 'audit_logs' collection):
 *   _id       {ObjectId}  Auto-assigned
 *   action    {string}    e.g. 'POST /api/analyze'
 *   userId    {string}    Authenticated user ID (or 'anon')
 *   resource  {string}    Target resource (optional, e.g. reportId)
 *   details   {Object}    { status, durationMs, ... }
 *   timestamp {Date}      When the action occurred
 * ============================================================================
 */

class AuditLog {
  /**
   * @param {Object} params
   * @param {string}  params.action
   * @param {string}  [params.userId='anon']
   * @param {string}  [params.resource]
   * @param {Object}  [params.details={}]
   * @param {Date}    [params.timestamp]
   */
  constructor({ action, userId = 'anon', resource = '', details = {}, timestamp }) {
    this.action = action;
    this.userId = userId;
    this.resource = resource;
    this.details = details;
    this.timestamp = timestamp || new Date();
  }

  toJSON() {
    return {
      action: this.action,
      userId: this.userId,
      resource: this.resource,
      details: { ...this.details },
      timestamp: this.timestamp,
    };
  }
}

module.exports = AuditLog;
