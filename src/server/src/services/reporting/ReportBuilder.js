/**
 * ============================================================================
 * REPORT BUILDER — Analysis Report Generator
 * ============================================================================
 * Aggregates the results of the analysis pipeline into a structured report
 * object. This report is the primary output of each analysis run and serves
 * as the data model for both persistence (MongoDB/file) and presentation
 * (CLI display, dashboard view model).
 *
 * REPORT STRUCTURE:
 *   {
 *     generatedAt:       ISO 8601 timestamp of report creation
 *     processedEntries:  Total log entries processed
 *     detectedIncidents: Number of incidents detected
 *     severityBreakdown: { HIGH: n, MEDIUM: n, LOW: n }
 *     incidents:         IncidentRecord[] (full incident objects)
 *     logFiles:          string[] (analyzed file paths)
 *     parseErrors:       Number of lines that failed to parse
 *   }
 *
 * DATA FLOW:
 *   Analysis results → ReportBuilder.build(...) → Report object
 *
 * USAGE:
 *   const builder = new ReportBuilder();
 *   const report = builder.build(entries, incidents, breakdown, logFiles, parseErrorCount);
 * ============================================================================
 */

class ReportBuilder {
  /**
   * Builds a structured analysis report from pipeline results.
   *
   * @param {import('../../models/LogEntry')[]} entries - All parsed log entries
   * @param {import('../../models/IncidentRecord')[]} incidents - Detected incidents
   * @param {Object} severityBreakdown - { HIGH: n, MEDIUM: n, LOW: n }
   * @param {string[]} logFiles - File paths that were analyzed
   * @param {number} parseErrorCount - Number of lines that failed to parse
   * @returns {Object} Structured report object
   */
  build(entriesOrPayload, incidentsArg, severityBreakdownArg, logFilesArg, parseErrorCountArg) {
    const payload = Array.isArray(entriesOrPayload)
      ? {
          entries: entriesOrPayload,
          incidents: incidentsArg || [],
          severityBreakdown: severityBreakdownArg || {},
          files: logFilesArg || [],
          parseErrors: parseErrorCountArg || 0,
          fileFormats: {},
        }
      : (entriesOrPayload || {});

    const entries = payload.entries || [];
    const incidents = payload.incidents || [];
    const files = payload.files || payload.logFiles || [];
    const parseErrors = Array.isArray(payload.parseErrors)
      ? payload.parseErrors.length
      : (payload.parseErrors || 0);
    const fileFormats = payload.fileFormats || payload.formatDistribution || {};
    const severityBreakdown = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      ...(payload.severityBreakdown || {}),
    };
    const incidentsByType = {};

    for (const incident of incidents) {
      const type = incident.type || 'unknown';
      incidentsByType[type] = (incidentsByType[type] || 0) + 1;
    }

    const processedEntries = entries.length;
    const incidentRate = processedEntries === 0
      ? '0.00%'
      : `${((incidents.length / processedEntries) * 100).toFixed(2)}%`;

    return {
      generatedAt: new Date().toISOString(),
      processedEntries,
      detectedIncidents: incidents.length,
      severityBreakdown,
      incidentsByType,
      incidents: incidents.map((inc) =>
        typeof inc.toJSON === 'function' ? inc.toJSON() : inc
      ),
      logFiles: files,
      parseErrors,
      formatDistribution: fileFormats,
      metrics: {
        incidentRate,
        criticalCount: severityBreakdown.CRITICAL || 0,
      },
    };
  }
}

module.exports = ReportBuilder;
