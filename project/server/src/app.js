/**
 * ============================================================================
 * EXPRESS APP FACTORY — Application Builder
 * ============================================================================
 * Creates and configures the Express application with all middleware, routes,
 * and dependency injection. Uses the factory pattern to support both
 * production server startup and test environments (Supertest).
 *
 * MIDDLEWARE STACK (in order):
 *   1. CORS          — Cross-origin requests for React dev server
 *   2. JSON parser   — Parse application/json request bodies
 *   3. URL parser     — Parse URL-encoded form data
 *   4. API Routes    — All /api/* endpoints (analysis + stream management)
 *   5. Error Handler — Global error catch-all (must be last)
 *
 * DEPENDENCY INJECTION:
 *   The factory accepts a repository instance, which determines the storage
 *   backend (MongoDB or File). It also accepts optional real-time streaming
 *   dependencies (streamEmitter, watcher) for Phase 9 WebSocket support.
 *
 * USAGE:
 *   const createApp = require('./app');
 *   const app = createApp({ repository, streamEmitter, watcher });
 *   app.listen(3001);
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const config = require('./config/env');
// Routes handled by routes/index.js
const errorHandler = require('./middleware/errorHandler');
const auth = require('./middleware/auth');
const createAttachCurrentUser = require('./middleware/attachCurrentUser');
const IncidentOrchestrator = require('./services/IncidentOrchestrator');
const LogSourceResolver = require('./services/ingestion/LogSourceResolver');
const PdfAnalysisService = require('./services/parsing/PdfAnalysisService');
const NotificationService = require('./services/notification/NotificationService');
const AlertDeduplicator = require('./services/notification/AlertDeduplicator');
const EscalationPolicy = require('./services/notification/EscalationPolicy');
const SlackChannel = require('./services/notification/channels/SlackChannel');
const EmailChannel = require('./services/notification/channels/EmailChannel');
const GoogleChatChannel = require('./services/notification/channels/GoogleChatChannel');
const WebhookChannel = require('./services/notification/channels/WebhookChannel');
const UserModel = require('./models/User');
const FileUserModel = require('./models/FileUser');

/**
 * Creates a fully configured Express application.
 *
 * @param {Object} [options={}] - Configuration options
 * @param {Object} [options.repository] - Persistence repository (Mongo or File)
 * @param {Object} [options.streamEmitter] - StreamEventEmitter for real-time events
 * @param {Object} [options.watcher] - LogStreamWatcher instance
 * @param {Object} [options.queueManager] - Queue manager for async analysis jobs
 * @returns {import('express').Application} Configured Express app
 */
function createApp(options = {}) {
  const { repository } = options;
  const app = express();

  // ---- Global Middleware ----

  // Enable CORS for the React dev server (localhost:5173 by default)
  app.use(cors({
    origin: [
      'http://localhost:5173',   // Vite dev server
      'http://localhost:3000',   // Alternative React port
      'http://127.0.0.1:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Parse JSON request bodies (limit 50MB for large log data)
  app.use(express.json({ limit: '50mb' }));

  // Parse URL-encoded form data
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ---- Dependency Injection ----

  // Create the log source resolver
  const resolver = new LogSourceResolver(config);
  const userModel = repository
    ? (repository.db ? new UserModel(repository.db) : new FileUserModel(repository.dir))
    : null;

  // Create notification dependencies (Flow 12)
  const notificationService = new NotificationService({
    channels: [
      new SlackChannel(config),
      new EmailChannel(config),
      new GoogleChatChannel(config),
      new WebhookChannel(config),
    ],
    deduplicator: new AlertDeduplicator(),
    escalationPolicy: new EscalationPolicy(),
  });

  // Create the orchestrator with the injected repository + stream emitter
  const orchestrator = new IncidentOrchestrator({
    repository,
    notificationService,
  });

  // Create the PDF analysis service
  const pdfService = new PdfAnalysisService({ orchestrator, repository });

  const createRoutes = require('./routes/index');
  const rateLimiter = require('./middleware/rateLimiter');
  const auditMiddleware = require('./middleware/audit');
  const AuditRepository = require('./repositories/AuditRepository');
  const auditRepo = new AuditRepository(repository && repository.db ? repository.db : null);

  app.use(rateLimiter);
  app.use(auth.optional);
  app.use(createAttachCurrentUser(userModel));
  app.use(auditMiddleware(auditRepo));

  // Mount API Endpoints
  app.use('/api', createRoutes({
    orchestrator,
    pdfService,
    resolver,
    repository,
    notificationService,
    userModel,
  }));

  // Expose key runtime dependencies for server-level wiring and diagnostics.
  app.locals.orchestrator = orchestrator;
  app.locals.notificationService = notificationService;
  app.locals.userModel = userModel;

  // ---- Error Handling ----

  // Global error handler (must be registered LAST)
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
