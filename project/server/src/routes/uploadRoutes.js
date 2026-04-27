const express = require('express');
const upload = require('../middleware/uploadMiddleware');
const createUploadController = require('../controllers/uploadController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

function createUploadRoutes({ orchestrator, pdfService, repository }) {
  const router = express.Router();
  const controller = createUploadController({ orchestrator, pdfService, repository });

  router.post('/', auth, rbac('upload'), upload.array('files', 10), controller.analyzeUpload);
  router.get('/', auth, rbac('reports:read'), controller.listUploads);
  router.get('/list', auth, rbac('reports:read'), controller.listUploads);

  return router;
}
module.exports = createUploadRoutes;
