/**
 * ============================================================================
 * STREAM INGEST ROUTES
 * ============================================================================
 * Mounts SSE/control endpoints for the Stream Ingest feature.
 *
 * ROUTE TABLE:
 *   GET    /api/stream-ingest/demo              → Built-in synthetic demo stream
 *   GET    /api/stream-ingest/start             → Stream any external URL via SSE
 *   DELETE /api/stream-ingest/:sessionId/stop   → Abort a running session
 * ============================================================================
 */

const express = require('express');
const createStreamIngestControllers = require('../controllers/streamIngestController');
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');

function createStreamIngestRoutes({ repository, notificationService } = {}) {
  const router = express.Router();
  const { demoStream, startStream, stopStream } = createStreamIngestControllers({
    repository,
    notificationService,
  });

  // Built-in demo — scoped to authenticated user tenant
  // Query params: count (default 500), delay (default 30ms)
  router.get('/demo', auth, rbac('analyze'), demoStream);

  // Real-URL streaming — scoped to authenticated user tenant
  // Query params: url (required), format (auto|json|generic|syslog|apache), headers (JSON string)
  router.get('/start', auth, rbac('analyze'), startStream);

  // Stop a running session
  router.delete('/:sessionId/stop', auth, rbac('analyze'), stopStream);

  return router;
}

module.exports = createStreamIngestRoutes;
