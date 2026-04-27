/**
 * ============================================================================
 * ReportViewModelBuilder — View Model Transformer
 * ============================================================================
 * Transforms raw analysis reports into view models optimized for the React
 * dashboard. Separates backend data structures from frontend display concerns.
 *
 * RESPONSIBILITIES:
 *   1. attachMetadata(report, meta) — Enrich a report with context metadata
 *   2. toDashboardView(report)      — Transform report → DashboardView shape
 *
 * DASHBOARD VIEW STRUCTURE:
 *   {
 *     summary: { totalEntries, totalIncidents, parseErrors, generatedAt, severityBreakdown },
 *     analyzedFiles: string[],
 *     incidents: [{ id, severity, source, timestamp, message, playbook, actions, status }],
 *   }
 *
 * DATA FLOW:
 *   Report → attachMetadata() → toDashboardView() → DashboardView
 *
 * USAGE:
 *   const vmBuilder = new ReportViewModelBuilder();
 *   const enriched = vmBuilder.attachMetadata(report, { analysisType: 'file' });
 *   const view = vmBuilder.toDashboardView(enriched);
 * ============================================================================
 */

class ReportViewModelBuilder {
  /**
   * Enriches a raw report with additional metadata for context.
   *
   * @param {Object} report - Raw analysis report from ReportBuilder
   * @param {Object} meta - Additional metadata to attach
   * @param {string} [meta.analysisType] - Type of analysis ('file', 'upload', 'cli')
   * @param {string} [meta.requestedBy] - Who triggered the analysis
   * @param {number} [meta.durationMs] - How long analysis took
   * @returns {Object} Report enriched with metadata
   */
  attachMetadata(report, meta = {}) {
    return {
      ...report,
      metadata: {
        analysisType: meta.analysisType || 'file',
        requestedBy: meta.requestedBy || 'system',
        durationMs: meta.durationMs || 0,
        enrichedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Transforms an analysis report into a DashboardView model.
   * This is the shape consumed by the React frontend components.
   *
   * @param {Object} report - Analysis report (raw or enriched)
   * @returns {Object} DashboardView with summary, files, and incident data
   */
  toDashboardView(report) {
    const severityBreakdown = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      ...(report.severityBreakdown || {}),
    };

    return {
      summary: {
        totalEntries: report.processedEntries || 0,
        totalIncidents: report.detectedIncidents || 0,
        total: report.processedEntries || 0,
        incidents: report.detectedIncidents || 0,
        critical: severityBreakdown.CRITICAL || 0,
        high: severityBreakdown.HIGH || 0,
        medium: severityBreakdown.MEDIUM || 0,
        low: severityBreakdown.LOW || 0,
        parseErrors: report.parseErrors || 0,
        generatedAt: report.generatedAt || null,
        severityBreakdown,
        incidentRate: report.metrics?.incidentRate || '0.00%',
      },
      severityChart: severityBreakdown,
      incidentTypeChart: report.incidentsByType || {},
      analyzedFiles: (report.logFiles || []).map((filePath) => {
        const parts = filePath.replace(/\\/g, '/').split('/');
        return {
          fullPath: filePath,
          name: parts[parts.length - 1] || filePath,
          format: report.formatDistribution?.[filePath] || null,
        };
      }),
      incidents: (report.incidents || []).map((inc) => ({
        id: inc.id,
        severity: inc.severity,
        type: inc.type,
        source: inc.source,
        timestamp: inc.timestamp,
        message: inc.message,
        reason: inc.reason,
        playbook: inc.playbook,
        actionCount: (inc.actions || []).length,
        actions: inc.actions || [],
        priority: inc.priority || null,
        status: inc.status || 'OPEN',
      })),
      generatedAt: report.generatedAt || null,
    };
  }
}

module.exports = ReportViewModelBuilder;
