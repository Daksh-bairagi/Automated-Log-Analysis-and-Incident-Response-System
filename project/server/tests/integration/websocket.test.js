/**
 * Integration tests for stream management routes and WebSocket event delivery.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const { WebSocket } = require('ws');
const createApp = require('../../src/app');
const FileRepository = require('../../src/repositories/FileRepository');
const WebSocketManager = require('../../src/services/realtime/WebSocketManager');
const streamEmitter = require('../../src/services/realtime/StreamEventEmitter');

describe('WebSocket + Stream API — Integration Tests', () => {
  let app;
  let server;
  let wsManager;
  let watcher;
  let baseWsUrl;
  const OUTPUT_DIR = path.resolve(__dirname, '../test-output-websocket');

  beforeAll(async () => {
    const repository = new FileRepository(OUTPUT_DIR);

    watcher = {
      _active: false,
      start() {
        if (this._active) return false;
        this._active = true;
        return true;
      },
      stop() {
        this._active = false;
      },
      getStatus() {
        return {
          active: this._active,
          watchDir: 'integration-test-watch-dir',
          trackedFiles: 0,
          stats: {},
        };
      },
    };

    app = createApp({ repository, streamEmitter, watcher });
    server = http.createServer(app);
    wsManager = new WebSocketManager(server, { heartbeatInterval: 1000 });

    app.locals.wsManager = wsManager;
    app.locals.watcher = watcher;

    await new Promise((resolve) => {
      server.listen(0, resolve);
    });

    const { port } = server.address();
    baseWsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(async () => {
    wsManager.shutdown();

    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    try {
      if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors in tests.
    }
  });

  test('GET /api/stream/status should return live websocket and watcher status', async () => {
    const res = await request(app)
      .get('/api/realtime/status')
      .expect(200);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('websocket.active', true);
    expect(res.body).toHaveProperty('watcher.active', false);
  });

  test('POST/DELETE /api/stream/watch should start and stop the watcher', async () => {
    const startRes = await request(app)
      .post('/api/realtime/watch')
      .expect(200);

    expect(startRes.body).toHaveProperty('success', true);
    expect(startRes.body).toHaveProperty('status.active', true);

    const stopRes = await request(app)
      .delete('/api/realtime/watch')
      .expect(200);

    expect(stopRes.body).toHaveProperty('success', true);
    expect(stopRes.body).toHaveProperty('status.active', false);
  });

  test('WebSocket client should receive connection and stream events', async () => {
    const ws = new WebSocket(baseWsUrl);

    const firstMessage = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for WebSocket handshake message')), 3000);

      ws.on('message', (raw) => {
        const parsed = JSON.parse(raw.toString());
        clearTimeout(timeout);
        resolve(parsed);
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    expect(firstMessage).toHaveProperty('event', 'connection:established');

    const streamEventPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for streamed log event')), 3000);

      ws.on('message', (raw) => {
        const parsed = JSON.parse(raw.toString());
        if (parsed.event === 'log:entry') {
          clearTimeout(timeout);
          resolve(parsed);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    streamEmitter.emitLogEntry({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      source: 'integration-test.log',
      message: 'WebSocket integration test event',
      severity: 'HIGH',
      file: 'integration-test.log',
      isLive: true,
    });

    const streamEvent = await streamEventPromise;

    expect(streamEvent).toHaveProperty('event', 'log:entry');
    expect(streamEvent).toHaveProperty('data.source', 'integration-test.log');

    await new Promise((resolve) => {
      ws.once('close', () => resolve());
      ws.close(1000, 'test-complete');
    });
  });
});
