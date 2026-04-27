#  Automated Log Analysis & Incident Response System

A production-grade observability and incident response platform that ingests, parses, classifies, and correlates logs from any source — then auto-assigns playbooks, alerts the team, and streams everything live to a dark-mode dashboard.

---

##  Features

| # | Capability | How |
|---|---|---|
| 1 | **Ingests** logs from files, uploads, batch folders, live streams | LogReader · BatchIngester · StreamIngester · Multer |
| 2 | **Parses** any log format automatically | ParserFactory → 5 strategy parsers |
| 3 | **Normalizes** all formats into one unified schema | Normalizer |
| 4 | **Classifies** severity (LOW / MEDIUM / HIGH / CRITICAL) | Rules + keywords + frequency scoring |
| 5 | **Detects** incidents (single-log + multi-log correlation + thresholds) | IncidentDetector · CorrelationEngine · ThresholdMonitor |
| 6 | **Recommends** response playbooks | ResponsePlanner · PlaybookRegistry |
| 7 | **Generates** reports with detailed metrics | ReportBuilder · ReportExporter (PDF/CSV) |
| 8 | **Persists** to MongoDB (hot) with JSON file fallback | Repository Pattern |
| 9 | **Alerts** via Slack / Email / Webhook with dedup + escalation | NotificationService |
| 10 | **Streams** real-time updates to dashboard | Socket.io WebSocket |
| 11 | **Processes** large files via background queues | BullMQ + Redis |
| 12 | **Audits** every action with RBAC access control | Audit middleware · JWT · Roles |

---

##  Architecture

```
Logs come in → Detect format → Pick parser → Parse → Normalize
→ Classify severity → Detect incidents (single + multi-log + threshold)
→ Assign playbook → Build report → Save to DB
→ Alert on CRITICAL → Stream to dashboard in real-time
```

### Key Design Patterns

| Pattern | Where | Why |
|---|---|---|
| **Strategy** | ParserFactory, NotificationService | Swap parsers/channels without changing callers |
| **Factory** | ParserFactory, createApp() | Create objects without exposing logic |
| **Repository** | Mongo/FileRepository | Swap storage without changing business logic |
| **Observer** | EventEmitterBridge → SocketManager | Decouple analysis from WebSocket |
| **Pipeline** | AnalysisEngine | Chain processing steps cleanly |
| **Dependency Injection** | app.js constructor injection | Testable, swappable components |
| **Circuit Breaker** | retry.js | Handle external service failures gracefully |

---

##  Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| API | Express 4 |
| Real-Time | Socket.io |
| Queue | BullMQ + Redis |
| Database | MongoDB (native driver) |
| PDF | pdf-parse |
| Upload | Multer |
| Logging | Winston |
| Auth | jsonwebtoken + bcrypt |
| Email | Nodemailer |
| File Watch | chokidar |
| Testing | Jest + Supertest |
| Frontend | React 18 + Vite 5 |
| HTTP Client | Axios |
| Container | Docker Compose |

---

##  Quick Start (Docker Compose)

> **Prerequisites:** Docker Desktop must be running.

```bash
# 1. Clone the repository
git clone <repo-url>
cd log-analyzer

# 2. Boot all services (MongoDB + Redis + Server + Client)
docker compose up --build

# 3. Open the dashboard
open http://localhost:5173
```

The server API runs on **port 3001**, the React dashboard on **port 5173**.

---

##  Local Development

### Server

```bash
cd server
cp .env.example .env   # Fill in your env vars
npm install
npm run dev            # Starts Express + Socket.io on :3001
```

### Client

```bash
cd client
npm install
npm run dev            # Starts Vite dev server on :5173
```

### Run Tests

```bash
cd server
npm test               # 77 tests — all should pass
```

### CLI Mode (no browser needed)

```bash
cd server
npm run cli            # Interactive terminal menu
```

---

## ⚙️ Environment Variables

Copy `server/.env.example` to `server/.env` and configure:

