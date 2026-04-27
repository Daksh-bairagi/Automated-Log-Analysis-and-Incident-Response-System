class ReportViewModelBuilder {
  static attachMetadata(report, { logFiles = [], parseErrors = 0 } = {}) {
    const safeReport = report && typeof report === "object" ? report : {};
    const incidents = Array.isArray(safeReport.incidents) ? safeReport.incidents : [];
    const severityBreakdown = safeReport.severityBreakdown || {};

    return {
      generatedAt: safeReport.generatedAt || new Date().toISOString(),
      processedEntries: Number(safeReport.processedEntries) || 0,
      detectedIncidents: Number(safeReport.detectedIncidents) || incidents.length,
      severityBreakdown: { ...severityBreakdown },
      incidents,
      logFiles: Array.isArray(logFiles)
        ? [...new Set(logFiles.map((item) => String(item)))]
        : [],
      parseErrors: Number.isInteger(parseErrors) ? parseErrors : 0
    };
  }

  static toDashboardView(report) {
    const normalized = this.attachMetadata(report, {
      logFiles: report && report.logFiles ? report.logFiles : [],
      parseErrors: report && Number.isInteger(report.parseErrors) ? report.parseErrors : 0
    });

    const incidents = normalized.incidents.map((incident) => {
      const actions = Array.isArray(incident.actions)
        ? incident.actions.map((action) => String(action))
        : [];

      return {
        id: String(incident.id || ""),
        severity: String(incident.severity || "LOW"),
        source: String(incident.source || "unknown"),
        timestamp: String(incident.timestamp || ""),
        message: String(incident.message || ""),
        playbook: String(incident.playbook || "manual-triage"),
        actions,
        actionCount: actions.length,
        status: String(incident.status || "OPEN")
      };
    });

    return {
      summary: {
        generatedAt: normalized.generatedAt,
        processedEntries: normalized.processedEntries,
        detectedIncidents: normalized.detectedIncidents,
        parseErrors: normalized.parseErrors,
        severityBreakdown: normalized.severityBreakdown
      },
      analyzedFiles: normalized.logFiles,
      incidents
    };
  }
}

module.exports = ReportViewModelBuilder;
