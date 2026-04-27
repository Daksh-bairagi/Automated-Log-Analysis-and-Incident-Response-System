/**
 * check_stream_mongo.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifies that BOTH demo and external-URL stream sessions save to MongoDB.
 *
 * Tests:
 *   1. Demo stream  (count=20, delay=10ms)
 *   2. External URL stream (httpbin.org NDJSON — short/finite response)
 *
 * Usage:  node server/check_stream_mongo.js
 * Requires: server running on localhost:3001 AND MongoDB connected.
 */

'use strict';

const http     = require('http');
const https    = require('https');
const path     = require('path');
const dotenv   = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const MONGO_URI   = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME     = process.env.DB_NAME   || 'log_analyzer';
const SERVER_PORT = parseInt(process.env.PORT, 10) || 3001;

// ─── Colours ──────────────────────────────────────────────────────────────────
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', B = '\x1b[1m', X = '\x1b[0m';
const ok   = (m) => console.log(`  ${G}✓${X} ${m}`);
const fail = (m) => console.log(`  ${R}✗${X} ${m}`);
const info = (m) => console.log(`  ${C}→${X} ${m}`);
const warn = (m) => console.log(`  ${Y}!${X} ${m}`);
const head = (m) => console.log(`\n${B}${m}${X}`);

// ─── MongoDB helpers ──────────────────────────────────────────────────────────

async function getCounts(db) {
  const [reports, logEntries, incidents] = await Promise.all([
    db.collection('reports').countDocuments(),
    db.collection('log_entries').countDocuments(),
    db.collection('incidents').countDocuments(),
  ]);
  return { reports, logEntries, incidents };
}

async function getLatestStreamReport(db, sessionId) {
  return db.collection('reports').findOne(
    { sessionId },
    { projection: { _id: 0, sessionId: 1, source: 1, source_type: 1,
                    processedEntries: 1, detectedIncidents: 1,
                    severityBreakdown: 1, durationMs: 1 } }
  );
}

async function getEntryCount(db, sessionId) {
  return db.collection('log_entries').countDocuments({ sessionId });
}

async function getIncidentCount(db, sessionId) {
  return db.collection('incidents').countDocuments({ sessionId });
}

// ─── SSE stream runner ────────────────────────────────────────────────────────

/**
 * Opens an SSE connection to the server and resolves when the 'done' event
 * is received or after timeoutMs.
 */
function runStream(path, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Stream timed out after ${timeoutMs / 1000}s`)),
      timeoutMs
    );

    const req = http.request(
      { hostname: 'localhost', port: SERVER_PORT, path, method: 'GET',
        headers: { Accept: 'text/event-stream' } },
      (res) => {
        if (res.statusCode !== 200) {
          clearTimeout(timer);
          return reject(new Error(`HTTP ${res.statusCode} from ${path}`));
        }

        let sessionId  = null;
        let donePayload = null;
        let buffer     = '';

        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const t = line.trim();
            if (!t || t.startsWith(':') || !t.startsWith('data:')) continue;
            try {
              const p = JSON.parse(t.slice(5).trim());
              if (p.sessionId) sessionId = p.sessionId;
              // 'done' event has totalEntries + durationMs
              if (p.totalEntries !== undefined && p.durationMs !== undefined) {
                donePayload = p;
                clearTimeout(timer);
                res.destroy();
                resolve({ sessionId, donePayload });
              }
            } catch (_) { /* skip */ }
          }
        });

        res.on('error', (e) => { clearTimeout(timer); reject(e); });
        res.on('close', () => {
          if (!donePayload) {
            clearTimeout(timer);
            // If we got the sessionId and close together, treat as done 
            if (sessionId) resolve({ sessionId, donePayload: { totalEntries: 0, durationMs: 0 } });
            else reject(new Error('SSE closed before done event'));
          }
        });
      }
    );

    req.on('error', (e) => { clearTimeout(timer); reject(e); });
    req.end();
  });
}

// ─── Single test runner ───────────────────────────────────────────────────────

async function runTest(db, label, streamPath, timeoutMs) {
  head(`▶  ${label}`);

  const before = await getCounts(db);
  info(`Before — reports: ${before.reports}, log_entries: ${before.logEntries}, incidents: ${before.incidents}`);

  info(`Starting stream: GET ${streamPath}`);
  let result;
  try {
    result = await runStream(streamPath, timeoutMs);
  } catch (err) {
    fail(`Stream failed: ${err.message}`);
    return false;
  }

  const { sessionId, donePayload } = result;
  ok(`Stream done — sessionId: ${sessionId}`);
  ok(`  totalEntries: ${donePayload.totalEntries}, totalIncidents: ${donePayload.totalIncidents}, durationMs: ${donePayload.durationMs}`);

  // Wait for async MongoDB write
  info('Waiting 2s for MongoDB writes to complete…');
  await new Promise(r => setTimeout(r, 2000));

  const after    = await getCounts(db);
  const savedEntries   = await getEntryCount(db, sessionId);
  const savedIncidents = await getIncidentCount(db, sessionId);
  const savedReport    = await getLatestStreamReport(db, sessionId);

  info(`After  — reports: ${after.reports}, log_entries: ${after.logEntries}, incidents: ${after.incidents}`);

  let passed = true;

  if (after.reports > before.reports && savedReport) {
    ok(`reports: +${after.reports - before.reports} document(s) saved ✓`);
    ok(`  source_type: ${savedReport.source_type}, processedEntries: ${savedReport.processedEntries}`);
  } else {
    fail('reports: NO new report saved ✗');
    passed = false;
  }

  if (savedEntries > 0) {
    ok(`log_entries: ${savedEntries} entry(ies) saved for this session ✓`);
  } else {
    fail(`log_entries: 0 entries saved for sessionId ${sessionId} ✗`);
    passed = false;
  }

  if (savedIncidents > 0) {
    ok(`incidents: ${savedIncidents} incident(s) saved for this session ✓`);
  } else {
    warn(`incidents: 0 for this session (ok if no HIGH/CRITICAL entries were generated)`);
  }

  if (savedReport) {
    console.log('\n  Saved report:');
    console.log(' ', JSON.stringify(savedReport, null, 2).replace(/\n/g, '\n  '));
  }

  return passed;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${B}═══════════════════════════════════════════════════════${X}`);
  console.log(`${B}  Stream Ingest → MongoDB Persistence Verification${X}`);
  console.log(`${B}═══════════════════════════════════════════════════════${X}`);

  // Connect to MongoDB
  head('MongoDB Connection');
  info(`URI: ${MONGO_URI}  DB: ${DB_NAME}`);
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    ok('MongoDB connected');
  } catch (err) {
    fail(`Cannot connect to MongoDB: ${err.message}`);
    process.exit(1);
  }
  const db = client.db(DB_NAME);

  const results = [];

  // ── Test 1: Demo stream ────────────────────────────────────────────────────
  try {
    const r = await runTest(
      db,
      'Test 1 — Demo Stream (20 entries, 10ms delay)',
      '/api/stream-ingest/demo?count=20&delay=10',
      30_000
    );
    results.push({ label: 'Demo stream', passed: r });
  } catch (e) {
    fail(`Test 1 error: ${e.message}`);
    results.push({ label: 'Demo stream', passed: false });
  }

  // ── Test 2: External URL (short public endpoint) ───────────────────────────
  // Using a local API endpoint that returns finite data so the stream ends naturally.
  // We use the server's own /api/health (plain text, finite) as a test target.
  try {
    const externalUrl = encodeURIComponent(`http://localhost:${SERVER_PORT}/api/health`);
    const r = await runTest(
      db,
      `Test 2 — External URL Stream (server /api/health as target)`,
      `/api/stream-ingest/start?url=http://localhost:${SERVER_PORT}/api/health`,
      20_000
    );
    results.push({ label: 'External URL stream', passed: r });
  } catch (e) {
    fail(`Test 2 error: ${e.message}`);
    results.push({ label: 'External URL stream', passed: false });
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  head('═══ FINAL RESULTS ═══');
  let allPassed = true;
  for (const { label, passed } of results) {
    if (passed) ok(`${label}: PASS`);
    else { fail(`${label}: FAIL`); allPassed = false; }
  }

  console.log();
  if (allPassed) {
    console.log(`${G}${B}✓ ALL TESTS PASSED — Stream Ingest data IS saving to MongoDB correctly.${X}`);
  } else {
    console.log(`${R}${B}✗ SOME TESTS FAILED — Check server terminal for [StreamIngest] error logs.${X}`);
    console.log(`${Y}  Tip: Make sure server is running and MONGO_URI is set in server/.env${X}`);
  }

  await client.close();
  console.log();
}

main().catch((err) => {
  console.error(`\x1b[31mUnexpected error:\x1b[0m`, err.message);
  process.exit(1);
});
