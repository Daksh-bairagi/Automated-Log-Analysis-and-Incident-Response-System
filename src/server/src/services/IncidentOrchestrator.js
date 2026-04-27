/**
 * ============================================================================
 * INCIDENT ORCHESTRATOR — Top-Level Business Logic Coordinator
 * ============================================================================
 * The highest-level service that coordinates analysis, view model generation,
 * and persistence. Both the REST API controller and the CLI interface call
 * the orchestrator — it's the single point of integration.
 *
 * RESPONSIBILITIES:
 *   1. analyze(filePaths, options) — Run analysis + optional persistence
 *   2. analyzeLineGroups(groups)   — Analyze pre-read lines (for uploads)
 *   3. saveReport(report, context) — Persist report + incidents to storage
 *   4. getLatestReport()           — Retrieve the most recent saved report
 *
 * REAL-TIME STREAMING (Phase 9):
 *   If a streamEmitter is injected, the orchestrator emits events during
 *   analysis for live WebSocket broadcasting:
 *     - analysis:started   — When a run begins
 *     - analysis:progress  — Progress through pipeline stages
 *     - incident:detected  — For each incident found
 *     - analysis:completed — When a run finishes with summary
 *
 * ARCHITECTURE ROLE:
 *   CLI / API Controller
 *        ↓
 *   IncidentOrchestrator  ← You are here
 *        ↓         ↓           ↓
 *   AnalysisEngine  Repository  StreamEventEmitter
 *        ↓
 *   ReportViewModelBuilder
 *
 * USAGE:
 *   const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder, streamEmitter });
 *   const result = await orchestrator.analyze(filePaths, { persistReport: true });
 * ============================================================================
 */

const AnalysisEngine = require('./analysis/AnalysisEngine');
const ReportViewModelBuilder = require('./reporting/ReportViewModelBuilder');

class IncidentOrchestrator {
  /**
   * @param {Object} deps - Injected dependencies
   * @param {AnalysisEngine} [deps.engine] - Analysis engine instance
   * @param {Object} [deps.repository] - Persistence repository (Mongo or File)
   * @param {ReportViewModelBuilder} [deps.vmBuilder] - View model builder
   * @param {Object} [deps.streamEmitter] - StreamEventEmitter for real-time events
   * @param {Object} [deps.notificationService] - NotificationService for alerts
   */
    constructor({ engine, repository, vmBuilder, streamEmitter, notificationService } = {}) {
    this.engine = engine || new AnalysisEngine();
    this.repository = repository || null;
    this.vmBuilder = vmBuilder || new ReportViewModelBuilder();
    this.streamEmitter = streamEmitter || null;
      this.notificationService = notificationService || null;
  }

  /**
   * Runs the full analysis pipeline on log files plus optional persistence.
   * Emits real-time events via StreamEventEmitter if available.
   *
   * @param {string[]} filePaths - Log file paths to analyze
   * @param {Object} [options={}] - Analysis options
   * @param {boolean} [options.persistReport=false] - Whether to save the report
   * @param {string} [options.analysisType='file'] - Type identifier for metadata
   * @returns {Promise<Object>} Full analysis result with report, view, and incidents
   */
  async analyze(filePaths, options = {}) {
    const {
      persistReport = false,
      analysisType = 'file',
      ownerId = null,
      notificationRecipientEmail = null,
      notificationPreferences = null,
    } = options;
    const startTime = Date.now();

    // ---- Emit: Analysis Started ----
    this._emitStarted({
      fileCount: filePaths.length,
      analysisType,
      files: filePaths.map((f) => f.split(/[/\\]/).pop()), // Just filenames
    });

    // ---- Step 1: Run the analysis engine ----
    this._emitProgress({ percent: 10, stage: 'Parsing log files' });
    const result = await this.engine.analyzeLogs(filePaths);

    this._emitProgress({ percent: 60, stage: 'Classifying entries', entriesProcessed: result.entries.length });

    // ---- Step 2: Enrich report with metadata ----
    const durationMs = Date.now() - startTime;
    const enrichedReport = this.vmBuilder.attachMetadata(result.report, {
      analysisType,
      durationMs,
    });

    this._emitProgress({ percent: 80, stage: 'Building report' });

    // ---- Step 3: Generate dashboard view model ----
    const dashboardView = this.vmBuilder.toDashboardView(enrichedReport);

    // ---- Step 4: Emit incidents in real-time ----
    this._emitIncidents(result.incidents);

    // ---- Step 4b: Notify detected incidents ----
    const notificationResults = await this._notifyDetectedIncidents(result.incidents, {
      notificationRecipientEmail,
      notificationPreferences,
      analysisType,
      ownerId,
    });

    // ---- Step 5: Persist if requested ----
    let persistResult = null;
    if (persistReport && this.repository) {
      this._emitProgress({ percent: 90, stage: 'Persisting report' });
      persistResult = await this.saveReport(enrichedReport, {
        entries: result.entries,
        incidents: result.incidents,
        ownerId,
      });
    }

    // ---- Emit: Analysis Completed ----
    const totalDurationMs = Date.now() - startTime;
    this._emitCompleted({
      totalEntries: result.entries.length,
      totalIncidents: result.incidents.length,
      parseErrors: result.parseErrors.length,
      durationMs: totalDurationMs,
      severityBreakdown: enrichedReport.severityBreakdown || {},
    });

    return {
      entries: result.entries,
      incidents: result.incidents,
      parseErrors: result.parseErrors,
      report: enrichedReport,
      view: dashboardView,
      logFiles: result.logFiles,
      notifications: notificationResults,
      ...(persistResult && { reportPath: persistResult.reportPath, reportId: persistResult.reportId }),
    };
  }

