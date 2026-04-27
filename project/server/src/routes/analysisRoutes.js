const express = require('express');
const createAnalysisController = require('../controllers/analysisController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const validate = require('../middleware/validate');

const analyzeRequestSchema = {
  logDir: { type: 'string' },
  logFiles: { arrayOf: 'string' },
  dirs: { arrayOf: 'string' },
};

function createAnalysisRoutes({ orchestrator, resolver }) {
  const router = express.Router();
  const controller = createAnalysisController({ orchestrator, resolver });

  router.post('/', auth, rbac('analyze'), validate(analyzeRequestSchema), controller.analyze);


  return router;
}

module.exports = createAnalysisRoutes;
