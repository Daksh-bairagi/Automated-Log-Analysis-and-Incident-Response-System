/**
 * ============================================================================
 * BLACK-BOX TEST SUITE — Analysis API Integration
 * ============================================================================
 * Full API integration tests using Supertest against the Express app.
 * Tests HTTP endpoints end-to-end without mocking internal services,
 * using a FileIncidentRepository for persistence (no MongoDB required).
 *
 * ENDPOINTS TESTED:
 *   GET  /api/health          → Health check
 *   POST /api/analyze         → Server-side log analysis
 *   POST /api/analyze/upload  → File upload analysis
 *   GET  /api/report/latest   → Retrieve latest report
 *   GET  /api/uploads         → List uploaded documents
 *
 * TEST STRATEGY:
 *   - Create the Express app with FileIncidentRepository
 *   - Use real AnalysisEngine + real log files for true integration
 *   - Verify HTTP status codes, response shapes, and data correctness
 *   - Test error conditions (invalid inputs, missing data)
 *
 * COVERAGE:
 *   ✓ Health check endpoint
 *   ✓ Full analysis with default log files
 *   ✓ Full analysis with custom logDir
 *   ✓ Upload analysis with .log files
 *   ✓ Latest report retrieval
 *   ✓ Upload listing
 *   ✓ Error handling (404, 400)
 * ============================================================================
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const FileRepository = require('../../src/repositories/FileRepository');

describe('Analysis API — Integration Tests', () => {
  let app;
  let repository;
  let createApp;
  const LOGS_DIR = path.resolve(__dirname, '../fixtures/logs');
  const OUTPUT_DIR = path.resolve(__dirname, '../test-output');
  const originalLogDir = process.env.LOG_DIR;

  beforeAll(() => {
    process.env.LOG_DIR = LOGS_DIR;
    jest.resetModules();
    createApp = require('../../src/app');

    // Use file-based repository for integration tests (no MongoDB needed)
    repository = new FileRepository(OUTPUT_DIR);

    // Create the Express app with our test repository
    app = createApp({ repository });
  });

  afterAll(() => {
    process.env.LOG_DIR = originalLogDir;

    // Clean up test output directory
    try {
      if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  // ===========================================================================
  // GET /api/health
  // ===========================================================================

  describe('GET /api/health', () => {
    test('should return 200 with server status', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('version', '1.0.0');
    });

    test('should report number of default log files', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      // Our logs/ directory has 15 log files
      expect(res.body.defaultLogFiles).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // POST /api/analyze
  // ===========================================================================

  describe('POST /api/analyze', () => {
    test('should analyze default log files and return structured result', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({})  // No params = use defaults
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('report');
      expect(res.body).toHaveProperty('view');
      expect(res.body).toHaveProperty('incidents');
      expect(res.body).toHaveProperty('logFiles');

      // Report structure verification
      const report = res.body.report;
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('processedEntries');
      expect(report).toHaveProperty('detectedIncidents');
      expect(report).toHaveProperty('severityBreakdown');
      expect(report.processedEntries).toBeGreaterThan(0);
    });

    test('should analyze files from a custom logDir', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ logDir: LOGS_DIR })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.logFiles.length).toBeGreaterThan(0);
    });

    test('should analyze specific log files', async () => {
      const logFile = path.join(LOGS_DIR, 'log-01.log');
      
      const res = await request(app)
        .post('/api/analyze')
        .send({ logFiles: [logFile] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.logFiles).toHaveLength(1);
    });

    test('should detect incidents in the analysis results', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({})
        .expect(200);

      // With 15 log files full of varied entries, we should have incidents
      expect(res.body.incidents.length).toBeGreaterThan(0);

      // Each incident should have the required fields
      const incident = res.body.incidents[0];
      expect(incident).toHaveProperty('id');
      expect(incident).toHaveProperty('severity');
      expect(incident).toHaveProperty('source');
      expect(incident).toHaveProperty('message');
      expect(incident).toHaveProperty('playbook');
      expect(incident).toHaveProperty('actions');
      expect(incident).toHaveProperty('status');
    });

    test('should include severity breakdown in the report', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({})
        .expect(200);

      const breakdown = res.body.report.severityBreakdown;
      expect(breakdown).toHaveProperty('HIGH');
      expect(breakdown).toHaveProperty('MEDIUM');
      expect(breakdown).toHaveProperty('LOW');
      expect(typeof breakdown.HIGH).toBe('number');
    });

    test('should include dashboard view model in response', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({})
        .expect(200);

      const view = res.body.view;
      expect(view).toHaveProperty('summary');
      expect(view).toHaveProperty('analyzedFiles');
    });
  });

  // ===========================================================================
  // POST /api/analyze/async
  // ===========================================================================

  describe('POST /api/analyze/async', () => {
    test('should return 503 when queue processing is not enabled', async () => {
      const res = await request(app)
        .post('/api/analyze/async')
        .send({})
        .expect(503);

      expect(res.body).toHaveProperty('error', true);
      expect(res.body.message).toContain('Queue processing is not enabled');
    });
  });

  // ===========================================================================
  // POST /api/upload
  // ===========================================================================

  describe('POST /api/upload', () => {
    test('should analyze an uploaded .log file', async () => {
      const logContent = [
        '2026-04-04 09:00:00 ERROR auth Unauthorized access attempt from 10.0.0.5',
        '2026-04-04 09:01:00 INFO system Health check passed',
        '2026-04-04 09:02:00 WARNING network Packet loss detected on eth0',
      ].join('\n');

      const res = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(logContent), 'test-upload.log')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('report');
      expect(res.body.report.processedEntries).toBe(3);
    });

    test('should handle multiple file uploads', async () => {
      const file1 = '2026-04-04 09:00:00 ERROR auth Unauthorized\n';
      const file2 = '2026-04-04 09:01:00 INFO system OK\n';

      const res = await request(app)
        .post('/api/upload')
        .attach('files', Buffer.from(file1), 'file1.log')
        .attach('files', Buffer.from(file2), 'file2.log')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.report.processedEntries).toBe(2);
    });

    test('should return 400 when no files are uploaded', async () => {
      const res = await request(app)
        .post('/api/upload')
        .expect(400);

      expect(res.body).toHaveProperty('error', true);
      expect(res.body.message).toContain('No files');
    });
  });

  // ===========================================================================
  // GET /api/reports/latest
  // ===========================================================================

  describe('GET /api/reports/latest', () => {
    test('should return the latest report after an analysis has been saved', async () => {
      // First, run an analysis to ensure there's a report saved
      await request(app)
        .post('/api/analyze')
        .send({})
        .expect(200);

      // Now fetch the latest report
      const res = await request(app)
        .get('/api/reports/latest')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('report');
      expect(res.body).toHaveProperty('view');
      expect(res.body.report).toHaveProperty('processedEntries');
    });
  });

  // ===========================================================================
  // GET /api/uploads
  // ===========================================================================

  describe('GET /api/uploads', () => {
    test('should return uploads list (empty for file-based repo)', async () => {
      const res = await request(app)
        .get('/api/upload/list')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('uploads');
      expect(Array.isArray(res.body.uploads)).toBe(true);
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('Error handling', () => {
    test('should return 404 for unknown routes', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });

    test('should handle malformed JSON body gracefully', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      // Express JSON parser should reject this with 400
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
