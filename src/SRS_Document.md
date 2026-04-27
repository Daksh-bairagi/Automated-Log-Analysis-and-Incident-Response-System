# Software Requirements Specification (SRS)
## Automated Log Analysis & Incident Response System
**Version:** 1.0 | **Date:** April 27, 2026

---

## 1. Introduction

### 1.1 Purpose
This SRS defines the functional and non-functional requirements for the **Automated Log Analysis & Incident Response System** — a production-grade observability platform that ingests, parses, classifies, and correlates logs from any source, then auto-assigns response playbooks, alerts the team, and streams everything live to a dark-mode dashboard.

### 1.2 Scope
The system provides:
- Multi-format log ingestion (file, upload, batch, live stream)
- Automatic format detection and parsing (5 strategy parsers)
- Severity classification (rule-based + ML-powered XGBoost model)
- Incident detection (single-log, multi-log correlation, threshold monitoring)
- Automated response playbook assignment
- Report generation with PDF/CSV export
- Real-time WebSocket streaming to a React dashboard
- Multi-channel notifications (Slack, Email, Google Chat, Webhook)
- JWT + Google OAuth authentication with RBAC
- MongoDB persistence with file-system fallback

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|-----------|
| SRS | Software Requirements Specification |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| ML | Machine Learning |
| API | Application Programming Interface |
| CORS | Cross-Origin Resource Sharing |
| WebSocket | Full-duplex communication protocol |
| BullMQ | Node.js message queue library |
| XGBoost | Gradient boosting ML framework |

### 1.4 Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| API Framework | Express 4 |
| Frontend | React 19 + Vite 8 |
| Database | MongoDB (native driver) |
| Queue | BullMQ + Redis |
| ML Service | Python FastAPI + XGBoost + joblib |
| Auth | jsonwebtoken + bcrypt + Google OAuth |
| Real-Time | WebSocket (ws) |
| Email | Nodemailer + Resend API |
| Logging | Winston |
| Upload | Multer |
| PDF Parsing | pdf-parse |
| Testing | Jest + Supertest |
| Containerization | Docker Compose |

---

## 2. Overall Description

### 2.1 System Architecture

```
Logs come in → Detect format → Pick parser → Parse → Normalize
→ Classify severity → Detect incidents (single + multi-log + threshold)
→ Assign playbook → Build report → Save to DB
→ Alert on CRITICAL → Stream to dashboard in real-time
```

**Key Architectural Layers:**

| Layer | Components |
|-------|-----------|
| Ingestion | LogReader, LogSourceResolver, ValidationService |
| Parsing | FormatDetector, ParserFactory, Normalizer, PdfAnalysisService |
| Analysis | SeverityClassifier, IncidentDetector, CorrelationEngine, ThresholdMonitor, MLClassifierClient |
| Response | ResponsePlanner, PlaybookRegistry |
| Reporting | ReportBuilder, ReportViewModelBuilder, ReportExporter |
| Notification | NotificationService, AlertDeduplicator, EscalationPolicy |
| Persistence | MongoRepository, FileRepository, AuditRepository |
| Presentation | React dashboard (DashboardPage, LiveStreamPage, UploadPage, ReportPage) |

### 2.2 Design Patterns

| Pattern | Where | Purpose |
|---------|-------|---------|
| Strategy | ParserFactory, NotificationService | Swap parsers/channels without changing callers |
| Factory | ParserFactory, createApp() | Create objects without exposing logic |
| Repository | Mongo/FileRepository | Swap storage without changing business logic |
| Observer | EventEmitterBridge → SocketManager | Decouple analysis from WebSocket |
| Pipeline | AnalysisEngine | Chain processing steps cleanly |
| Dependency Injection | app.js constructor injection | Testable, swappable components |
| Circuit Breaker | retry.js | Handle external service failures gracefully |

### 2.3 Users & Roles

| Role | Permissions |
|------|------------|
| Admin | Full system access, user management, all operations |
| Analyst | Log analysis, report generation, incident management |
| Viewer | Read-only dashboard and report access |