  /**
   * Runs analysis on pre-read line groups (for file uploads).
   * Emits real-time events via StreamEventEmitter if available.
   *
   * @param {Object<string, string[]>} lineGroups - Map of source → lines
   * @param {Object} [options={}] - Options (same as analyze)
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeLineGroups(lineGroups, options = {}) {
    const {
      persistReport = true,
      analysisType = 'upload',
      ownerId = null,
      notificationRecipientEmail = null,
      notificationPreferences = null,
    } = options;
    const startTime = Date.now();
    const sourceNames = Object.keys(lineGroups);

    // ---- Emit: Analysis Started ----
    this._emitStarted({
      fileCount: sourceNames.length,
      analysisType,
      files: sourceNames,
    });

    // ---- Run the engine on line groups ----
    this._emitProgress({ percent: 10, stage: 'Parsing uploaded content' });
    const result = await this.engine.analyzeLineGroups(lineGroups);

    this._emitProgress({ percent: 60, stage: 'Classifying entries', entriesProcessed: result.entries.length });

    // Enrich and transform
    const durationMs = Date.now() - startTime;
    const enrichedReport = this.vmBuilder.attachMetadata(result.report, {
      analysisType,
      durationMs,
    });

    this._emitProgress({ percent: 80, stage: 'Building report' });
    const dashboardView = this.vmBuilder.toDashboardView(enrichedReport);

    // ---- Emit incidents ----
    this._emitIncidents(result.incidents);

    // ---- Notify detected incidents ----
    const notificationResults = await this._notifyDetectedIncidents(result.incidents, {
      notificationRecipientEmail,
      notificationPreferences,
      analysisType,
      ownerId,
    });

    // Persist if requested
    let persistResult = null;
    if (persistReport && this.repository) {
      this._emitProgress({ percent: 90, stage: 'Persisting report' });
      persistResult = await this.saveReport(enrichedReport, {
        entries: result.entries,
        incidents: result.incidents,
        ownerId,
      });
    }

    // ---- Emit: Analysis Completed ----
    const totalDurationMs = Date.now() - startTime;
    this._emitCompleted({
      totalEntries: result.entries.length,
      totalIncidents: result.incidents.length,
      parseErrors: result.parseErrors.length,
      durationMs: totalDurationMs,
      severityBreakdown: enrichedReport.severityBreakdown || {},
    });

    return {
      entries: result.entries,
      incidents: result.incidents,
      parseErrors: result.parseErrors,
      report: enrichedReport,
      view: dashboardView,
      logFiles: result.logFiles,
      notifications: notificationResults,
      ...(persistResult && { reportPath: persistResult.reportPath, reportId: persistResult.reportId }),
    };
  }

  /**
   * Persists a report along with its associated entries and incidents.
   *
   * @param {Object} report - The enriched report object
   * @param {Object} context - Associated data
   * @param {Array} context.entries - Parsed log entries
   * @param {Array} context.incidents - Detected incidents
   * @returns {Promise<Object>} Persistence result with reportPath/reportId
   */
  async saveReport(report, context = {}) {
    if (!this.repository) {
      throw new Error('No repository configured. Cannot save report.');
    }

    return this.repository.saveReport(report, context);
  }

