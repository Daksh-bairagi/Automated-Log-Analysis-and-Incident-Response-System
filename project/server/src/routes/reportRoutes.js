const express = require('express');
const createReportController = require('../controllers/reportController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');

function createReportRoutes({ orchestrator, repository }) {
  const router = express.Router();
  const controller = createReportController({ orchestrator, repository });

  router.get('/latest/export', auth, rbac('reports:read'), controller.exportLatestReport);
  router.get('/latest', auth, rbac('reports:read'), controller.getLatestReport);
  router.get(
    '/:id/export',
    auth,
    rbac('reports:read'),
    validate({ id: { required: true, type: 'string' } }, 'params'),
    controller.exportReportById
  );
  router.get(
    '/:id',
    auth,
    rbac('reports:read'),
    validate({ id: { required: true, type: 'string' } }, 'params'),
    controller.getReportById
  );

  return router;
}
module.exports = createReportRoutes;