### 2.4 Constraints
- Maximum upload file size: 10 MB per file
- Maximum 10 files per upload request
- Allowed file types: `.log`, `.pdf`
- JWT tokens expire after 24 hours (configurable)
- ML confidence threshold: 0.75 (configurable)
- ML service timeout: 300ms

---

## 3. Functional Requirements

### 3.1 Log Ingestion (FR-01)

| ID | Requirement |
|----|------------|
| FR-01.1 | System SHALL ingest logs from local file paths on the server |
| FR-01.2 | System SHALL accept file uploads via HTTP multipart POST (.log, .pdf) |
| FR-01.3 | System SHALL support batch ingestion from configured log directories |
| FR-01.4 | System SHALL support live streaming ingestion via SSE endpoints |
| FR-01.5 | System SHALL validate file size (≤10 MB) and type before processing |
| FR-01.6 | System SHALL resolve default log sources from the configured LOG_DIR |

### 3.2 Log Parsing (FR-02)

| ID | Requirement |
|----|------------|
| FR-02.1 | System SHALL auto-detect log format from the first 5 lines of each file |
| FR-02.2 | System SHALL support: Space-delimited, Apache Combined, JSON (NDJSON), Syslog RFC 5424, and PDF formats |
| FR-02.3 | System SHALL normalize all parsed entries into a unified LogEntry schema: { timestamp, level, source, message, rawLine } |
| FR-02.4 | System SHALL track parse errors and include them in the analysis report |
| FR-02.5 | System SHALL extract text content from PDF files for analysis |

### 3.3 Severity Classification (FR-03)

| ID | Requirement |
|----|------------|
| FR-03.1 | System SHALL classify each entry as CRITICAL, HIGH, MEDIUM, or LOW |
| FR-03.2 | System SHALL use a rule-based engine mapping log levels to severity (FATAL/CRITICAL→CRITICAL, ERROR→HIGH, WARNING/WARN→MEDIUM, INFO/DEBUG/TRACE→LOW) |
| FR-03.3 | System SHALL apply keyword-weight scoring (e.g., "unauthorized"=3, "breach"=3, "failed"=2, "timeout"=1) |
| FR-03.4 | System SHALL apply frequency-based boosting within a 120-second sliding window (5 events=+1, 10=+2, 20=+3) |
| FR-03.5 | System SHALL integrate with ML classifier (XGBoost via FastAPI) for structured anomaly-style entries when ML is enabled |
| FR-03.6 | System SHALL fall back to rule-based classification when ML service is unavailable or confidence is below threshold |
| FR-03.7 | Final severity score mapping: ≥8→CRITICAL, ≥5→HIGH, ≥3→MEDIUM, <3→LOW |

### 3.4 Incident Detection (FR-04)

| ID | Requirement |
|----|------------|
| FR-04.1 | **Single-log detection:** Any entry with HIGH or CRITICAL severity SHALL be auto-flagged as an incident |
| FR-04.2 | **Keyword detection:** Entries containing keywords (unauthorized, timeout, suspicious, failed, crash, denied, breach, attack, exploit, overflow, injection, malware, intrusion) SHALL be flagged |
| FR-04.3 | **Brute-force correlation:** 5+ "login failed" events within 120 seconds SHALL trigger a CRITICAL brute-force-attack incident |
| FR-04.4 | **Cascade failure correlation:** 3+ ERROR events from different sources within 60 seconds SHALL trigger a CRITICAL cascade-failure incident |
| FR-04.5 | **Timeout storm correlation:** 10+ timeout events within 300 seconds SHALL trigger a HIGH service-degradation incident |
| FR-04.6 | **Threshold monitoring:** System SHALL track event counts per source:level and trigger incidents when configurable thresholds are breached |
| FR-04.7 | Each incident SHALL be assigned a unique sequential ID (INC-001, INC-002, ...) |

### 3.5 Response Planning (FR-05)

