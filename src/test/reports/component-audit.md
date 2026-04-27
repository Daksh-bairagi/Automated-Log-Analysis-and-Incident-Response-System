# Component Audit

Generated: 2026-04-15T08:18:59.295Z

## Server Source vs Unit Tests

| Component | Verification |
|---|---|
| `server/src/app.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/cli/runCli.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/config/alertChannels.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/config/env.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/config/parserFormats.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/config/playbooks.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/config/rules.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/controllers/analysisController.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/controllers/authController.js` | server/tests/unit/authController.test.js |
| `server/src/controllers/reportController.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/controllers/streamIngestController.js` | server/tests/unit/streamIngestController.test.js |
| `server/src/controllers/uploadController.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/db/MongoDatabase.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/middleware/audit.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/middleware/auth.js` | server/tests/unit/authController.test.js |
| `server/src/middleware/errorHandler.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/middleware/rateLimiter.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/middleware/rbac.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/middleware/uploadMiddleware.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/middleware/validate.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/models/AlertEvent.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/models/AuditLog.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/models/FileUser.js` | server/tests/unit/FileUser.test.js |
| `server/src/models/IncidentRecord.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/models/LogEntry.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/models/Report.js` | server/tests/unit/ReportExporter.test.js |
| `server/src/models/User.js` | server/tests/unit/FileUser.test.js |
| `server/src/queues/jobs.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/queues/processors/analysisProcessor.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/queues/processors/notificationProcessor.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/queues/queueManager.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/repositories/AuditRepository.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/repositories/FileRepository.js` | server/tests/unit/FileRepository.test.js |
| `server/src/repositories/MongoRepository.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/routes/analysisRoutes.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/routes/authRoutes.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/routes/index.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/routes/reportRoutes.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/routes/streamIngestRoutes.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/routes/streamRoutes.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/routes/uploadRoutes.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/server.js` | server/tests/unit/AnalysisEngine.test.js<br>server/tests/unit/authController.test.js<br>server/tests/unit/CorrelationEngine.test.js<br>server/tests/unit/FileRepository.test.js<br>server/tests/unit/FileUser.test.js<br>server/tests/unit/GoogleChatChannel.test.js<br>server/tests/unit/IncidentDetector.test.js<br>server/tests/unit/IncidentOrchestrator.test.js<br>server/tests/unit/LogSourceResolver.test.js<br>server/tests/unit/NotificationService.test.js<br>server/tests/unit/parsers/AllParsers.test.js<br>server/tests/unit/parsers/ParserFactory.test.js<br>server/tests/unit/PdfAnalysisService.test.js<br>server/tests/unit/ReportExporter.test.js<br>server/tests/unit/ResponsePlanner.test.js<br>server/tests/unit/SeverityClassifier.test.js<br>server/tests/unit/streamIngestController.test.js |
| `server/src/services/analysis/AnalysisEngine.js` | server/tests/unit/AnalysisEngine.test.js |
| `server/src/services/analysis/CorrelationEngine.js` | server/tests/unit/CorrelationEngine.test.js |
| `server/src/services/analysis/IncidentDetector.js` | server/tests/unit/IncidentDetector.test.js |
| `server/src/services/analysis/MLClassifierClient.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/analysis/SeverityClassifier.js` | server/tests/unit/SeverityClassifier.test.js |
| `server/src/services/analysis/ThresholdMonitor.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/IncidentOrchestrator.js` | server/tests/unit/IncidentOrchestrator.test.js |
| `server/src/services/ingestion/LogReader.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/ingestion/LogSourceResolver.js` | server/tests/unit/LogSourceResolver.test.js |
| `server/src/services/ingestion/ValidationService.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/notification/AlertDeduplicator.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/notification/channels/EmailChannel.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/notification/channels/GoogleChatChannel.js` | server/tests/unit/GoogleChatChannel.test.js |
| `server/src/services/notification/channels/SlackChannel.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/notification/channels/WebhookChannel.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/notification/EscalationPolicy.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/notification/NotificationService.js` | server/tests/unit/NotificationService.test.js |
| `server/src/services/parsing/FormatDetector.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/parsing/Normalizer.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/parsing/ParserFactory.js` | server/tests/unit/parsers/ParserFactory.test.js |
| `server/src/services/parsing/parsers/ApacheParser.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/parsing/parsers/GenericParser.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/parsing/parsers/JsonLogParser.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/parsing/parsers/SpaceDelimitedParser.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/parsing/parsers/SyslogParser.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/parsing/PdfAnalysisService.js` | server/tests/unit/PdfAnalysisService.test.js |
| `server/src/services/realtime/LiveAnalyzer.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/realtime/LogStreamWatcher.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/realtime/StreamEventEmitter.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/realtime/WebSocketManager.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/reporting/ReportBuilder.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/reporting/ReportExporter.js` | server/tests/unit/ReportExporter.test.js |
| `server/src/services/reporting/ReportViewModelBuilder.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/response/PlaybookRegistry.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/services/response/ResponsePlanner.js` | server/tests/unit/ResponsePlanner.test.js |
| `server/src/utils/CommandLineUI.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/utils/errors.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/utils/logger.js` | Covered indirectly by integration or pending dedicated unit test |
| `server/src/utils/retry.js` | Covered indirectly by integration or pending dedicated unit test |

