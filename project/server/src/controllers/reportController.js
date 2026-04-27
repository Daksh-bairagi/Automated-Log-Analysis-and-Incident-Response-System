const ReportExporter = require('../services/reporting/ReportExporter');

function createReportController({ orchestrator, repository }) {
  const exporter = new ReportExporter();

  async function loadReportOr404({ id = null, ownerId = null } = {}) {
    if (id && repository && typeof repository.getReportById === 'function') {
      return repository.getReportById(id, { ownerId });
    }
    return orchestrator.getLatestReport({ ownerId }).then((result) => result?.report || null);
  }

  return {
    async getLatestReport(req, res, next) {
      try {
        const ownerId = req.user?.id || null;
        const tenantResult = await orchestrator.getLatestReport({ ownerId });
        if (!tenantResult) {
          return res.status(404).json({
            error: true,
            message: 'No reports found. Run an analysis first.',
          });
        }
        res.json({
          success: true,
          report: tenantResult.report,
          view: tenantResult.view,
        });
      } catch (error) {
        next(error);
      }
    },
    async getReportById(req, res, next) {
      try {
        if (!repository || typeof repository.getReportById !== 'function') {
          return res.status(501).json({
            error: true,
            message: 'Report lookup by id is not supported by the configured repository.',
          });
        }

        const report = await repository.getReportById(req.params.id, {
          ownerId: req.user?.id || null,
        });
        if (!report) {
          return res.status(404).json({
            error: true,
            message: `Report not found: ${req.params.id}`,
          });
        }

        const view = orchestrator?.vmBuilder?.toDashboardView
          ? orchestrator.vmBuilder.toDashboardView(report)
          : null;

        res.json({ success: true, report, view });
      } catch (error) {
        next(error);
      }
    },
    async exportLatestReport(req, res, next) {
      try {
        const report = await loadReportOr404({ ownerId: req.user?.id || null });
        if (!report) {
          return res.status(404).json({ error: true, message: 'No reports found. Run an analysis first.' });
        }

        sendExport(res, exporter, report, req.query.format);
      } catch (error) {
        next(error);
      }
    },
    async exportReportById(req, res, next) {
      try {
        const report = await loadReportOr404({ id: req.params.id, ownerId: req.user?.id || null });
        if (!report) {
          return res.status(404).json({ error: true, message: `Report not found: ${req.params.id}` });
        }

        sendExport(res, exporter, report, req.query.format);
      } catch (error) {
        next(error);
      }
    }
  };
}

function sendExport(res, exporter, report, format = 'csv') {
  const normalizedFormat = String(format || 'csv').toLowerCase();

  if (normalizedFormat === 'pdf') {
    const pdfBuffer = exporter.exportToPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report.reportId || 'latest'}.pdf"`);
    return res.send(pdfBuffer);
  }

  const csv = exporter.exportToCsv(report);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="report-${report.reportId || 'latest'}.csv"`);
  return res.send(csv);
}

module.exports = createReportController;
