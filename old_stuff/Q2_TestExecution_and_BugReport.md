# CS 331 — Software Engineering Lab
# Assignment 9: Test Execution & Defect Report

---

## Q2(a): Test Execution Results with Evidence

### Test Execution Summary

| Metric | Value |
|--------|-------|
| **Total Test Suites** | 22 |
| **Passed Suites** | 20 |
| **Failed Suites** | 2 |
| **Total Test Cases** | 205 |
| **Passed** | 204 |
| **Failed** | 1 |
| **Skipped** | 0 |
| **Execution Time** | 12.582 seconds |
| **Tool Used** | Jest v30.0.0 + Supertest v7.0.0 |
| **Command** | `npx jest --verbose --forceExit` |

---

### Detailed Test Execution Log

#### 1. Authentication Controller — Unit Tests (11/11 PASSED ✅)

**Command:** `npx jest tests/unit/authController.test.js --verbose --forceExit`
**Time:** 2.159s

```
PASS tests/unit/authController.test.js
  authController
    √ register creates a new analyst account and returns a token (63 ms)
    √ login upgrades legacy viewer role to analyst and returns jwt payload with analyst role (107 ms)
    √ getProfile returns auth error when user does not exist (1 ms)
    √ getProfile returns normalized notification preferences (3 ms)
    √ updateNotificationPreferences saves validated Google Chat settings and returns the updated user (2 ms)
    √ updateNotificationPreferences keeps fixed SMTP metadata even if SMTP input is submitted (1 ms)
    √ updateNotificationPreferences rejects invalid payloads (1 ms)
    √ updateNotificationPreferences allows email-only settings when server SMTP is configured (1 ms)
    √ updateNotificationPreferences rejects email-only settings when SMTP is unreachable at runtime (2 ms)
    √ sendTestEmail sends a message when server SMTP is configured (2 ms)
    √ sendTestEmail reports runtime SMTP reachability failures clearly (1 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Time:        2.159 s
```

**Evidence:** All 11 test cases from Q1(b) were executed and passed. The controller correctly:
- Creates hashed passwords during registration (bcrypt or scrypt fallback)
- Auto-upgrades legacy `viewer` roles to `analyst` on login
- Returns 401 errors for missing users
- Normalizes email addresses to lowercase
- Validates Google Chat webhook URLs (must be `https://chat.googleapis.com/v1/spaces/...`)
- Prevents client-side SMTP config overrides (server-fixed values enforced)
- Checks runtime SMTP reachability before allowing email-only notifications

---

#### 2. Log Parser Tests (16/16 PASSED ✅)

```
PASS tests/unit/parsers/AllParsers.test.js
  SpaceDelimitedParser
    √ parses valid space-delimited log line (27 ms)
    √ returns null for line with fewer than 5 tokens
    √ sets rawLine on result
    √ normalizes level to uppercase (4 ms)
  JsonLogParser
    √ parses valid JSON log line with "msg" field (5 ms)
    √ parses JSON log with "message" field (2 ms)
    √ returns null for non-JSON line (1 ms)
    √ attaches full object as metadata (4 ms)
  SyslogParser
    √ parses valid syslog line (5 ms)
    √ returns null for non-syslog line (1 ms)
    √ attaches metadata with host information (2 ms)
  ApacheParser
    √ parses valid Apache combined log format (7 ms)
    √ maps 4xx status to WARNING level (2 ms)
    √ maps 5xx status to ERROR level (1 ms)
    √ returns null for invalid line (2 ms)
  GenericParser
    √ returns a result object for any non-empty line (4 ms)
    √ returns null for empty or whitespace-only line (2 ms)

PASS tests/unit/parsers/ParserFactory.test.js
  ParserFactory
    √ returns SpaceDelimitedParser for "spaceDelimited" format (28 ms)
    √ returns JsonLogParser for "json" format (11 ms)
    √ returns SyslogParser for "syslog" format (1 ms)
    √ returns ApacheParser for "apache" format (3 ms)
    √ returns GenericParser for "generic" format (2 ms)
    √ returns GenericParser for unknown format (1 ms)
  FormatDetector
    √ detects json format from JSON log lines (1 ms)
    √ detects syslog format from syslog lines (4 ms)
    √ detects apache format from Apache log lines (4 ms)
    √ detects spaceDelimited format from space-delimited log lines (2 ms)
    √ returns "generic" for unrecognized format (1 ms)
    √ returns "generic" for empty lines array (1 ms)
```

