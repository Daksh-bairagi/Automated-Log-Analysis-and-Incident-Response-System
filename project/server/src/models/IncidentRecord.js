/**
 * ============================================================================
 * INCIDENT RECORD — Domain Model
 * ============================================================================
 * Represents a detected security or operational incident. Created when the
 * IncidentDetector flags a LogEntry as an incident, enriched by the
 * ResponsePlanner with a playbook and action items.
 *
 * LIFECYCLE:
 *   LogEntry → IncidentDetector.isIncident() === true
 *            → ResponsePlanner.plan(entry, severity)
 *            → new IncidentRecord(...)
 *
 * PROPERTIES:
 *   - id        {string}  Unique incident identifier (e.g., "INC-001")
 *   - severity  {string}  Severity grade: CRITICAL, HIGH, MEDIUM, or LOW
 *   - source    {string}  Component that generated the log entry
 *   - timestamp {string}  When the incident occurred
 *   - message   {string}  Descriptive incident message
 *   - type      {string}  Detection category (severity-trigger, brute-force-attack, ...)
 *   - reason    {string}  Human-readable trigger reason
 *   - playbook  {string}  Assigned response playbook name
  *   - actions   {Array}   Recommended response actions
 *   - priority  {string}  Playbook priority (P1-P4)
 *   - status    {string}  Current lifecycle state (default: OPEN)
 * ============================================================================
 */

const { STATUS } = require('../../../shared/constants');

class IncidentRecord {
  // Static counter for generating sequential incident IDs within a session
  static _counter = 0;

  /**
   * Creates a new IncidentRecord instance.
   *
   * @param {Object}   params            - Incident properties
   * @param {string}   [params.id]       - Custom ID, or auto-generated if omitted
   * @param {string}   params.severity   - Severity grade (HIGH/MEDIUM/LOW)
   * @param {string}   params.source     - Source component
   * @param {string}   params.timestamp  - Event timestamp
   * @param {string}   params.message    - Incident description
   * @param {string}   [params.type]     - Detection type
   * @param {string}   [params.reason]   - Detection reason
   * @param {string}   [params.playbook] - Assigned playbook name
   * @param {string[]} [params.actions]  - Response action list
   * @param {string}   [params.priority] - Assigned playbook priority
   * @param {string}   [params.status]   - Initial status (default: OPEN)
   */
  constructor({ id, severity, source, timestamp, message, type, reason, playbook, actions, priority, status, metadata, eventCount }) {
    // Auto-generate a sequential ID if none is provided
    this.id = id || IncidentRecord.generateId();
    this.severity = severity;
    this.source = source;
    this.timestamp = timestamp;
    this.message = message;
    this.type = type || 'manual-triage';
    this.reason = reason || '';
    this.playbook = playbook || 'manual-triage';
    this.actions = actions || [];
    this.priority = priority || 'P4';
    this.status = status || STATUS.OPEN;
    this.metadata = metadata || {};
    this.eventCount = typeof eventCount === 'number' ? eventCount : undefined;
  }

  /**
   * Generates a sequential incident ID in the format "INC-001", "INC-002", etc.
   * Counter resets per application session (not persisted).
   *
   * @returns {string} Formatted incident ID
   */
  static generateId() {
    IncidentRecord._counter += 1;
    return `INC-${String(IncidentRecord._counter).padStart(3, '0')}`;
  }

  /**
   * Resets the ID counter. Used between analysis runs or in tests
   * to ensure predictable ID sequences.
   */
  static resetCounter() {
    IncidentRecord._counter = 0;
  }

  /**
   * Converts this record to a plain object for JSON serialization
   * or MongoDB persistence.
   *
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      id: this.id,
      severity: this.severity,
      source: this.source,
      timestamp: this.timestamp,
      message: this.message,
      type: this.type,
      reason: this.reason,
      playbook: this.playbook,
      actions: [...this.actions],
      priority: this.priority,
      status: this.status,
      metadata: { ...this.metadata },
      ...(typeof this.eventCount === 'number' ? { eventCount: this.eventCount } : {}),
    };
  }

  /**
   * Returns a compact string representation for CLI display.
   *
   * @returns {string} Formatted string
   */
  toString() {
    return `[${this.id}] ${this.severity} — ${this.source}: ${this.message} (${this.playbook})`;
  }
}

module.exports = IncidentRecord;