## Server Source vs Integration Tests

| Component | Verification |
|---|---|
| `server/src/app.js` | Not directly named in integration suite |
| `server/src/cli/runCli.js` | Not directly named in integration suite |
| `server/src/config/alertChannels.js` | Not directly named in integration suite |
| `server/src/config/env.js` | Not directly named in integration suite |
| `server/src/config/parserFormats.js` | Not directly named in integration suite |
| `server/src/config/playbooks.js` | Not directly named in integration suite |
| `server/src/config/rules.js` | Not directly named in integration suite |
| `server/src/controllers/analysisController.js` | Not directly named in integration suite |
| `server/src/controllers/authController.js` | Not directly named in integration suite |
| `server/src/controllers/reportController.js` | Not directly named in integration suite |
| `server/src/controllers/streamIngestController.js` | Not directly named in integration suite |
| `server/src/controllers/uploadController.js` | Not directly named in integration suite |
| `server/src/db/MongoDatabase.js` | Not directly named in integration suite |
| `server/src/middleware/audit.js` | Not directly named in integration suite |
| `server/src/middleware/auth.js` | Not directly named in integration suite |
| `server/src/middleware/errorHandler.js` | Not directly named in integration suite |
| `server/src/middleware/rateLimiter.js` | Not directly named in integration suite |
| `server/src/middleware/rbac.js` | Not directly named in integration suite |
| `server/src/middleware/uploadMiddleware.js` | Not directly named in integration suite |
| `server/src/middleware/validate.js` | Not directly named in integration suite |
| `server/src/models/AlertEvent.js` | Not directly named in integration suite |
| `server/src/models/AuditLog.js` | Not directly named in integration suite |
| `server/src/models/FileUser.js` | Not directly named in integration suite |
| `server/src/models/IncidentRecord.js` | Not directly named in integration suite |
| `server/src/models/LogEntry.js` | Not directly named in integration suite |
| `server/src/models/Report.js` | Not directly named in integration suite |
| `server/src/models/User.js` | Not directly named in integration suite |
| `server/src/queues/jobs.js` | Not directly named in integration suite |
| `server/src/queues/processors/analysisProcessor.js` | Not directly named in integration suite |
| `server/src/queues/processors/notificationProcessor.js` | Not directly named in integration suite |
| `server/src/queues/queueManager.js` | Not directly named in integration suite |
| `server/src/repositories/AuditRepository.js` | Not directly named in integration suite |
| `server/src/repositories/FileRepository.js` | Not directly named in integration suite |
| `server/src/repositories/MongoRepository.js` | Not directly named in integration suite |
| `server/src/routes/analysisRoutes.js` | Not directly named in integration suite |
| `server/src/routes/authRoutes.js` | Not directly named in integration suite |
| `server/src/routes/index.js` | Not directly named in integration suite |
| `server/src/routes/reportRoutes.js` | Not directly named in integration suite |
| `server/src/routes/streamIngestRoutes.js` | Not directly named in integration suite |
| `server/src/routes/streamRoutes.js` | Not directly named in integration suite |
| `server/src/routes/uploadRoutes.js` | Not directly named in integration suite |
| `server/src/server.js` | server/tests/integration/analysisApi.test.js<br>server/tests/integration/hardEdgeSecurity.test.js<br>server/tests/integration/upload.test.js<br>server/tests/integration/websocket.test.js |
| `server/src/services/analysis/AnalysisEngine.js` | Not directly named in integration suite |
| `server/src/services/analysis/CorrelationEngine.js` | Not directly named in integration suite |
| `server/src/services/analysis/IncidentDetector.js` | Not directly named in integration suite |
| `server/src/services/analysis/MLClassifierClient.js` | Not directly named in integration suite |
| `server/src/services/analysis/SeverityClassifier.js` | Not directly named in integration suite |
| `server/src/services/analysis/ThresholdMonitor.js` | Not directly named in integration suite |
| `server/src/services/IncidentOrchestrator.js` | Not directly named in integration suite |
| `server/src/services/ingestion/LogReader.js` | Not directly named in integration suite |
| `server/src/services/ingestion/LogSourceResolver.js` | Not directly named in integration suite |
| `server/src/services/ingestion/ValidationService.js` | Not directly named in integration suite |
| `server/src/services/notification/AlertDeduplicator.js` | Not directly named in integration suite |
| `server/src/services/notification/channels/EmailChannel.js` | Not directly named in integration suite |
| `server/src/services/notification/channels/GoogleChatChannel.js` | Not directly named in integration suite |
| `server/src/services/notification/channels/SlackChannel.js` | Not directly named in integration suite |
| `server/src/services/notification/channels/WebhookChannel.js` | Not directly named in integration suite |
| `server/src/services/notification/EscalationPolicy.js` | Not directly named in integration suite |
| `server/src/services/notification/NotificationService.js` | Not directly named in integration suite |
| `server/src/services/parsing/FormatDetector.js` | Not directly named in integration suite |
| `server/src/services/parsing/Normalizer.js` | Not directly named in integration suite |
| `server/src/services/parsing/ParserFactory.js` | Not directly named in integration suite |
| `server/src/services/parsing/parsers/ApacheParser.js` | Not directly named in integration suite |
| `server/src/services/parsing/parsers/GenericParser.js` | Not directly named in integration suite |
| `server/src/services/parsing/parsers/JsonLogParser.js` | Not directly named in integration suite |
| `server/src/services/parsing/parsers/SpaceDelimitedParser.js` | Not directly named in integration suite |
| `server/src/services/parsing/parsers/SyslogParser.js` | Not directly named in integration suite |
| `server/src/services/parsing/PdfAnalysisService.js` | Not directly named in integration suite |
| `server/src/services/realtime/LiveAnalyzer.js` | Not directly named in integration suite |
| `server/src/services/realtime/LogStreamWatcher.js` | Not directly named in integration suite |
| `server/src/services/realtime/StreamEventEmitter.js` | Not directly named in integration suite |
| `server/src/services/realtime/WebSocketManager.js` | Not directly named in integration suite |
| `server/src/services/reporting/ReportBuilder.js` | Not directly named in integration suite |
| `server/src/services/reporting/ReportExporter.js` | Not directly named in integration suite |
| `server/src/services/reporting/ReportViewModelBuilder.js` | Not directly named in integration suite |
| `server/src/services/response/PlaybookRegistry.js` | Not directly named in integration suite |
| `server/src/services/response/ResponsePlanner.js` | Not directly named in integration suite |
| `server/src/utils/CommandLineUI.js` | Not directly named in integration suite |
| `server/src/utils/errors.js` | Not directly named in integration suite |
| `server/src/utils/logger.js` | Not directly named in integration suite |
| `server/src/utils/retry.js` | Not directly named in integration suite |