```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/log_analyzer
REDIS_URL=redis://localhost:6379
QUEUE_ENABLED=false        # Set to true to enable BullMQ workers
JWT_SECRET=your_secret
SLACK_WEBHOOK_URL=         # Optional: Slack incoming webhook
EMAIL_HOST=                # Optional: SMTP host for email alerts
WEBHOOK_URL=               # Optional: Generic webhook endpoint
WATCH_LOG_DIR=./logs       # Directory to watch for live streaming
```

---

## 📊 API Reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/analyze` | Analyze server-side log files |
| POST | `/api/upload` | Upload + analyze files (`.log`, `.pdf`) |
| GET | `/api/reports/latest` | Retrieve the most recent report |
| GET | `/api/reports/:id` | Retrieve a specific report by ID |
| POST | `/api/realtime/start` | Start live log folder monitoring |
| POST | `/api/realtime/stop` | Stop live monitoring |

---

##  Sample Log Files

The `logs/` directory includes samples for every parser:

| File | Format |
|---|---|
| `application.log` | Space-delimited |
| `security.log` | Space-delimited |
| `system.log` | Space-delimited |
| `api-access.log` | Apache Combined |
| `microservice.json.log` | JSON (newline-delimited) |
| `syslog.log` | Syslog RFC 5424 |

---

##  Dashboard Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Summary cards, severity chart, incident list + details |
| Live Monitor | `/live` | Real-time WebSocket log stream + live incidents |
| Upload | `/upload` | Drag-and-drop file upload with analysis results |
| Reports | `/reports` | Report history, PDF/CSV export |

---

##  Testing

```bash
cd server && npm test
```

Test coverage includes:
- **Unit tests** — All parsers, classifiers, detectors, correlation engine, orchestrator
- **Integration tests** — REST API endpoints, file upload, WebSocket streaming

---

##  Project Structure

```
log-analyzer/
├── server/                  # Node.js backend
│   ├── src/
│   │   ├── config/          # Rules, playbooks, parser formats, alert channels
│   │   ├── controllers/     # Express route handlers
│   │   ├── db/              # MongoDB connection
│   │   ├── middleware/       # Auth, RBAC, rate limiter, audit, upload
│   │   ├── models/          # LogEntry, IncidentRecord, Report, etc.
│   │   ├── queues/          # BullMQ queue setup + processors
│   │   ├── repositories/    # Mongo + File persistence adapters
│   │   ├── routes/          # Express routers
│   │   ├── services/        # Core business logic
│   │   │   ├── ingestion/   # LogReader, BatchIngester, StreamIngester
│   │   │   ├── parsing/     # ParserFactory, FormatDetector, Normalizer, parsers
│   │   │   ├── analysis/    # SeverityClassifier, IncidentDetector, CorrelationEngine
│   │   │   ├── response/    # ResponsePlanner, PlaybookRegistry
│   │   │   ├── reporting/   # ReportBuilder, ReportViewModel, ReportExporter
│   │   │   ├── notification/# NotificationService + channels (Slack, Email, Webhook)
│   │   │   └── realtime/    # SocketManager, LiveAnalyzer, EventEmitterBridge
│   │   └── utils/           # logger, retry, errors, idGenerator
│   └── tests/               # Unit + integration test suites
├── client/                  # React 18 + Vite frontend
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── hooks/           # useDashboard, useLogStream, useWebSocket, useFileUpload
│       ├── pages/           # DashboardPage, LiveStreamPage, UploadPage, ReportPage
│       └── services/        # apiClient, incidentApi, uploadApi, socketClient
├── logs/                    # Sample log files (all formats)
├── shared/                  # Shared constants
└── docker-compose.yml       # Full stack orchestration
```

---

##  Project Complete

Built following the **Final Roadmap** — all 27 days of deliverables shipped:

- [x] Week 1: Core analysis pipeline (ingestion → parsing → classification → detection → playbook → report)
- [x] Week 2: REST API + MongoDB persistence + React dashboard (dark-mode)
- [x] Week 3: File upload (PDF + log) + real-time WebSocket streaming + notifications + BullMQ queues + RBAC/audit
- [x] Week 4: Report export (PDF/CSV) + full test suite (77 tests passing) + Docker Compose + documentation
