/**
 * ============================================================================
 * HARD EDGE SECURITY + MULTI-TENANT INTEGRATION TESTS
 * ============================================================================
 * These tests intentionally target abuse paths and edge behavior:
 *   1) Query-token auth is accepted only for stream-ingest SSE routes
 *   2) Cross-tenant report export/read access is denied
 *   3) Live stream session stop is owner-scoped (user B cannot stop user A)
 *
 * Why this suite exists:
 *   Standard happy-path tests rarely catch multi-tenant data leaks or
 *   authorization bypasses caused by transport quirks (SSE/EventSource).
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const request = require('supertest');
const createApp = require('../../src/app');
const FileRepository = require('../../src/repositories/FileRepository');

describe('Hard Edge Security / Multi-Tenant', () => {
  let app;
  let repository;
  let server;
  let baseUrl;
  let userA;
  let userB;
  let originalNodeEnv;

  const OUTPUT_DIR = path.resolve(__dirname, '../hard-edge-output');
  const FIXTURE_LOGS_DIR = path.resolve(__dirname, '../fixtures/logs');

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }

    repository = new FileRepository(OUTPUT_DIR);
    app = createApp({ repository });
    server = app.listen(0);

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;

    const registerA = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Tenant A', email: 'tenant.a@edge.test', password: 'secret123' })
      .expect(201);

    const registerB = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Tenant B', email: 'tenant.b@edge.test', password: 'secret123' })
      .expect(201);

    userA = { token: registerA.body.token, id: registerA.body.user.id };
    userB = { token: registerB.body.token, id: registerB.body.user.id };
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
    }
  });

  test('rejects query token auth on non-stream routes', async () => {
    const res = await request(app)
      .post(`/api/analyze?token=${encodeURIComponent(userA.token)}`)
      .send({});

    expect(res.status).toBe(401);
  });

  test('accepts query token auth on stream-ingest SSE route', async () => {
    const res = await request(app)
      .get(`/api/stream-ingest/demo?count=1&delay=5&token=${encodeURIComponent(userA.token)}`)
      .expect(200);

    expect(String(res.headers['content-type'] || '')).toContain('text/event-stream');
  });

  test('blocks cross-tenant report read and export by id', async () => {
    const analysisA = await request(app)
      .post('/api/analyze')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ logDir: FIXTURE_LOGS_DIR })
      .expect(200);

    const reportId = analysisA.body.reportId;
    expect(reportId).toBeTruthy();

    await request(app)
      .get(`/api/reports/${reportId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(404);

    await request(app)
      .get(`/api/reports/${reportId}/export?format=csv`)
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(404);
  });

  test('prevents user B from stopping user A live stream session', async () => {
    const session = await openDemoStream({ baseUrl, token: userA.token, count: 5000, delay: 2 });

    try {
      const forbiddenStop = await request(app)
        .delete(`/api/stream-ingest/${session.sessionId}/stop`)
        .set('Authorization', `Bearer ${userB.token}`)
        .expect(403);

      expect(forbiddenStop.body.error).toBe(true);

      const ownerStop = await request(app)
        .delete(`/api/stream-ingest/${session.sessionId}/stop`)
        .set('Authorization', `Bearer ${userA.token}`)
        .expect(200);

      expect(ownerStop.body.success).toBe(true);
    } finally {
      session.close();
    }
  });
});

/**
 * Opens a long-running demo SSE stream and resolves once we have the session id.
 * Returns a handle that allows the caller to close the client socket.
 */
function openDemoStream({ baseUrl, token, count = 5000, delay = 2 }) {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/stream-ingest/demo', baseUrl);
    url.searchParams.set('count', String(count));
    url.searchParams.set('delay', String(delay));
    url.searchParams.set('token', token);

    const req = http.get(url, (res) => {
      const sessionId = res.headers['x-session-id'];
      if (!sessionId) {
        req.destroy();
        return reject(new Error('Stream response missing x-session-id header'));
      }

      resolve({
        sessionId,
        close: () => req.destroy(),
      });
    });

    req.on('error', reject);
  });
}
