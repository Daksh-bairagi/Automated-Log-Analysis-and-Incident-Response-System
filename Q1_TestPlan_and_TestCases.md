# CS 331 — Software Engineering Lab
# Assignment 9: Testing Documentation

---

## Q1(a): Test Plan — Automated Log Analysis & Incident Response System

### 1. Objective of Testing

The objective of testing the **Automated Log Analysis & Incident Response System** is to:

- Verify that all functional modules operate correctly and meet the specified requirements.
- Ensure the **Authentication Module** reliably handles user registration, login, profile management, and notification preference workflows.
- Validate that the **Log Analysis Pipeline** (ingestion → parsing → classification → detection → response) produces accurate and consistent results.
- Confirm that the **Notification System** (Email and Google Chat channels) delivers alerts correctly and handles configuration errors gracefully.
- Detect and document defects across all layers (controllers, services, middleware, models) before production deployment.
- Ensure the system handles edge cases, invalid inputs, and error conditions without crashing or producing undefined behavior.

---

### 2. Scope

#### Modules / Features to Be Tested

| # | Module | Features Covered |
|---|--------|-----------------|
| 1 | **Authentication (authController)** | User registration, login (email/password), Google OAuth, JWT token generation, profile retrieval, password hashing (bcrypt/scrypt) |
| 2 | **Notification Preferences** | Enable/disable notifications, Google Chat webhook validation, SMTP configuration, email-only vs webhook-only settings |
| 3 | **Log Parsing Pipeline** | SpaceDelimitedParser, JsonLogParser, SyslogParser, ApacheParser, GenericParser, FormatDetector, ParserFactory |
| 4 | **Severity Classification** | Rule-based classification (LOW/MEDIUM/HIGH/CRITICAL), ML integration, keyword matching |
| 5 | **Incident Detection** | Single-log detection, multi-log correlation (brute-force, cascade failure, timeout storm), threshold monitoring |
| 6 | **Response Planning** | Playbook assignment (security-containment, service-recovery, cascade-recovery, performance-remediation, manual-triage) |
| 7 | **Notification Service** | Channel routing, deduplication, escalation policy, failure handling |
| 8 | **Report Generation & Export** | Report building, PDF/CSV export |
| 9 | **REST API Endpoints** | `/api/health`, `/api/analyze`, `/api/upload`, `/api/reports`, error handling |
| 10 | **File Upload** | Multer file upload, multi-file support, empty upload validation |

#### Out of Scope
- UI/Frontend React component testing (covered under separate QA phase)
- Docker container orchestration testing
- Load / performance / stress testing
- Third-party API (Google OAuth, SMTP server) live integration

---

### 3. Types of Testing

| Type | Description | Modules Targeted |
|------|-------------|-----------------|
| **Unit Testing** | Test individual functions, classes, and modules in isolation using mocks/stubs | authController, parsers, SeverityClassifier, IncidentDetector, CorrelationEngine, ResponsePlanner, NotificationService, ReportExporter |
| **Integration Testing** | Test interactions between multiple components and the REST API layer using supertest | Analysis API endpoints, Upload API, Report API, WebSocket streaming, Security hardening |
| **Functional Testing** | Verify end-to-end user workflows (register → login → analyze → view report) | Full analysis pipeline, authentication flow |
| **Regression Testing** | Re-run all tests after bug fixes to ensure no existing functionality is broken | All modules |
| **Negative Testing** | Validate error handling for invalid inputs, missing fields, malformed data | Auth validation, file upload errors, 404 routes, malformed JSON |

---

### 4. Tools

| Tool | Purpose |
|------|---------|
| **Jest** (v30.0.0) | Test runner and assertion library for all unit and integration tests |
| **Supertest** (v7.0.0) | HTTP assertion library for testing Express REST API endpoints |
| **Node.js crypto module** | Generating test password hashes (scrypt) for auth controller tests |
| **Jest Mock Functions** | Mocking database models (userModel), services (EmailChannel, GoogleChatChannel), and dependencies |
| **Git** | Version control to track test additions and modifications |

---

### 5. Entry Criteria

- Source code for all modules is complete and committed to the repository.
- All dependencies (`jest`, `supertest`, `jsonwebtoken`, `mongodb`, etc.) are installed and resolved.
- The project builds and starts without compilation errors (`npm install` succeeds).
- Test fixtures (sample log files in `logs/` directory) are available.
- Database models and mock factories are defined and functional.
- A `.env` file with required environment variables (JWT_SECRET, MONGO_URI) is configured.

### 6. Exit Criteria

- All planned test cases have been executed.
- At least **95%** of test cases pass (critical and high-priority tests must all pass).
- All High/Critical severity defects are logged and assigned for resolution.
- Test execution results are documented with evidence (logs/screenshots).
- A defect report with bug IDs, reproduction steps, and severity levels is prepared.
- Code coverage for the Authentication module exceeds **80%**.