## Client Source Verification

| Component | Verification |
|---|---|
| `client/src/App.jsx` | Verified by client lint + production build |
| `client/src/components/AlertBanner.jsx` | Verified by client lint + production build |
| `client/src/components/AnalyzedFileList.jsx` | Verified by client lint + production build |
| `client/src/components/ConnectionStatus.jsx` | Verified by client lint + production build |
| `client/src/components/DashboardActions.jsx` | Verified by client lint + production build |
| `client/src/components/IncidentDetails.jsx` | Verified by client lint + production build |
| `client/src/components/IncidentFilters.jsx` | Verified by client lint + production build |
| `client/src/components/IncidentList.jsx` | Verified by client lint + production build |
| `client/src/components/IncidentTimeline.jsx` | Verified by client lint + production build |
| `client/src/components/LoadingSpinner.jsx` | Verified by client lint + production build |
| `client/src/components/LogTerminal.jsx` | Verified by client lint + production build |
| `client/src/components/SeverityBreakdown.jsx` | Verified by client lint + production build |
| `client/src/components/StoredUploadList.jsx` | Verified by client lint + production build |
| `client/src/components/SummaryCards.jsx` | Verified by client lint + production build |
| `client/src/components/UploadZone.jsx` | Verified by client lint + production build |
| `client/src/contexts/AuthContext.jsx` | Verified by client lint + production build |
| `client/src/features/dashboard/IncidentDashboard.jsx` | Verified by client lint + production build |
| `client/src/hooks/useFileUpload.js` | Verified by client lint + production build |
| `client/src/hooks/useIncidentDashboard.js` | Verified by client lint + production build |
| `client/src/hooks/useLogStream.js` | Verified by client lint + production build |
| `client/src/hooks/useStreamIngest.js` | Verified by client lint + production build |
| `client/src/hooks/useWebSocket.js` | Verified by client lint + production build |
| `client/src/layouts/MainLayout.jsx` | Verified by client lint + production build |
| `client/src/main.jsx` | Verified by client lint + production build |
| `client/src/pages/DashboardPage.jsx` | Verified by client lint + production build |
| `client/src/pages/LiveStreamPage.jsx` | Verified by client lint + production build |
| `client/src/pages/LoginPage.jsx` | Verified by client lint + production build |
| `client/src/pages/RegisterPage.jsx` | Verified by client lint + production build |
| `client/src/pages/ReportPage.jsx` | Verified by client lint + production build |
| `client/src/pages/StreamIngestPage.jsx` | Verified by client lint + production build |
| `client/src/pages/UploadDetailsPage.jsx` | Verified by client lint + production build |
| `client/src/pages/UploadPage.jsx` | Verified by client lint + production build |
| `client/src/routes/AppRoutes.jsx` | Verified by client lint + production build |
| `client/src/services/apiClient.js` | Verified by client lint + production build |
| `client/src/services/authApi.js` | Verified by client lint + production build |
| `client/src/services/incidentApi.js` | Verified by client lint + production build |
| `client/src/services/streamIngestApi.js` | Verified by client lint + production build |
| `client/src/services/uploadApi.js` | Verified by client lint + production build |
