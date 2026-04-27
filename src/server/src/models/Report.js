/**
 * ============================================================================
 * REPORT MODEL — Report Object Shape
 * ============================================================================
 * Defines the shape of a generated analysis report. Produced by ReportBuilder
 * after running the full analysis pipeline, and persisted by the Repository.
 *
 * SCHEMA (matches MongoDB 'reports' collection):
 *   _id                {ObjectId}  Auto-assigned by MongoDB
 *   generatedAt        {string}    ISO timestamp of report creation
 *   processedEntries   {number}    Total log lines successfully parsed
 *   detectedIncidents  {number}    Total incidents found
 *   severityBreakdown  {Object}    { CRITICAL, HIGH, MEDIUM, LOW } counts
 *   incidentsByType    {Object}    { 'brute-force-attack': 3, ... }
  *   logFiles           {string[]}  Source file paths
  *   parseErrors        {number}    Lines that failed to parse
 *   formatDistribution  {Object}    Source file -> detected format
 *   metrics            {Object}    Derived summary metrics
 *   createdAt          {Date}      Persistence timestamp
 * ============================================================================
 */

class Report {
  /**
   * @param {Object} params
   * @param {string}   params.generatedAt
   * @param {number}   params.processedEntries
   * @param {number}   params.detectedIncidents
   * @param {Object}   params.severityBreakdown
   * @param {Object}   params.incidentsByType
   * @param {string[]} params.logFiles
   * @param {number}   params.parseErrors
   */
  constructor({
    generatedAt,
    processedEntries = 0,
    detectedIncidents = 0,
    severityBreakdown = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    incidentsByType = {},
    logFiles = [],
    parseErrors = 0,
    formatDistribution = {},
    metrics = {},
  }) {
    this.generatedAt = generatedAt || new Date().toISOString();
    this.processedEntries = processedEntries;
    this.detectedIncidents = detectedIncidents;
    this.severityBreakdown = severityBreakdown;
    this.incidentsByType = incidentsByType;
    this.logFiles = logFiles;
    this.parseErrors = parseErrors;
    this.formatDistribution = formatDistribution;
    this.metrics = metrics;
  }

  toJSON() {
    return {
      generatedAt: this.generatedAt,
      processedEntries: this.processedEntries,
      detectedIncidents: this.detectedIncidents,
      severityBreakdown: { ...this.severityBreakdown },
      incidentsByType: { ...this.incidentsByType },
      logFiles: [...this.logFiles],
      parseErrors: this.parseErrors,
      formatDistribution: { ...this.formatDistribution },
      metrics: { ...this.metrics },
    };
  }
}

module.exports = Report;
