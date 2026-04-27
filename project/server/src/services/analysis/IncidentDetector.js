/**
 * ============================================================================
 * INCIDENT DETECTOR — Threat/Anomaly Detection Service
 * ============================================================================
 * Determines whether a classified LogEntry constitutes an incident that
 * requires response. Uses a two-tier detection strategy:
 *
 *   Tier 1: AUTO-DETECT — Any entry with HIGH severity is automatically
 *           flagged as an incident (configurable via rules.highSeverityAutoIncident)
 *
 *   Tier 2: KEYWORD SCAN — If Tier 1 doesn't match, scan the entry's message
 *           for known incident keywords (unauthorized, timeout, crash, etc.)
 *
 * DATA FLOW:
 *   LogEntry (with .severity) → IncidentDetector.isIncident(entry) → boolean
 *
 * DECISION TREE (see roadmap §6):
 *   severity === HIGH?
 *     → YES → incident = true
 *     → NO  → message contains keyword?
 *               → YES → incident = true
 *               → NO  → incident = false
 *
 * USAGE:
 *   const IncidentDetector = require('./IncidentDetector');
 *   const detector = new IncidentDetector();
 *   if (detector.isIncident(entry)) { /* handle incident
 * ============================================================================
**/

const { incidentRules } = require('../../config/rules');
const { SEVERITY } = require('../../../../shared/constants');

class IncidentDetector {
  /**
   * Determines if a LogEntry constitutes an incident.
   *
   * @param {import('../../models/LogEntry')} entry - Classified LogEntry (must have .severity)
   * @returns {{ isIncident: boolean, reason?: string, type?: string }} Detection result
   */
  isIncident(entry) {
    if (
      incidentRules.highSeverityAutoIncident &&
      (entry.severity === SEVERITY.HIGH || entry.severity === SEVERITY.CRITICAL)
    ) {
      return {
        isIncident: true,
        reason: 'High severity',
        type: 'severity-trigger',
      };
    }

    const messageLower = (entry.message || '').toLowerCase();
    for (const keyword of incidentRules.keywords) {
      if (messageLower.includes(keyword)) {
        return {
          isIncident: true,
          reason: `Keyword: ${keyword}`,
          type: 'keyword-trigger',
        };
      }
    }

    return { isIncident: false };
  }

  /**
   * Scans an array of entries and returns only those flagged as incidents.
   *
   * @param {import('../../models/LogEntry')[]} entries - Array of classified entries
   * @returns {import('../../models/LogEntry')[]} Entries flagged as incidents
   */
  detectAll(entries) {
    return entries.filter((entry) => this.isIncident(entry).isIncident);
  }
}

module.exports = IncidentDetector;
