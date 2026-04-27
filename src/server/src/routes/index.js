const express = require('express');
const createAnalysisRoutes = require('./analysisRoutes');
const createReportRoutes = require('./reportRoutes');
const createUploadRoutes = require('./uploadRoutes');
const createStreamIngestRoutes = require('./streamIngestRoutes');
const createAuthRoutes = require('./authRoutes');

function createRoutes({ orchestrator, pdfService, resolver, repository, notificationService, userModel }) {
  const router = express.Router();

  // ---- Auth routes (public + protected) ----
  if (userModel) {
    router.use('/auth', createAuthRoutes({ userModel }));
  }

  router.use('/analyze', createAnalysisRoutes({ orchestrator, resolver }));
  const reportRoutes = createReportRoutes({ orchestrator, repository });
  const uploadRoutes = createUploadRoutes({ orchestrator, pdfService, repository });

  router.use('/reports', reportRoutes);
  router.use('/report', reportRoutes);
  router.use('/upload', uploadRoutes);
  router.use('/uploads', uploadRoutes);
  router.use('/stream-ingest', createStreamIngestRoutes({ repository, notificationService }));

  // Global /health alias per roadmap
  router.get('/health', (req, res) => {
    let defaultLogFiles = 0;
    try { if (resolver) defaultLogFiles = resolver.resolve().length; } catch (e) {}
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      defaultLogFiles
    });
  });

  return router;
}
module.exports = createRoutes;
