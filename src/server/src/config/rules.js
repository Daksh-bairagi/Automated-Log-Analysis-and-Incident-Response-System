/**
 * ============================================================================
 * BUSINESS RULES CONFIGURATION
 * ============================================================================
 * Defines the rule sets that drive the analysis pipeline:
 *
 *   1. SEVERITY MAP    — Maps log levels → severity grades (HIGH/MEDIUM/LOW)
 *   2. INCIDENT RULES  — Keywords and conditions that trigger incident detection
 *   3. PLAYBOOK DEFS   — Response playbooks with descriptions and action lists
 *
 * This file acts as the "brain" of the analysis engine. Changing rules here
 * alters how the SeverityClassifier, IncidentDetector, and ResponsePlanner
 * behave — without touching any service code.
 *
 * DATA FLOW:
 *   rules.js ──▶ SeverityClassifier (severityMap)
 *             ──▶ IncidentDetector  (incidentRules)
 *             ──▶ ResponsePlanner   (playbooks)
 * ============================================================================
 */

const { SEVERITY, PLAYBOOKS, LOG_LEVELS } = require('../../../shared/constants');

// -----------------------------------------------------------------------------
// 1. SEVERITY MAP — Log level to severity grade mapping.
//    Used by SeverityClassifier.classify(entry) to label each LogEntry.
//    Any level not listed here defaults to LOW.
// -----------------------------------------------------------------------------
const severityMap = Object.freeze({
  [LOG_LEVELS.CRITICAL]: SEVERITY.CRITICAL,
  [LOG_LEVELS.FATAL]: SEVERITY.CRITICAL,
  [LOG_LEVELS.ERROR]: SEVERITY.HIGH,
  [LOG_LEVELS.WARNING]: SEVERITY.MEDIUM,
  [LOG_LEVELS.WARN]: SEVERITY.MEDIUM,     // Alias support
  [LOG_LEVELS.INFO]: SEVERITY.LOW,
  [LOG_LEVELS.DEBUG]: SEVERITY.LOW,
  [LOG_LEVELS.TRACE]: SEVERITY.LOW,
});

// -----------------------------------------------------------------------------
// 2. INCIDENT DETECTION RULES — Defines how IncidentDetector decides
//    whether a log entry constitutes an incident.
//
//    Detection logic (applied in order):
//      a) If severity === HIGH → automatic incident (highSeverityAutoIncident)
//      b) If message contains any keyword → incident (keywords[])
//
//    Keywords are case-insensitive and matched as substrings.
// -----------------------------------------------------------------------------
const keywordWeights = Object.freeze({
  unauthorized: 3,
  breach: 3,
  attack: 3,
  exploit: 3,
  injection: 3,
  malware: 3,
  failed: 2,
  denied: 2,
  suspicious: 2,
  crash: 2,
  overflow: 2,
  outage: 2,
  timeout: 1,
  retry: 1,
  degraded: 1,
});

const frequencyRules = Object.freeze({
  windowSeconds: 120,
  thresholds: Object.freeze([
    Object.freeze({ count: 20, boost: 3 }),
    Object.freeze({ count: 10, boost: 2 }),
    Object.freeze({ count: 5, boost: 1 }),
  ]),
});

const incidentKeywords = Object.freeze([
  'unauthorized',
  'timeout',
  'suspicious',
  'failed',
  'crash',
  'denied',
  'breach',
  'attack',
  'exploit',
  'overflow',
  'injection',
  'malware',
  'intrusion',
]);

const incidentRules = Object.freeze({
  highSeverityAutoIncident: true,
  keywords: incidentKeywords,
});

// -----------------------------------------------------------------------------
// 3. PLAYBOOK DEFINITIONS — Response strategies assigned by ResponsePlanner.
//    Each playbook has:
//      - name:        Unique identifier matching PLAYBOOKS constants
//      - description: Human-readable summary of the strategy
//      - actions:     Ordered list of recommended response actions
//
//    Selection logic (in ResponsePlanner):
//      a) If source contains "security" OR message has "unauthorized"/"suspicious"
//         → SECURITY_CONTAINMENT
//      b) If level is ERROR OR message has "failed"/"crash"
//         → SERVICE_RECOVERY
//      c) Otherwise → MANUAL_TRIAGE
// -----------------------------------------------------------------------------
const playbooks = Object.freeze({
  [PLAYBOOKS.SECURITY_CONTAINMENT]: {
    name: PLAYBOOKS.SECURITY_CONTAINMENT,
    description: 'Immediate containment and investigation of security threats',
    actions: Object.freeze([
      'Isolate affected systems from network',
      'Revoke compromised credentials immediately',
      'Capture forensic snapshots of affected hosts',
      'Notify security operations center (SOC)',
      'Review access logs for lateral movement',
      'Initiate incident report for compliance',
    ]),
  },

  [PLAYBOOKS.CASCADE_RECOVERY]: {
    name: PLAYBOOKS.CASCADE_RECOVERY,
    description: 'Recover multi-service dependency failures in a controlled order',
    actions: Object.freeze([
      'Identify the first failing dependency or service',
      'Check shared infrastructure and downstream consumers',
      'Restart or restore services in dependency order',
      'Enable safeguards such as circuit breakers or queue draining',
      'Scale healthy instances to absorb recovery load',
      'Monitor the system for at least 30 minutes after recovery',
    ]),
  },

  [PLAYBOOKS.SERVICE_RECOVERY]: {
    name: PLAYBOOKS.SERVICE_RECOVERY,
    description: 'Restore service availability and diagnose root cause',
    actions: Object.freeze([
      'Check service health endpoints and restart if needed',
      'Review recent deployment or configuration changes',
      'Examine error logs for stack traces or dependency failures',
      'Scale up resources if under load pressure',
      'Notify on-call engineering team',
      'Schedule post-incident review (PIR)',
    ]),
  },

  [PLAYBOOKS.PERFORMANCE_REMEDIATION]: {
    name: PLAYBOOKS.PERFORMANCE_REMEDIATION,
    description: 'Stabilize degraded performance and latency spikes',
    actions: Object.freeze([
      'Check service and dependency health endpoints',
      'Review recent deployments and config changes',
      'Inspect CPU, memory, disk, and saturation metrics',
      'Review slow queries, connection pools, and retry storms',
      'Scale resources or enable caching as needed',
      'Create a performance follow-up ticket or post-mortem action',
    ]),
  },

  [PLAYBOOKS.MANUAL_TRIAGE]: {
    name: PLAYBOOKS.MANUAL_TRIAGE,
    description: 'Manual assessment for ambiguous or low-context incidents',
    actions: Object.freeze([
      'Review full log context around the triggering entry',
      'Correlate with other system metrics and dashboards',
      'Determine if the anomaly is a false positive',
      'Escalate to appropriate team if action is required',
      'Document findings for future reference',
    ]),
  },
});

module.exports = {
  severityMap,
  keywordWeights,
  frequencyRules,
  incidentKeywords,
  incidentRules,
  playbooks,
};