  /**
   * Retrieves the most recently saved report.
   *
   * @returns {Promise<Object|null>} The latest report or null if none exist
   */
  async getLatestReport(options = {}) {
    if (!this.repository) {
      return null;
    }

    const report = await this.repository.getLatestReport(options);
    if (!report) return null;

    // Transform to dashboard view for consistency
    const view = this.vmBuilder.toDashboardView(report);
    return { report, view };
  }

  // ---------------------------------------------------------------------------
  // Private — Stream Event Emission Helpers
  // ---------------------------------------------------------------------------

  /**
   * Emits an analysis:started event if a stream emitter is configured.
   * @param {Object} meta - Start metadata
   * @private
   */
  _emitStarted(meta) {
    if (this.streamEmitter && typeof this.streamEmitter.emitAnalysisStarted === 'function') {
      this.streamEmitter.emitAnalysisStarted(meta);
    }
  }

  /**
   * Emits an analysis:progress event if a stream emitter is configured.
   * @param {Object} progress - Progress data
   * @private
   */
  _emitProgress(progress) {
    if (this.streamEmitter && typeof this.streamEmitter.emitAnalysisProgress === 'function') {
      this.streamEmitter.emitAnalysisProgress(progress);
    }
  }

  /**
   * Emits an analysis:completed event if a stream emitter is configured.
   * @param {Object} summary - Completion summary
   * @private
   */
  _emitCompleted(summary) {
    if (this.streamEmitter && typeof this.streamEmitter.emitAnalysisCompleted === 'function') {
      this.streamEmitter.emitAnalysisCompleted(summary);
    }
  }

  /**
   * Emits incident:detected events for each incident in the array.
   * @param {Array} incidents - Incident records
   * @private
   */
  _emitIncidents(incidents) {
    if (!this.streamEmitter || typeof this.streamEmitter.emitIncidentDetected !== 'function') {
      return;
    }

    for (const incident of incidents) {
      this.streamEmitter.emitIncidentDetected({
        id: incident.id,
        severity: incident.severity,
        type: incident.type,
        reason: incident.reason,
        message: incident.message,
        source: incident.source,
        timestamp: incident.timestamp,
        playbook: incident.playbook,
        actions: incident.actions,
        priority: incident.priority,
      });

      if (
        incident.severity === 'CRITICAL' &&
        typeof this.streamEmitter.emitCriticalAlert === 'function'
      ) {
        this.streamEmitter.emitCriticalAlert({
          id: incident.id,
          severity: incident.severity,
          type: incident.type,
          reason: incident.reason,
          message: incident.message,
          source: incident.source,
          timestamp: incident.timestamp,
          playbook: incident.playbook,
          actions: incident.actions,
          priority: incident.priority,
        });
      }
    }
  }

  /**
   * Sends notifications for detected incidents when NotificationService
   * is configured.
   *
   * @param {Array} incidents - Incident records
   * @returns {Promise<Array>} Notification results per incident
   * @private
   */
  async _notifyDetectedIncidents(incidents, notificationContext = {}) {
    if (!this.notificationService || typeof this.notificationService.notify !== 'function') {
      return [];
    }

    const results = [];

    for (const incident of incidents.filter(Boolean)) {
      const notifyResult = await this.notificationService.notify({
        ...incident,
        notificationRecipientEmail: notificationContext.notificationRecipientEmail || null,
        notificationPreferences: notificationContext.notificationPreferences || null,
        analysisType: notificationContext.analysisType || null,
        ownerId: notificationContext.ownerId || null,
      });
      results.push({
        incidentId: incident.id,
        severity: incident.severity,
        ...notifyResult,
      });
    }

    return results;
  }
}

module.exports = IncidentOrchestrator;
