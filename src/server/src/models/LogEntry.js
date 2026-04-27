/**
 * ============================================================================
 * LOG ENTRY — Domain Model
 * ============================================================================
 * Represents a single parsed log line. Created by LogParser.parse() from a
 * raw text line. Flows through the analysis pipeline:
 *
 *   Raw Line → LogParser.parse() → LogEntry
 *                                      ↓
 *                            SeverityClassifier.classify()
 *                                      ↓
 *                            IncidentDetector.isIncident()
 *
 * EXPECTED LOG FORMAT:
 *   "2026-04-04 09:00:00 INFO system Service health check passed"
 *    ├── timestamp ──────┤ ├──┤ ├────┤ ├──── message ────────────┤
 *
 * PROPERTIES:
 *   - timestamp  {string}  Date+time string from the log line
 *   - level      {string}  Log level (ERROR, WARNING, INFO, DEBUG)
 *   - source     {string}  Component/module that generated the log
 *   - message    {string}  Descriptive message payload
 *   - rawLine    {string}  Original unmodified log line (for debugging)
 * ============================================================================
 */

class LogEntry {
  /**
   * Creates a new LogEntry instance.
   *
   * @param {Object} params - Log entry properties
   * @param {string} params.timestamp - Parsed timestamp (e.g., "2026-04-04 09:00:00")
   * @param {string} params.level     - Log level (ERROR, WARNING, INFO, DEBUG)
   * @param {string} params.source    - Source component name
   * @param {string} params.message   - Log message content
   * @param {string} params.rawLine   - Original raw log line
   */
  constructor({ timestamp, level, source, message, rawLine }) {
    this.timestamp = timestamp;
    this.level = level?.toUpperCase() || 'UNKNOWN';
    this.source = source || 'unknown';
    this.message = message || '';
    this.rawLine = rawLine || '';
  }

  /**
   * Converts this LogEntry to a plain object suitable for JSON serialization
   * or database persistence.
   *
   * @returns {Object} Plain object representation
   */
  toJSON() {
    return {
      timestamp: this.timestamp,
      level: this.level,
      source: this.source,
      message: this.message,
      rawLine: this.rawLine,
    };
  }

  /**
   * Returns a human-readable string representation of this log entry.
   * Useful for CLI display and debugging.
   *
   * @returns {string} Formatted string
   */
  toString() {
    return `[${this.timestamp}] ${this.level} (${this.source}): ${this.message}`;
  }
}

module.exports = LogEntry;
