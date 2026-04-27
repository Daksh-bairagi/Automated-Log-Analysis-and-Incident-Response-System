/**
 * ============================================================================
 * SHARED CONSTANTS
 * ============================================================================
 * Centralized constants used by both the server (Node.js) and client (React).
 * This module is the single source of truth for severity levels, incident
 * statuses, detection keywords, playbook names, and log format specifications.
 *
 * USAGE:
 *   const { SEVERITY, STATUS, KEYWORDS } = require('../../shared/constants');
 * ============================================================================
 */

// -----------------------------------------------------------------------------
// SEVERITY LEVELS — Ordered from most critical to least critical.
// Used by SeverityClassifier to label each log entry.
// -----------------------------------------------------------------------------
const SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL', // Active attack, outage, or incident needing immediate response
  HIGH: 'HIGH',       // Critical errors, security breaches, system crashes
  MEDIUM: 'MEDIUM',   // Warnings, degraded performance, retry scenarios
  LOW: 'LOW',         // Informational messages, successful operations
});

// -----------------------------------------------------------------------------
// INCIDENT STATUS — Lifecycle states for tracked incidents.
// An incident starts as OPEN, can be ACKNOWLEDGED by an operator,
// and eventually RESOLVED or CLOSED.
// -----------------------------------------------------------------------------
const STATUS = Object.freeze({
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

// -----------------------------------------------------------------------------
// LOG LEVELS — Standard syslog-style levels parsed from raw log lines.
// The LogParser extracts these from the level field of each log entry.
// -----------------------------------------------------------------------------
const LOG_LEVELS = Object.freeze({
  CRITICAL: 'CRITICAL',
  FATAL: 'FATAL',
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  WARN: 'WARN',       // Alias for WARNING (some systems use WARN)
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  TRACE: 'TRACE',
});

// -----------------------------------------------------------------------------
// INCIDENT DETECTION KEYWORDS — Trigger words that flag a log entry as a
// potential incident even if its severity isn't HIGH.
// IncidentDetector scans the message field for these patterns.
// -----------------------------------------------------------------------------
const KEYWORDS = Object.freeze({
  SECURITY: ['unauthorized', 'forbidden', 'denied', 'suspicious', 'breach', 'intrusion'],
  FAILURE: ['failed', 'failure', 'crash', 'fatal', 'exception', 'timeout'],
  ANOMALY: ['multiple', 'retry', 'repeated', 'threshold', 'exceeded', 'spike'],
});

// -----------------------------------------------------------------------------
// ALL INCIDENT KEYWORDS — Flattened list of all keyword categories.
// Used by IncidentDetector for a single-pass message scan.
// -----------------------------------------------------------------------------
const ALL_INCIDENT_KEYWORDS = Object.freeze([
  ...KEYWORDS.SECURITY,
  ...KEYWORDS.FAILURE,
  ...KEYWORDS.ANOMALY,
]);

// -----------------------------------------------------------------------------
// PLAYBOOK NAMES — Named response strategies assigned by ResponsePlanner.
// Each playbook maps to a set of recommended actions.
// -----------------------------------------------------------------------------
const PLAYBOOKS = Object.freeze({
  SECURITY_CONTAINMENT: 'security-containment',
  CASCADE_RECOVERY: 'cascade-recovery',
  SERVICE_RECOVERY: 'service-recovery',
  PERFORMANCE_REMEDIATION: 'performance-remediation',
  MANUAL_TRIAGE: 'manual-triage',
});

// -----------------------------------------------------------------------------
// LOG FORMAT — Expected structure of raw log lines.
// Format: "YYYY-MM-DD HH:mm:ss LEVEL SOURCE Message text here"
// Minimum 5 space-delimited tokens required for a valid log line.
// -----------------------------------------------------------------------------
const LOG_FORMAT = Object.freeze({
  MIN_TOKENS: 5,                     // Minimum fields for a valid line
  TIMESTAMP_PARTS: 2,                // "2026-04-04" + "09:00:00"
  LEVEL_INDEX: 2,                    // Index of the log level token
  SOURCE_INDEX: 3,                   // Index of the source/component token
  MESSAGE_START_INDEX: 4,            // Message starts at this token index
});

// -----------------------------------------------------------------------------
// FILE CONSTRAINTS — Upload and processing limits.
// -----------------------------------------------------------------------------
const FILE_CONSTRAINTS = Object.freeze({
  MAX_UPLOAD_SIZE: 10 * 1024 * 1024, // 10 MB max upload size
  MAX_UPLOAD_FILES: 10,              // Max files per upload request
  ALLOWED_EXTENSIONS: ['.log', '.pdf'],
  ALLOWED_MIME_TYPES: [
    'text/plain',
    'application/pdf',
    'application/octet-stream',      // Fallback for .log files
  ],
});

// -----------------------------------------------------------------------------
// API PATHS — REST endpoint paths. Keeps frontend and backend in sync.
// -----------------------------------------------------------------------------
const API_PATHS = Object.freeze({
  HEALTH: '/api/health',
  ANALYZE: '/api/analyze',
  ANALYZE_UPLOAD: '/api/upload',
  REPORT_LATEST: '/api/reports/latest',
  UPLOADS: '/api/upload/list',
});

// -----------------------------------------------------------------------------
// COLLECTION NAMES — MongoDB collection identifiers.
// Used by MongoDatabase and all repository classes.
// -----------------------------------------------------------------------------
const COLLECTIONS = Object.freeze({
  REPORTS: 'reports',
  INCIDENTS: 'incidents',
  LOG_ENTRIES: 'log_entries',
  SOURCE_DOCUMENTS: 'source_documents',
});

module.exports = {
  SEVERITY,
  STATUS,
  LOG_LEVELS,
  KEYWORDS,
  ALL_INCIDENT_KEYWORDS,
  PLAYBOOKS,
  LOG_FORMAT,
  FILE_CONSTRAINTS,
  API_PATHS,
  COLLECTIONS,
};
