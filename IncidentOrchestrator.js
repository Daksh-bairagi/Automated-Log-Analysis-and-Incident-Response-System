const AnalysisEngine = require("../services/AnalysisEngine");
const ReportViewModelBuilder = require("./ReportViewModelBuilder");
const ValidationService = require("./ValidationService");

class IncidentOrchestrator {
  constructor({
    analysisEngine = new AnalysisEngine(),
    repository = null,
    reportViewModelBuilder = ReportViewModelBuilder,
    validationService = ValidationService
  } = {}) {
    this.analysisEngine = analysisEngine;
    this.repository = repository;
    this.reportViewModelBuilder = reportViewModelBuilder;
    this.validationService = validationService;
  }

  analyze(filePaths, { persistReport = true } = {}) {
    const normalizedFilePaths = this.validationService.ensureFilePathArray(filePaths);
    const result = this.analysisEngine.analyzeLogs(normalizedFilePaths);

    const report = this.reportViewModelBuilder.attachMetadata(result.report, {
      logFiles: normalizedFilePaths,
      parseErrors: result.parseErrors
    });
    const view = this.reportViewModelBuilder.toDashboardView(report);

    let reportPath = "";
    if (persistReport && this.repository) {
      reportPath = this.repository.saveReport(report);
    }

    return {
      analyzedFiles: normalizedFilePaths,
      entries: result.entries,
      incidents: result.incidents,
      parseErrors: result.parseErrors,
      report,
      reportPath,
      view
    };
  }

  saveReport(report) {
    if (!this.repository) {
      throw new Error("Repository is not configured for saving reports.");
    }

    const normalized = this.reportViewModelBuilder.attachMetadata(report, {
      logFiles: report && report.logFiles ? report.logFiles : [],
      parseErrors: report && Number.isInteger(report.parseErrors) ? report.parseErrors : 0
    });

    return this.repository.saveReport(normalized);
  }

  loadLatestReport() {
    if (!this.repository || typeof this.repository.readLatestReport !== "function") {
      return null;
    }

    const latest = this.repository.readLatestReport();
    if (!latest) {
      return null;
    }

    const report = this.reportViewModelBuilder.attachMetadata(latest.report, {
      logFiles: latest.report && latest.report.logFiles ? latest.report.logFiles : [],
      parseErrors: latest.report && Number.isInteger(latest.report.parseErrors)
        ? latest.report.parseErrors
        : 0
    });

    return {
      path: latest.path,
      report,
      view: this.reportViewModelBuilder.toDashboardView(report)
    };
  }
}

module.exports = IncidentOrchestrator;