---

#### 3. Severity Classifier Tests (15/15 PASSED ✅)

```
PASS tests/unit/SeverityClassifier.test.js
  SeverityClassifier
    classify()
      √ maps ERROR level to HIGH severity (22 ms)
      √ maps WARNING level to MEDIUM severity (2 ms)
      √ maps WARN (alias) level to MEDIUM severity (1 ms)
      √ maps INFO level to LOW severity (2 ms)
      √ maps DEBUG level to LOW severity (4 ms)
      √ defaults unknown level to LOW (2 ms)
      √ handles case-insensitive levels (2 ms)
      √ handles missing level gracefully (1 ms)
      √ mutates the entry by adding .severity property (4 ms)
    ML integration
      √ uses structured ML classification when enough anomaly fields are present (7 ms)
      √ falls back to rules when ML confidence is too low (3 ms)
      √ skips ML for generic logs without enough structured signal (2 ms)
      √ skips ML for partial structured payloads that do not match training shape (2 ms)
    classifyAll()
      √ returns breakdown object with counts per severity (11 ms)
      √ returns all-zero breakdown for empty array (2 ms)
      √ mutates all entries with severity (1 ms)
```

---

#### 4. Incident Detection & Correlation Tests (19/19 PASSED ✅)

```
PASS tests/unit/IncidentDetector.test.js
  IncidentDetector
    isIncident()
      √ returns true for HIGH severity entry (15 ms)
      √ returns true for entry with incident keyword "unauthorized" (3 ms)
      √ returns true for entry with keyword "timeout" (4 ms)
      √ returns true for entry with keyword "failed" (1 ms)
      √ returns true for entry with keyword "crash" (1 ms)
      √ returns false for benign LOW severity INFO entry (2 ms)
      √ returns false for normal system message (5 ms)
      √ keyword matching is case-insensitive (4 ms)
      √ handles missing message gracefully (2 ms)
    detectAll()
      √ filters and returns only incident entries (1 ms)
      √ returns empty array when no incidents detected (2 ms)
      √ returns empty array for empty input

PASS tests/unit/CorrelationEngine.test.js
  CorrelationEngine
    analyze() — brute-force rule
      √ detects brute-force attack after 5 failed logins from same source (11 ms)
      √ does not trigger before reaching the threshold (4 attempts) (2 ms)
      √ resets window after triggering brute-force (1 ms)
    analyze() — cascade failure rule
      √ detects cascade failure from 3 different ERROR sources (1 ms)
      √ does not trigger cascade from same source repeated (1 ms)
    analyze() — timeout storm rule
      √ detects service degradation after 10 timeout messages (2 ms)
    analyze() — non-matching entries
      √ returns empty array for benign INFO entry (2 ms)
```

---

#### 5. Notification Service Tests (11/11 PASSED ✅)

```
PASS tests/unit/NotificationService.test.js
  NotificationService
    notify()
      √ sends to all enabled channels and returns sent=true (30 ms)
      √ skips channels where isEnabled() is false (3 ms)
      √ skips channels where shouldTrigger() is false (1 ms)
      √ returns sent=false and reason=duplicate when deduplicator flags duplicate (2 ms)
      √ records dedup key after successful send (2 ms)
      √ uses the recipient identity in the dedupe key (3 ms)
      √ registers CRITICAL incident with escalation policy (2 ms)
      √ does not register HIGH incident with escalation policy (1 ms)
      √ marks channel result as failed when send throws (785 ms)
      √ continues sending to other channels even if one fails (769 ms)
      √ works with empty channels array (2 ms)
```

---

#### 6. Integration API Tests (15/16 — 1 FAILED ❌)

