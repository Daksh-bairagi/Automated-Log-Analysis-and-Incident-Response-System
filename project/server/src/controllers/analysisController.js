/**
 * ============================================================================
 * ANALYSIS CONTROLLER — HTTP Request Handlers
 * ============================================================================
 * Contains all route handler functions for the analysis API endpoints.
 * Each handler receives Express req/res objects, validates input, calls
 * the orchestrator/services, and sends JSON responses.
 *
 * ENDPOINTS HANDLED:
 *   GET  /api/health            → healthCheck
 *   GET  /api/report/latest     → getLatestReport
 *   GET  /api/uploads           → listUploads
 *   POST /api/analyze           → analyze
 *   POST /api/analyze/upload    → analyzeUpload
 *
 * ARCHITECTURE:
 *   Express Route → Controller (here) → Orchestrator → Engine → Repository
 *
 * USAGE:
 *   const controller = createAnalysisController({ orchestrator, pdfService, resolver });
 *   router.post('/analyze', controller.analyze);
 * ============================================================================
 */

/**
 * Factory function that creates controller methods with injected dependencies.
 *
 * @param {Object} deps - Injected dependencies
 * @param {import('../services/IncidentOrchestrator')} deps.orchestrator
 * @param {import('../services/parsing/PdfAnalysisService')} [deps.pdfService]
 * @param {import('../services/ingestion/LogSourceResolver')} deps.resolver
 * @param {Object} [deps.repository]
 * @param {Object} [deps.queueManager]
 * @returns {Object} Controller methods
 */
const { resolveRequestNotificationContext } = require('../utils/requestNotificationContext');

function createAnalysisController({ orchestrator, resolver }) {
  return {
    async analyze(req, res, next) {
      try {
        const { logDir, logFiles, dirs } = normalizeAnalyzeRequest(req.body);
        const filePaths = resolver.resolve({ logDir, logFiles, dirs });
        const notificationContext = resolveRequestNotificationContext(req.user);
        const result = await orchestrator.analyze(filePaths, {
          persistReport: true,
          analysisType: 'file',
          ownerId: req.user?.id || null,
          ...notificationContext,
        });
        res.json({
          success: true,
          report: result.report,
          view: result.view,
          incidents: result.incidents.map((i) => (typeof i.toJSON === 'function' ? i.toJSON() : i)),
          logFiles: result.logFiles,
          reportPath: result.reportPath || null,
          reportId: result.reportId || null,
        });
      } catch (error) { next(error); }
    }
  };
}

function normalizeAnalyzeRequest(body = {}) {
  return { logDir: body.logDir || null, logFiles: body.logFiles || null, dirs: body.dirs || null };
}

module.exports = createAnalysisController;
