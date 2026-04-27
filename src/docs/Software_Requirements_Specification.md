# Software Requirements Specification (SRS)

**Project:** Automated Log Analysis and Incident Response System  
**Version:** 1.0  
**Document Date:** 2026-04-27  
**Baseline:** Current repository implementation in this workspace

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for the Automated Log Analysis and Incident Response System. It describes the product scope, users, interfaces, functional requirements, non-functional requirements, data requirements, and implementation constraints for the current full-stack project.

### 1.2 Scope

The system is a full-stack observability and incident-response application that:

- authenticates users and manages roles,
- analyzes server-side log files or user-uploaded evidence files,
- detects incidents from parsed log data,
- classifies severity using rules and optional ML assistance,
- assigns response playbooks,
- stores reports, incidents, and source metadata,
- supports live stream ingestion through Server-Sent Events (SSE),
- sends notifications through configured channels, and
- exposes a React dashboard for investigation workflows.

### 1.3 Intended Audience

This SRS is intended for:

- project maintainers and developers,
- QA and test engineers,
- instructors, reviewers, or stakeholders,
- DevOps or deployment owners,
- future contributors onboarding onto the codebase.

### 1.4 Definitions and Acronyms

| Term | Meaning |
|---|---|
| SRS | Software Requirements Specification |
| JWT | JSON Web Token used for API authentication |
| RBAC | Role-Based Access Control |
| SSE | Server-Sent Events |
| ML | Machine Learning |
| Report | Persisted summary of one analysis or stream session |
| Source Document | Metadata record for an uploaded file or stream session |
| Incident | A detected security or operational event requiring attention |

## 2. Overall Description

### 2.1 Product Perspective

The product is organized into three major parts:

| Layer | Responsibilities |
|---|---|
| React client | Login, registration, dashboard, upload flow, stream ingest UI, user-data view, notification settings |
| Node.js/Express server | REST API, auth, analysis orchestration, reporting, persistence, stream ingestion, notifications |
| Storage and integrations | MongoDB or file fallback, optional ML microservice, optional email provider, optional Google Chat webhook, external HTTP streams |

### 2.2 High-Level Workflow

1. A user authenticates and opens the protected dashboard.
2. The user runs one of three analysis flows:
   - analyze default or selected server log files,
   - upload `.log` or `.pdf` files for ad hoc analysis,
   - start a live stream ingest session from demo data or an external URL.
3. The system parses, normalizes, classifies, and evaluates entries for incidents.
4. The system assigns a response playbook and creates a report.
5. The system persists report data and source metadata.
6. The user reviews incidents, exports reports, or inspects stored account data.

### 2.3 User Classes

| User Class | Description | Current Permissions |
|---|---|---|
| Admin | Full system operator | `analyze`, `upload`, `reports:read`, `reports:delete`, `users:manage` |
| Analyst | Standard operational user | `analyze`, `upload`, `reports:read` |
| Viewer | Read-only role | `reports:read` |

### 2.4 Operating Environment

| Area | Requirement |
|---|---|
| Backend runtime | Node.js 20+ |
| Frontend runtime | Modern browser running React/Vite bundle |
| Backend OS | Cross-platform Node environment |
| Database | MongoDB when configured; file-based fallback otherwise |
| Optional services | SMTP or Resend-compatible email delivery, Google OAuth, Google Chat webhook, ML service |

### 2.5 Design Constraints

- The backend is implemented in CommonJS with Express.
- The client is implemented in React with React Router.
- Uploads are processed in memory and are not stored as raw files on disk by default.
- JWT authentication is required for protected API routes.
- Upload size and count limits are enforced centrally.
- Stream ingest currently uses SSE, not a separate browser WebSocket client API.

### 2.6 Assumptions and Dependencies

- MongoDB is optional; the application must still start without it by using file storage.
- Google sign-in requires a valid Google client ID and Google auth library at runtime.
- Email notifications require valid runtime delivery configuration.
- ML classification is optional and only applies to sufficiently structured anomaly-style data.
- The default log-analysis flow assumes `.log` files exist in configured directories.