| ID | Requirement |
|----|------------|
| FR-05.1 | System SHALL auto-assign a response playbook to each incident |
| FR-05.2 | **Playbooks:** security-containment (P1, 15 min), cascade-recovery (P1, 20 min), service-recovery (P2, 30 min), performance-remediation (P3, 45 min), manual-triage (P4, 60 min) |
| FR-05.3 | Each playbook SHALL include a prioritized list of recommended actions |
| FR-05.4 | Security incidents → security-containment; ERROR/crash → service-recovery; Default → manual-triage |

### 3.6 Reporting (FR-06)

| ID | Requirement |
|----|------------|
| FR-06.1 | System SHALL generate analysis reports containing: processedEntries, detectedIncidents, severityBreakdown, incidentsByType, logFiles, parseErrors, formatDistribution, and metrics |
| FR-06.2 | System SHALL export reports to CSV format (incident rows with ID, Severity, Type, Source, Timestamp, Message, Playbook) |
| FR-06.3 | System SHALL export reports to PDF format with summary and incident listing |
| FR-06.4 | System SHALL persist reports to MongoDB with timestamps |
| FR-06.5 | System SHALL support retrieving the latest report and reports by ID |

### 3.7 Notifications (FR-07)

| ID | Requirement |
|----|------------|
| FR-07.1 | System SHALL send notifications via: Slack (webhook), Email (SMTP/Resend), Google Chat (webhook), Generic Webhook |
| FR-07.2 | System SHALL deduplicate alerts using composite keys (recipient:severity:type:source:message) |
| FR-07.3 | System SHALL retry failed notifications with exponential backoff (3 attempts, 250ms base delay) |
| FR-07.4 | System SHALL enforce a 5-second timeout per channel send |
| FR-07.5 | System SHALL register CRITICAL incidents with the EscalationPolicy |
| FR-07.6 | System SHALL respect per-user notification preferences |

### 3.8 Authentication & Authorization (FR-08)

| ID | Requirement |
|----|------------|
| FR-08.1 | System SHALL support email/password registration and login with bcrypt password hashing |
| FR-08.2 | System SHALL support Google OAuth sign-in |
| FR-08.3 | System SHALL issue JWT tokens with configurable expiration (default: 24h) |
| FR-08.4 | System SHALL enforce RBAC with roles: admin, analyst, viewer |
| FR-08.5 | System SHALL provide a dev-bypass mode for testing/development |
| FR-08.6 | System SHALL log all API actions via audit middleware |