```
FAIL tests/integration/analysisApi.test.js (9.214 s)
  Analysis API — Integration Tests
    GET /api/health
      √ should return 200 with server status (290 ms)
      √ should report number of default log files (61 ms)
    POST /api/analyze
      √ should analyze default log files and return structured result (222 ms)
      √ should analyze files from a custom logDir (92 ms)
      √ should analyze specific log files (48 ms)
      √ should detect incidents in the analysis results (53 ms)
      √ should include severity breakdown in the report (66 ms)
      √ should include dashboard view model in response (52 ms)
    POST /api/analyze/async
      × should return 503 when queue processing is not enabled (45 ms)    ← FAILED
    POST /api/upload
      √ should analyze an uploaded .log file (76 ms)
      √ should handle multiple file uploads (40 ms)
      √ should return 400 when no files are uploaded (28 ms)
    GET /api/reports/latest
      √ should return the latest report after an analysis has been saved (76 ms)
    GET /api/uploads
      √ should return uploads list (empty for file-based repo) (29 ms)
    Error handling
      √ should return 404 for unknown routes (16 ms)
      √ should handle malformed JSON body gracefully (28 ms)
```

**Failure Details:**
```
● Analysis API — Integration Tests › POST /api/analyze/async ›
  should return 503 when queue processing is not enabled

    expected 503 "Service Unavailable", got 404 "Not Found"

      197 |         .post('/api/analyze/async')
      198 |         .send({})
    > 199 |         .expect(503);
          |          ^
      200 |
      201 |       expect(res.body).toHaveProperty('error', true);
      202 |       expect(res.body.message).toContain('Queue processing is not enabled');
```

---

#### 7. WebSocket Integration Tests (SUITE FAILED — Cannot Run ❌)

```
FAIL tests/integration/websocket.test.js
  ● Test suite failed to run

    Cannot find module '../../src/services/realtime/WebSocketManager'
    from 'tests/integration/websocket.test.js'

      10 | const createApp = require('../../src/app');
      11 | const FileRepository = require('../../src/repositories/FileRepository');
    > 12 | const WebSocketManager = require('../../src/services/realtime/WebSocketManager');
         |                          ^
      13 | const streamEmitter = require('../../src/services/realtime/StreamEventEmitter');
```

---

### Full Test Suite Summary

```
Test Suites: 2 failed, 20 passed, 22 total
Tests:       1 failed, 204 passed, 205 total
Snapshots:   0 total
Time:        12.582 s
```

---
---

## Q2(b): Defect (Bug) Report

### Bug #1: Stale Route Reference — Async Analysis Endpoint Removed but Test Not Updated

| Field | Details |
|-------|---------|
| **Bug ID** | BUG-001 |
| **Description** | The `POST /api/analyze/async` endpoint was removed from the application during the Redis/BullMQ infrastructure cleanup (the async queue processing feature was deprecated and the route was deleted from `routes/index.js`). However, the corresponding integration test in `analysisApi.test.js` was NOT removed or updated. The test expects a 503 "Service Unavailable" response, but now receives 404 "Not Found" because the route no longer exists. |
| **Steps to Reproduce** | 1. Navigate to the `server/` directory. <br> 2. Run `npx jest tests/integration/analysisApi.test.js --verbose`. <br> 3. Observe the test `"should return 503 when queue processing is not enabled"` fails. <br> 4. The test sends `POST /api/analyze/async` and expects HTTP 503, but gets HTTP 404. |
| **Expected Result** | Either: (a) The `/api/analyze/async` route should exist and return 503 with message `"Queue processing is not enabled"`, OR (b) The test case should be removed/updated since the feature was intentionally deprecated. |
| **Actual Result** | The route returns HTTP 404 "Not Found" (generic Express route-not-found handler), causing the test assertion `expect(503)` to fail. |
| **Severity** | **Medium** — The defect is in the test suite, not in production code. The async endpoint was intentionally removed, but the test was left behind causing CI/CD pipeline failures. No user-facing impact, but it degrades developer confidence in the test suite. |
| **Suggested Fix** | Remove the test case `"should return 503 when queue processing is not enabled"` from `tests/integration/analysisApi.test.js` (lines 193–203) since the `/api/analyze/async` route was intentionally removed during the BullMQ deprecation. Alternatively, if the endpoint should still exist as a "not supported" stub, re-add a minimal route that returns 503. |

---

### Bug #2: Missing Module — WebSocketManager Renamed/Moved Without Test Update