## 3. External Interface Requirements

### 3.1 User Interface

The client shall provide the following pages and interaction surfaces:

| UI Area | Description |
|---|---|
| Login page | Email/password sign-in and optional Google sign-in |
| Register page | New account creation |
| Dashboard page | Run analysis, load latest report, inspect summary and incidents |
| Upload page | Drag-and-drop or browse upload of `.log` and `.pdf` files |
| Stream Ingest page | Start demo or external URL stream sessions and monitor live entries/incidents |
| My Data page | View stored account fields, collection counts, and profile editing options |
| Profile/notification modal | Manage notification preferences and sign out |

### 3.2 REST API

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create local account |
| `POST` | `/api/auth/login` | No | Sign in with email/password |
| `POST` | `/api/auth/google` | No | Sign in with Google token |
| `GET` | `/api/auth/me` | Yes | Fetch current profile |
| `PUT` | `/api/auth/notifications` | Yes | Update notification preferences |
| `POST` | `/api/auth/notifications/test-email` | Yes | Send notification test email |
| `GET` | `/api/auth/user-data` | Yes | Return stored user profile and stats |
| `GET` | `/api/auth/user-data/:collection` | Yes | Return user-scoped collection data |
| `PUT` | `/api/auth/update-profile` | Yes | Update display name and/or password |
| `GET` | `/api/health` | No | Health check and log-source summary |
| `POST` | `/api/analyze` | Yes | Analyze server-side log files |
| `POST` | `/api/upload` | Yes | Upload and analyze evidence files |
| `GET` | `/api/upload` | Yes | List stored source documents |
| `GET` | `/api/upload/list` | Yes | List stored source documents |
| `GET` | `/api/reports/latest` | Yes | Get latest report for current user |
| `GET` | `/api/reports/latest/export` | Yes | Export latest report as CSV or PDF |
| `GET` | `/api/reports/:id` | Yes | Get specific report by ID |
| `GET` | `/api/reports/:id/export` | Yes | Export specific report by ID |
| `GET` | `/api/stream-ingest/demo` | Yes | Start built-in demo stream over SSE |
| `GET` | `/api/stream-ingest/start` | Yes | Proxy external stream over SSE |
| `DELETE` | `/api/stream-ingest/:sessionId/stop` | Yes | Stop a live session |

### 3.3 Stream Ingest SSE Contract

The stream-ingest endpoints shall emit SSE events with the following event names:

| Event | Payload Summary |
|---|---|
| `session` | Session metadata such as `sessionId` and mode |
| `entry` | Structured analyzed log/event record |
| `incident` | Incident detected during the stream |
| `metrics` | Running totals, entries/sec, severity breakdown, elapsed time |
| `error` | Error message |
| `done` | Session completion summary |

### 3.4 External System Interfaces

| External System | Interface Type | Purpose |
|---|---|---|
| MongoDB | Native MongoDB driver | Primary persistence for reports, incidents, log entries, users, and source documents |
| Local file system | JSON files | Fallback persistence for reports, users, uploads, and audit logs |
| Google Identity | OAuth token verification | Optional Google sign-in |
| Google Chat | HTTPS webhook | Optional incident notification delivery |
| Email provider | SMTP or Resend-style delivery | Optional incident notification delivery |
| External HTTP streams | HTTP/SSE/NDJSON/text | Live ingestion source |
| Optional ML service | HTTP API | Structured severity classification assistance |

## 4. Functional Requirements

### 4.1 Authentication and User Management