---
---

## Q1(b): Test Cases — Authentication Module (authController)

The following **10 test cases** cover the major functionality of the **Authentication Module** (`authController.js`), which is the largest and most critical controller in the system (688 lines, 9 exported functions).

| Test Case ID | Test Scenario / Description | Input Data | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| **TC-AUTH-001** | **Register — Valid registration creates analyst account** | `{ name: "Asha", email: "Asha@example.com", password: "secret123" }` | HTTP 201; response contains `{ success: true, token: <JWT>, user: { email: "asha@example.com", role: "analyst" } }` | HTTP 201 returned with JWT token and user object containing email `asha@example.com` and role `analyst`. `userModel.create()` called with hashed password. | **Pass** ✅ |
| **TC-AUTH-002** | **Login — Legacy viewer role is auto-upgraded to analyst** | `{ email: "legacy@example.com", password: "secret123" }` (user exists with role `viewer`) | Response contains `{ success: true, token: <JWT> }` where decoded JWT has `role: "analyst"`. `userModel.updateById` called with `{ role: "analyst" }`. | JWT decoded to `role: "analyst"`. `updateById` was called with correct upgrade payload. Response user object shows `role: "analyst"`. | **Pass** ✅ |
| **TC-AUTH-003** | **getProfile — Returns 401 when user does not exist in DB** | `req.user.id = "missing-user"` (userModel.findById returns `null`) | Error passed to `next()` with `{ code: "AUTH_REQUIRED", statusCode: 401 }`. `res.json` is NOT called. | `next()` called with error `{ code: "AUTH_REQUIRED", statusCode: 401 }`. `res.json` was not invoked. | **Pass** ✅ |
| **TC-AUTH-004** | **getProfile — Returns normalized notification preferences** | User has `notificationPreferences.email = "RINA.ALERTS@EXAMPLE.COM"` (uppercase) and a valid Google Chat webhook URL | Response includes normalized `email: "rina.alerts@example.com"` (lowercase), and `emailSmtp` block with `{ host: "smtp.gmail.com", port: 587, secure: false }` | Email normalized to lowercase. SMTP metadata returned with correct server-fixed values. Webhook URL preserved as-is. | **Pass** ✅ |
| **TC-AUTH-005** | **updateNotificationPreferences — Saves valid Google Chat webhook settings** | `{ notificationPreferences: { enabled: true, googleChatWebhookUrl: "https://chat.googleapis.com/v1/spaces/AAA/messages?key=test&token=test" } }` | `userModel.updateById` called with enabled=true, email set to registered email, webhook URL preserved. Response contains updated user. | `updateById` called correctly. Response contains `success: true` with updated notification preferences. | **Pass** ✅ |
| **TC-AUTH-006** | **updateNotificationPreferences — Ignores client-submitted SMTP overrides** | Client sends `emailSmtp: { user: "NILA@EXAMPLE.COM", password: "gmail-app-password" }` in preferences payload | Saved SMTP config uses server-fixed values (`smtp.gmail.com`, port 587), NOT the client-submitted values. `passwordEncrypted` is empty string. | Saved SMTP shows fixed server user, not client-submitted value. Password field is empty. Client cannot override server SMTP config. | **Pass** ✅ |
| **TC-AUTH-007** | **updateNotificationPreferences — Rejects when registered email is invalid** | User has `email: ""` (empty). Attempts to enable notifications without a webhook. | `next()` called with `{ code: "VALIDATION_ERROR", message: "Your registered account email is not valid for notifications." }`. `updateById` NOT called. | Validation error returned with correct message. Database not updated. | **Pass** ✅ |
| **TC-AUTH-008** | **updateNotificationPreferences — Rejects email-only when SMTP is unreachable** | SMTP runtime check returns `{ available: false, message: "Cannot reach SMTP server..." }`. User enables notifications without webhook. | `next()` called with VALIDATION_ERROR containing the SMTP unreachable message plus suggestion to add Google Chat webhook. | Validation error returned with combined message: SMTP unreachable + webhook suggestion. `updateById` NOT called. | **Pass** ✅ |
| **TC-AUTH-009** | **sendTestEmail — Sends test email when SMTP is configured** | `req.user.id = "user-7"`, user email is `test@example.com` | `EmailChannel.send()` called with incident object containing `notificationRecipientEmail: "test@example.com"`. Response: `{ success: true, message: "Test email sent to test@example.com." }` | `send()` invoked with correct recipient. Response contains success message with email address. | **Pass** ✅ |
| **TC-AUTH-010** | **sendTestEmail — Reports SMTP failure clearly** | SMTP runtime capability returns `{ available: false, message: "Cannot reach SMTP server..." }` | `next()` called with VALIDATION_ERROR containing the exact SMTP unreachable message. `res.json` is NOT called. | Validation error passed to `next()` with exact SMTP failure message. `res.json` was not invoked. | **Pass** ✅ |

---
