/**
 * Integration tests focused on upload endpoints and upload middleware behavior.
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const createApp = require('../../src/app');
const FileRepository = require('../../src/repositories/FileRepository');

describe('Upload API — Integration Tests', () => {
  let app;
  const OUTPUT_DIR = path.resolve(__dirname, '../test-output-upload');

  beforeAll(() => {
    const repository = new FileRepository(OUTPUT_DIR);
    app = createApp({ repository });
  });

  afterAll(() => {
    try {
      if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors in tests.
    }
  });

  test('POST /api/analyze/pdf should process uploaded logs via alias route', async () => {
    const logContent = [
      '2026-04-04 09:00:00 ERROR auth Unauthorized access attempt from 10.0.0.5',
      '2026-04-04 09:01:00 INFO system Health check passed',
    ].join('\n');

    const res = await request(app)
      .post('/api/upload')
      .attach('files', Buffer.from(logContent), 'alias-upload.log')
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('report');
    expect(res.body.report.processedEntries).toBe(2);
  });

  test('POST /api/analyze/upload should reject unsupported file extensions', async () => {
    const res = await request(app)
      .post('/api/upload')
      .attach('files', Buffer.from('just text'), 'bad.txt')
      .expect(400);

    expect(res.body).toHaveProperty('error', true);
    expect(res.body.message).toContain('Unsupported file type');
  });

  test('POST /api/analyze/upload should enforce maximum file count', async () => {
    const req = request(app).post('/api/upload');

    for (let i = 0; i < 11; i++) {
      req.attach('files', Buffer.from('2026-04-04 09:01:00 INFO app ok'), `f-${i}.log`);
    }

    const res = await req.expect(400);

    expect(res.body).toHaveProperty('error', true);
    expect(res.body.message).toContain('Too many files');
  });
});