### 3.9 REST API (FR-09)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/health` | Health check with uptime and version |
| POST | `/api/analyze` | Analyze server-side log files |
| POST | `/api/upload` | Upload + analyze files (.log, .pdf) |
| GET | `/api/reports/latest` | Retrieve most recent report |
| GET | `/api/reports/:id` | Retrieve report by ID |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/google` | Google OAuth login |
| * | `/api/stream-ingest/*` | Live stream ingestion endpoints |

### 3.10 Frontend Dashboard (FR-10)

| ID | Requirement |
|----|------------|
| FR-10.1 | Dashboard page SHALL display summary cards (total entries, incidents, severity breakdown) |
| FR-10.2 | Dashboard SHALL show incident list with filtering by severity |
| FR-10.3 | Dashboard SHALL display incident details with timeline view |
| FR-10.4 | Upload page SHALL provide drag-and-drop file upload with analysis results |
| FR-10.5 | Report page SHALL display report history with PDF/CSV export options |
| FR-10.6 | Stream Ingest page SHALL show real-time log stream and live incidents |
| FR-10.7 | System SHALL provide Login and Registration pages |
| FR-10.8 | System SHALL provide user profile management with notification settings |
| FR-10.9 | Dashboard SHALL use a dark-mode design theme |

### 3.11 ML Classification Service (FR-11)

| ID | Requirement |
|----|------------|
| FR-11.1 | ML service SHALL expose FastAPI endpoints: `/health`, `/classify`, `/classify/structured` |
| FR-11.2 | Structured classification SHALL accept: anomaly_type, status, cpu_usage, memory_usage, disk_usage, response_time_ms, login_attempts, failed_transactions, retry_count, alert_method, service_type |
| FR-11.3 | Service SHALL return: label (severity), confidence score, and per-class probability scores |
| FR-11.4 | Minimum 3 numeric signals AND 2 categorical signals required before routing to ML model |

---

## 4. Non-Functional Requirements

### 4.1 Performance (NFR-01)

| ID | Requirement |
|----|------------|
| NFR-01.1 | API response time SHALL be < 2 seconds for standard log analysis requests |
| NFR-01.2 | ML classification timeout SHALL be ≤ 300ms per entry |
| NFR-01.3 | System SHALL support JSON body sizes up to 50 MB |
| NFR-01.4 | Real-time streaming SHALL deliver events with < 1 second latency |

### 4.2 Reliability (NFR-02)

| ID | Requirement |
|----|------------|
| NFR-02.1 | System SHALL fall back to file-based storage if MongoDB is unavailable |
| NFR-02.2 | System SHALL fall back to rule-based classification if ML service is down |
| NFR-02.3 | Notification service SHALL retry 3 times with exponential backoff on failure |
| NFR-02.4 | Server SHALL implement graceful shutdown on SIGTERM/SIGINT |

### 4.3 Security (NFR-03)

| ID | Requirement |
|----|------------|
| NFR-03.1 | All passwords SHALL be hashed using bcrypt |
| NFR-03.2 | API access SHALL be protected via JWT Bearer tokens |
| NFR-03.3 | CORS SHALL be restricted to configured origins |
| NFR-03.4 | Rate limiting SHALL be applied to all API endpoints |
| NFR-03.5 | All API actions SHALL be logged via audit middleware |
| NFR-03.6 | File uploads SHALL be validated for type and size |

### 4.4 Scalability (NFR-04)

| ID | Requirement |
|----|------------|
| NFR-04.1 | System SHALL support background job processing via BullMQ + Redis |
| NFR-04.2 | Repository pattern SHALL allow swapping storage backends |
| NFR-04.3 | Notification channels SHALL be pluggable via Strategy pattern |

### 4.5 Maintainability (NFR-05)

| ID | Requirement |
|----|------------|
| NFR-05.1 | System SHALL use dependency injection for all core services |
| NFR-05.2 | Configuration SHALL be centralized via environment variables |
| NFR-05.3 | All business rules SHALL be externalized in config files |
| NFR-05.4 | Shared constants SHALL be maintained in a single source-of-truth module |

### 4.6 Testability (NFR-06)

| ID | Requirement |
|----|------------|
| NFR-06.1 | System SHALL maintain a test suite with 77+ tests |
| NFR-06.2 | Unit tests SHALL cover: parsers, classifiers, detectors, correlation engine, orchestrator |
| NFR-06.3 | Integration tests SHALL cover: REST API endpoints, file upload, WebSocket streaming |

### 4.7 Deployment (NFR-07)

| ID | Requirement |
|----|------------|
| NFR-07.1 | System SHALL be deployable via Docker Compose (MongoDB + Redis + Server + Client) |
| NFR-07.2 | Server SHALL run on port 3001 (configurable) |
| NFR-07.3 | Client SHALL run on port 5173 (Vite dev server) |

---

## 5. Data Models

### 5.1 LogEntry
```
{
  timestamp:  string    // "2026-04-04 09:00:00"
  level:      string    // ERROR, WARNING, INFO, DEBUG
  source:     string    // Component/module name
  message:    string    // Log message content
  rawLine:    string    // Original unmodified log line
  severity:   string    // Assigned: CRITICAL/HIGH/MEDIUM/LOW
}
```

### 5.2 IncidentRecord
```
{
  id:         string    // "INC-001" (auto-generated)
  severity:   string    // CRITICAL/HIGH/MEDIUM/LOW
  source:     string    // Component that generated the log
  timestamp:  string    // When the incident occurred
  message:    string    // Incident description
  type:       string    // severity-trigger, keyword-trigger, brute-force-attack, etc.
  reason:     string    // Human-readable trigger reason
  playbook:   string    // Assigned playbook name
  actions:    string[]  // Recommended response actions
  priority:   string    // P1-P4
  status:     string    // OPEN, ACKNOWLEDGED, RESOLVED, CLOSED
  metadata:   object    // Additional context
  eventCount: number    // For correlation-based incidents
}
```

### 5.3 Report
```
{
  generatedAt:        string    // ISO timestamp
  processedEntries:   number    // Total parsed lines
  detectedIncidents:  number    // Total incidents
  severityBreakdown:  object    // { CRITICAL, HIGH, MEDIUM, LOW }
  incidentsByType:    object    // { 'brute-force-attack': 3, ... }
  logFiles:           string[]  // Source file paths
  parseErrors:        number    // Failed parse count
  formatDistribution: object    // file → detected format
  metrics:            object    // Derived summary metrics
}
```

### 5.4 User
```
{
  _id:        ObjectId   // Auto-assigned
  name:       string
  email:      string     // Unique, indexed
  password:   string     // bcrypt hash (null for Google-only)
  googleId:   string     // (null for email-only)
  avatar:     string     // Profile picture URL
  role:       string     // admin | analyst | viewer
  provider:   string     // local | google
  notificationPreferences: object
  createdAt:  Date
  updatedAt:  Date
}
```

### 5.5 MongoDB Collections

| Collection | Purpose |
|-----------|---------|
| `reports` | Analysis report documents |
| `incidents` | Detected incident records |
| `log_entries` | Parsed log entries |
| `source_documents` | Uploaded source file metadata |
| `users` | User accounts |

---

## 6. System Interfaces

### 6.1 ML Microservice Interface
- **Protocol:** HTTP REST
- **Base URL:** `http://localhost:5001`
- **Endpoints:** `GET /health`, `POST /classify`, `POST /classify/structured`
- **Request format:** JSON with anomaly features
- **Response format:** `{ label, confidence, scores }`

### 6.2 Notification Channel Interfaces
- **Slack:** HTTP POST to configured webhook URL
- **Email:** SMTP (Nodemailer) or Resend REST API
- **Google Chat:** HTTP POST to webhook URL
- **Webhook:** HTTP POST to configured generic endpoint

### 6.3 Database Interface
- **MongoDB:** Native driver (mongodb@6.8.0) on port 27017
- **Redis:** Port 6379 (for BullMQ queue)
- **Fallback:** JSON file-based storage in `./output` directory

---

## 7. Environment Configuration

```env
PORT=3001                          # Server port
MONGO_URI=mongodb://localhost:27017/log_analyzer
DB_NAME=log_analyzer
JWT_SECRET=your_secret             # JWT signing key
JWT_EXPIRES_IN=24h
LOG_DIR=./logs                     # Default log directory
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760             # 10 MB
ML_SERVICE_URL=http://localhost:5001
ML_ENABLED=true
ML_CONFIDENCE_THRESHOLD=0.75
ML_TIMEOUT_MS=300
SLACK_WEBHOOK_URL=                 # Optional
SMTP_HOST=                         # Optional
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
RESEND_API_KEY=                    # Optional
ALERT_EMAIL_TO=
WEBHOOK_URL=                       # Optional
GOOGLE_CHAT_WEBHOOK_URL=           # Optional
GOOGLE_CLIENT_ID=                  # For OAuth
```

---

## 8. Project Structure

```
project/
├── server/                        # Node.js backend
│   ├── src/
│   │   ├── config/                # rules, playbooks, env, alertChannels, parserFormats
│   │   ├── controllers/           # analysis, auth, report, streamIngest, upload
│   │   ├── db/                    # MongoDatabase connection
│   │   ├── middleware/            # auth, rbac, rateLimiter, audit, upload, validate, errorHandler
│   │   ├── models/                # LogEntry, IncidentRecord, Report, User, AuditLog, AlertEvent
│   │   ├── repositories/         # MongoRepository, FileRepository, AuditRepository
│   │   ├── routes/                # analysis, auth, report, streamIngest, upload
│   │   ├── services/
│   │   │   ├── ingestion/         # LogReader, LogSourceResolver, ValidationService
│   │   │   ├── parsing/           # FormatDetector, ParserFactory, Normalizer, PdfAnalysisService
│   │   │   ├── analysis/          # SeverityClassifier, IncidentDetector, CorrelationEngine, ThresholdMonitor, MLClassifierClient
│   │   │   ├── response/          # ResponsePlanner, PlaybookRegistry
│   │   │   ├── reporting/         # ReportBuilder, ReportViewModelBuilder, ReportExporter
│   │   │   ├── notification/      # NotificationService, AlertDeduplicator, EscalationPolicy, channels/
│   │   │   └── IncidentOrchestrator.js
│   │   ├── utils/                 # logger, retry, errors, secretBox, CommandLineUI
│   │   └── cli/                   # CLI interface
│   ├── ml/                        # Python ML microservice
│   │   ├── app.py                 # FastAPI server
│   │   ├── train_xgboost.py       # Model training script
│   │   ├── severity_features.py   # Feature engineering
│   │   └── model.joblib           # Trained model artifact
│   └── tests/                     # Jest unit + integration tests
├── client/                        # React 19 + Vite 8 frontend
│   └── src/
│       ├── components/            # 15 reusable UI components
│       ├── hooks/                 # useFileUpload, useIncidentDashboard, useStreamIngest
│       ├── pages/                 # Dashboard, Login, Register, Report, StreamIngest, Upload, UserData
│       ├── services/              # apiClient, authApi, incidentApi, streamIngestApi, uploadApi
│       ├── contexts/              # React context providers
│       ├── layouts/               # Layout components
│       └── routes/                # Route configuration
├── shared/                        # Shared constants (single source of truth)
├── logs/                          # Sample log files
├── docker-compose.yml             # MongoDB + Redis orchestration
└── test/                          # Cross-project test runners
```

---

## 9. Testing Requirements

| Category | Coverage |
|----------|---------|
| Unit Tests | All parsers, SeverityClassifier, IncidentDetector, CorrelationEngine, ThresholdMonitor, IncidentOrchestrator, ReportBuilder |
| Integration Tests | REST API endpoints (analyze, upload, reports, health), file upload pipeline, authentication flow |
| Total Tests | 77+ tests — all passing |
| Framework | Jest 30 + Supertest 7 |
| Commands | `npm test` (all), `npm run test:unit`, `npm run test:integration` |

---

## 10. Appendix

### A. Severity Score Calculation
```
Total Score = Base Score + Keyword Score + Frequency Boost

Base Score: CRITICAL=8, HIGH=5, MEDIUM=3, LOW=1
Keyword Weights: unauthorized/breach/attack/exploit/injection/malware=3,
                 failed/denied/suspicious/crash/overflow/outage=2,
                 timeout/retry/degraded=1
Frequency Boost: 5 events in 120s=+1, 10=+2, 20=+3

Final: ≥8→CRITICAL, ≥5→HIGH, ≥3→MEDIUM, <3→LOW
```

### B. Correlation Rules Summary
| Rule | Condition | Window | Threshold | Severity |
|------|----------|--------|-----------|----------|
| Brute Force | "login failed" messages | 120s | 5 events | CRITICAL |
| Cascade Failure | ERROR from multiple sources | 60s | 3 sources | CRITICAL |
| Timeout Storm | "timeout" messages | 300s | 10 events | HIGH |

### C. Playbook Priority Matrix
| Playbook | Priority | Est. Time | Trigger |
|----------|----------|-----------|---------|
| security-containment | P1 | 15 min | Security keywords / source |
| cascade-recovery | P1 | 20 min | Multi-source correlation |
| service-recovery | P2 | 30 min | ERROR / crash keywords |
| performance-remediation | P3 | 45 min | Degradation patterns |
| manual-triage | P4 | 60 min | Default / ambiguous |

---

*End of SRS Document*