| Field | Details |
|-------|---------|
| **Bug ID** | BUG-002 |
| **Description** | The WebSocket integration test suite (`tests/integration/websocket.test.js`) fails to load because it imports `../../src/services/realtime/WebSocketManager`, which no longer exists at that path. The module was either renamed (e.g., to `SocketManager`) or moved to a different directory during a refactoring pass. This causes the entire test suite to fail to run — all WebSocket tests are skipped. |
| **Steps to Reproduce** | 1. Navigate to the `server/` directory. <br> 2. Run `npx jest tests/integration/websocket.test.js --verbose`. <br> 3. Observe error: `Cannot find module '../../src/services/realtime/WebSocketManager'`. <br> 4. Check `src/services/realtime/` directory to confirm the file does not exist. |
| **Expected Result** | The test suite should load successfully and all WebSocket integration tests should execute. The import path should point to the correct module location. |
| **Actual Result** | The entire test suite fails with a `MODULE_NOT_FOUND` error at line 12 of `websocket.test.js`. Zero WebSocket tests are executed. |
| **Severity** | **High** — This completely disables all WebSocket integration testing. The WebSocket/real-time streaming feature is a core capability of the system (live log monitoring), and having zero test coverage on it is a significant quality risk. Any regressions in the WebSocket layer will go undetected. |
| **Suggested Fix** | 1. Locate the current WebSocket manager module (likely `src/services/realtime/SocketManager.js` based on the README). <br> 2. Update the import in `websocket.test.js` line 12 from `WebSocketManager` to the correct module name/path. <br> 3. Verify any API changes in the renamed module and update test method calls accordingly. <br> 4. Re-run the test suite to confirm all WebSocket tests pass. |

---

### Bug #3: Unsafe Password Field Exposure in getUserData Endpoint

| Field | Details |
|-------|---------|
| **Bug ID** | BUG-003 |
| **Description** | In the `getUserData` controller method (authController.js, lines 511–568), the code destructures `{ password, ...safeUser }` from the `user` object to strip the password. However, this relies on the password being a direct enumerable property of the plain object. If the MongoDB driver returns a document where the `password` field is nested or the object is not a plain POJO (e.g., a Mongoose document or proxy), the password hash could leak into the `userData` response. Additionally, no unit test exists specifically for the `getUserData` and `getUserCollectionData` endpoints, leaving this data-exposure path entirely untested. |
| **Steps to Reproduce** | 1. Register a user with email/password via `POST /api/auth/register`. <br> 2. Obtain a valid JWT token from the registration response. <br> 3. Send `GET /api/auth/user-data` with `Authorization: Bearer <token>`. <br> 4. Inspect the response `userData` object fields. <br> 5. Verify whether the `password` hash field is absent from the response. |
| **Expected Result** | The `userData` response object should NEVER contain the `password` field (the bcrypt/scrypt hash). Only safe fields (`id`, `name`, `email`, `avatar`, `role`, `provider`, `createdAt`, `updatedAt`, `notificationPreferences`) should be present. |
| **Actual Result** | Under normal conditions with the native MongoDB driver, the destructuring works correctly and the password is stripped. However, there is no test coverage for this endpoint, so the behavior is unverified. If the database driver behavior changes or the User model is refactored, the password hash could be exposed to the client. |
| **Severity** | **High** — Potential security vulnerability. Password hash exposure, even bcrypt hashes, is a serious security concern. The lack of test coverage means this sensitive endpoint could regress silently. |
| **Suggested Fix** | 1. Add dedicated unit tests for `getUserData` and `getUserCollectionData` that explicitly verify the `password` field is absent from responses. <br> 2. Use an explicit allowlist approach instead of destructuring: `const safeFields = { id, name, email, avatar, role, provider, createdAt, updatedAt }` to guarantee only intended fields are returned. <br> 3. Add an integration test that calls `GET /api/auth/user-data` and asserts `expect(res.body.userData).not.toHaveProperty('password')`. |

---

### Defect Summary Table

| Bug ID | Description | Severity | Module | Status |
|--------|-------------|----------|--------|--------|
| BUG-001 | Stale test for removed `/api/analyze/async` route | Medium | Integration Tests / Routes | Open |
| BUG-002 | Missing `WebSocketManager` module breaks entire WebSocket test suite | High | Integration Tests / Realtime | Open |
| BUG-003 | Potential password hash exposure in `getUserData` + zero test coverage | High | authController / Security | Open |

---