| ID | Requirement |
|---|---|
| FR-01 | The system shall allow a new user to register with name, email, and password. |
| FR-02 | The system shall validate registration input and reject missing fields, invalid emails, and passwords shorter than 6 characters. |
| FR-03 | The system shall normalize stored email addresses to lowercase. |
| FR-04 | The system shall hash local-account passwords before storage using bcrypt when available, or a scrypt fallback when bcrypt is unavailable. |
| FR-05 | The system shall issue a JWT after successful registration or login. |
| FR-06 | The system shall allow login using email and password for local accounts. |
| FR-07 | The system shall reject password login for Google-only accounts without a stored password. |
| FR-08 | The system shall support Google sign-in when Google runtime configuration is present. |
| FR-09 | The system shall store a user role for each account and apply RBAC to protected endpoints. |
| FR-10 | The system shall auto-upgrade legacy `viewer` users to `analyst` during login when needed for core workflows. |
| FR-11 | The system shall provide a profile endpoint for the authenticated user. |
| FR-12 | The system shall allow the authenticated user to update their display name. |
| FR-13 | The system shall allow the authenticated user to change their password when the current password is supplied and validated. |
| FR-14 | The system shall allow the authenticated user to view stored account data and user-scoped collection statistics. |

### 4.2 Notification Preferences and Test Delivery

| ID | Requirement |
|---|---|
| FR-15 | The system shall allow each user to enable or disable incident notifications. |
| FR-16 | The system shall allow a user to save a Google Chat webhook URL for notifications. |
| FR-17 | The system shall validate Google Chat webhook URLs and reject invalid or non-HTTPS URLs. |
| FR-18 | The system shall derive the notification email from the authenticated account email rather than trusting arbitrary client-submitted SMTP identity fields. |
| FR-19 | The system shall reject email-only notification enablement when runtime email delivery capability is unavailable. |
| FR-20 | The system shall provide a test-email endpoint that sends a simulated incident email to the authenticated user's registered email when delivery is available. |

### 4.3 File Discovery and Upload Intake

| ID | Requirement |
|---|---|
| FR-21 | The system shall support analysis of explicitly provided log file paths. |
| FR-22 | The system shall support analysis of all `.log` files in a provided directory. |
| FR-23 | The system shall support fallback log discovery from configured default directories when explicit input is absent. |
| FR-24 | The system shall accept upload analysis requests containing `.log` and `.pdf` files only. |
| FR-25 | The system shall reject unsupported upload extensions. |
| FR-26 | The system shall limit uploads to 10 files per request. |
| FR-27 | The system shall limit each uploaded file to 10 MB. |
| FR-28 | The system shall process uploaded files in memory without requiring permanent raw-file storage. |
| FR-29 | The system shall extract text lines from PDF uploads before analysis. |

### 4.4 Parsing, Normalization, and Classification

| ID | Requirement |
|---|---|
| FR-30 | The system shall detect at least the following input formats: JSON logs, syslog, Apache-style logs, space-delimited logs, and generic text. |
| FR-31 | The system shall parse supported log formats into a common normalized entry model containing timestamp, level, source, message, and raw line. |
| FR-32 | The system shall classify each parsed entry into one of four severities: `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`. |
| FR-33 | The system shall apply rule-based severity classification using log level, keyword scoring, and short-window event frequency boosts. |
| FR-34 | The system shall optionally call an ML classifier for structured anomaly-style entries when enough categorical and numeric features are present. |
| FR-35 | The system shall fall back to rule-based classification when ML is disabled, unreachable, low-confidence, or inapplicable. |

### 4.5 Incident Detection and Response Planning

| ID | Requirement |
|---|---|
| FR-36 | The system shall detect incidents from individual log entries based on severity and incident keywords. |
| FR-37 | The system shall support multi-entry correlation rules for patterns such as repeated failed logins, cascade failures, and timeout storms. |
| FR-38 | The system shall support threshold-based incident generation after aggregate event thresholds are exceeded. |
| FR-39 | The system shall assign a unique incident ID for each generated incident within an analysis session. |
| FR-40 | The system shall assign a response playbook and action list to each incident. |
| FR-41 | The system shall support at least the following playbooks: `security-containment`, `cascade-recovery`, `service-recovery`, `performance-remediation`, and `manual-triage`. |

### 4.6 Reporting and Persistence

