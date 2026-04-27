const { resolveRequestNotificationContext } = require('../utils/requestNotificationContext');

function createUploadController({ orchestrator, pdfService, repository }) {
  return {
    async analyzeUpload(req, res, next) {
      try {
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ error: true, message: 'No files uploaded' });
        }
        if (pdfService) {
          const notificationContext = resolveRequestNotificationContext(req.user);
          const result = await pdfService.analyzeUploadedFiles(req.files, {
            ownerId: req.user?.id || null,
            ...notificationContext,
          });
          return res.json({
            success: true,
            report: result.report,
            view: result.view,
            incidents: result.incidents.map((i) => (typeof i.toJSON === 'function' ? i.toJSON() : i)),
            uploads: result.uploads || [],
            storedUploads: result.storedUploads || [],
          });
        } else {
          const lineGroups = {};
          for (const file of req.files) {
            const content = file.buffer.toString('utf-8');
            lineGroups[file.originalname] = content.split('\n').filter((l) => l.trim().length > 0);
          }
          const notificationContext = resolveRequestNotificationContext(req.user);
          const result = await orchestrator.analyzeLineGroups(lineGroups, {
            persistReport: true,
            analysisType: 'upload',
            ownerId: req.user?.id || null,
            ...notificationContext,
          });
          res.json({
            success: true,
            report: result.report,
            view: result.view,
            incidents: result.incidents.map((i) => (typeof i.toJSON === 'function' ? i.toJSON() : i)),
            uploads: req.files.map((f) => ({ originalName: f.originalname, mimeType: f.mimetype, sizeBytes: f.size })),
          });
        }
      } catch (error) {
        next(error);
      }
    },
    async listUploads(req, res, next) {
      try {
         // Fulfill list uploads from repository if supported, else mock
         if (repository && typeof repository.listSourceDocuments === 'function') {
           const uploads = await repository.listSourceDocuments({ ownerId: req.user?.id || null });
           res.json({ success: true, uploads });
         } else {
           res.json({ success: true, uploads: [] });
         }
      } catch (error) {
         next(error);
      }
    }
  };
}
module.exports = createUploadController;