| ID | Requirement |
|---|---|
| FR-42 | The system shall build an analysis report containing processed entry count, incident count, severity breakdown, incident type totals, log file list, parse-error count, and derived metrics. |
| FR-43 | The system shall generate a dashboard-friendly view model from each report. |
| FR-44 | The system shall persist reports, incidents, and log entries after completed file or upload analysis runs. |
| FR-45 | The system shall associate persisted records with the current user through `ownerId` when authentication is available. |
| FR-46 | The system shall persist source-document metadata for uploaded files. |
| FR-47 | The system shall allow the authenticated user to fetch only their own latest report. |
| FR-48 | The system shall allow the authenticated user to fetch only their own report by ID. |
| FR-49 | The system shall allow report export in CSV format. |
| FR-50 | The system shall allow report export in PDF format. |
| FR-51 | The system shall allow the authenticated user to list stored source documents related to uploads or stream sessions. |

### 4.7 Stream Ingest

| ID | Requirement |
|---|---|
| FR-52 | The system shall provide a built-in demo stream source for live analysis. |
| FR-53 | The system shall provide a live ingest mode for external HTTP streaming URLs. |
| FR-54 | The system shall accept plain text, NDJSON, and SSE-formatted upstream streams. |
| FR-55 | The system shall classify each incoming stream event in real time and emit it to the client as an SSE `entry` event. |
| FR-56 | The system shall emit SSE `incident` events when live entries are classified as incidents. |
| FR-57 | The system shall emit running metrics during stream processing. |
| FR-58 | The system shall allow the owner of a stream session to stop that session. |
| FR-59 | The system shall prevent other users from stopping a session they do not own. |
| FR-60 | The system shall persist buffered stream entries, incidents, and a session-level report when a stream completes, is stopped, or disconnects. |
| FR-61 | The system shall create a source-document record for each persisted stream session. |

### 4.8 Notifications, Audit, and Error Handling

| ID | Requirement |
|---|---|
| FR-62 | The system shall send notifications only through channels that are enabled and applicable for the current incident and user context. |
| FR-63 | The system shall support notification deduplication using a recipient-aware dedupe key. |
| FR-64 | The system shall retry failed notification sends with bounded exponential backoff. |
| FR-65 | The system shall register `CRITICAL` incidents with an escalation policy. |
| FR-66 | The system shall record audit entries for JSON API responses, including action, user identity, response status, and duration. |
| FR-67 | The system shall validate request payloads and return structured JSON errors on invalid input. |
| FR-68 | The system shall provide a health endpoint returning status, timestamp, uptime, version, and default log-file count. |

## 5. Data Requirements

### 5.1 Core Data Entities

| Entity | Primary Fields |
|---|---|
| User | `name`, `email`, `password`, `googleId`, `avatar`, `role`, `provider`, `notificationPreferences`, `createdAt`, `updatedAt` |
| Report | `generatedAt`, `processedEntries`, `detectedIncidents`, `severityBreakdown`, `incidentsByType`, `logFiles`, `parseErrors`, `formatDistribution`, `metrics`, `ownerId`, `createdAt` |
| Incident | `id`, `severity`, `source`, `timestamp`, `message`, `type`, `reason`, `playbook`, `actions`, `priority`, `status`, `metadata`, `reportId`, `ownerId` |
| Log Entry | `timestamp`, `level`, `severity`, `source`, `message`, `rawLine`, `classifiedBy`, `reportId`, `ownerId` |
| Source Document | `originalName`, `mimeType`, `fileSizeBytes`, `extractedLines`, `reportId`, `ownerId`, `uploadedAt` |
| Audit Log | `action`, `userId`, `resource`, `details`, `timestamp` |
| Alert Event | `incidentId`, `channel`, `status`, `dedupeKey`, `retryCount`, `sentAt` |

### 5.2 Storage Backends

| Mode | Expected Behavior |
|---|---|
| Mongo-backed mode | Full repository persistence with indexed collections and user-scoped querying |
| File-backed mode | JSON-file persistence for reports, users, source documents, and audit logs when MongoDB is unavailable |

### 5.3 Data Integrity Rules

- User emails shall be unique in Mongo-backed storage.
- Source documents shall be returned newest first.
- Report retrieval by ID shall be scoped to the authenticated owner when owner scoping is available.
- Uploaded-file metadata shall be stored even though raw upload buffers are not kept as permanent source files.

## 6. Non-Functional Requirements

### 6.1 Security

| ID | Requirement |
|---|---|
| NFR-01 | The system shall protect analysis, upload, report, stream, and profile endpoints with JWT-based authentication unless explicitly public. |
| NFR-02 | The system shall enforce RBAC permissions for analysis, upload, and report access. |
| NFR-03 | The system shall allow token-in-query authentication only for stream-ingest SSE routes to support browser `EventSource` limitations. |
| NFR-04 | The system shall reject query-token authentication on non-stream routes. |
| NFR-05 | The system shall hash local passwords before storage and never return password hashes in normal API responses. |
| NFR-06 | The system shall record auditable request activity. |

### 6.2 Reliability and Fault Tolerance

| ID | Requirement |
|---|---|
| NFR-07 | The server shall fall back to file-based persistence if MongoDB is not configured or connection fails at startup. |
| NFR-08 | MongoDB connection attempts shall be retried with bounded exponential backoff during startup. |
| NFR-09 | Notification delivery shall use bounded retries and per-channel timeouts. |
| NFR-10 | Stream sessions shall persist collected data before final cleanup whenever possible. |

### 6.3 Performance and Capacity

| ID | Requirement |
|---|---|
| NFR-11 | The server shall accept JSON and URL-encoded request bodies up to 50 MB. |
| NFR-12 | The upload endpoint shall enforce a maximum of 10 files and 10 MB per file. |
| NFR-13 | The client API layer shall use a default request timeout of 30 seconds, with a longer timeout for file uploads. |
| NFR-14 | The API shall rate-limit requests to 100 requests per minute per client IP using the current in-memory limiter. |

### 6.4 Maintainability and Testability

| ID | Requirement |
|---|---|
| NFR-15 | The backend shall remain modular through factory, strategy, repository, and service-layer separation. |
| NFR-16 | Core analysis services shall support dependency injection to simplify unit and integration testing. |
| NFR-17 | The project shall maintain automated unit and integration tests for major business flows. |

### 6.5 Usability and UX

| ID | Requirement |
|---|---|
| NFR-18 | The client shall preserve login state across page reloads using locally stored JWTs until logout or token invalidation. |
| NFR-19 | The client shall show actionable error messages for common API failures such as auth failure, missing report, timeout, or backend unreachability. |
| NFR-20 | Protected routes shall redirect unauthenticated users to the login page. |

## 7. Constraints, Risks, and Current Implementation Notes

### 7.1 Constraints

- The current implementation stores uploads in memory, so extremely large evidence sets are intentionally constrained.
- Queue infrastructure files exist in the repository, but async analysis queue endpoints are not mounted in the current Express route map.
- Email delivery depends on environment-specific runtime configuration and may be unavailable in some deployments.

### 7.2 Current Implementation Notes

- Live browser streaming is implemented through SSE endpoints under `/api/stream-ingest/*`.
- Some legacy test artifacts reference removed or older interfaces such as `/api/analyze/async` or separate WebSocket manager paths; those are not part of the current primary API contract.
- The `My Data` collection-browser workflow is most complete in Mongo-backed deployments. File-backed mode supports basic user persistence but may not provide the same collection-query behavior.
- Redis is defined in repository artifacts and queue code, but it is not required for the default application startup path.

## 8. Acceptance Summary

The project shall be considered aligned with this SRS when:

1. authenticated users can analyze logs, upload evidence, and retrieve reports,
2. the system can detect and classify incidents consistently across supported formats,
3. reports and source metadata are persisted in MongoDB or file fallback mode,
4. live stream sessions can be started, monitored, stopped, and saved,
5. notification and profile-management workflows behave according to validation and RBAC rules,
6. error handling, audit logging, and user scoping behave consistently across the protected API.

