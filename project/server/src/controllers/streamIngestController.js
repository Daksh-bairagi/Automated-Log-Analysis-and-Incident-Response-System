/**
 * ============================================================================
 * STREAM INGEST CONTROLLER — v3
 * ============================================================================
 * Supports:
 *   • Built-in demo generator (synthetic log lines)
 *   • Real-URL streaming of:
 *       – Plain NDJSON / plain-text log lines
 *       – Server-Sent Events (SSE) — e.g. Wikimedia EventStreams
 *         The controller detects SSE format, accumulates multi-line events,
 *         strips the "data: " prefix, and parses the JSON payload.
 *
 * SSE EVENTS EMITTED TO BROWSER:
 *   event: entry     — { timestamp, level, severity, source, message, isIncident }
 *   event: incident  — { id, severity, message, source, timestamp }
 *   event: metrics   — { totalEntries, eps, severityBreakdown, elapsedMs }
 *   event: error     — { message }
 *   event: done      — { totalEntries, totalIncidents, durationMs }
 *
 * PERSISTENCE (MongoDB):
 *   When a streaming session ends (done / stop / disconnect), ALL collected
 *   log entries, incidents, and a session-level report are flushed to MongoDB
 *   via the injected repository — matching the same schema used by file uploads.
 *   Pass `repository` when calling createDemoController / createStartController.
 * ============================================================================
 */

const { randomUUID } = require('crypto');
const http  = require('http');
const https = require('https');
const SeverityClassifier = require('../services/analysis/SeverityClassifier');
const { resolveRequestNotificationContext } = require('../utils/requestNotificationContext');

// Active sessions — Map<sessionId, { abort: () => void, ownerId: string|null }>
const sessions = new Map();
const SEVERITY_RANK = Object.freeze({
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
});

// ─── SSE helpers ─────────────────────────────────────────────────────────────

/** Write one SSE frame to the browser and flush immediately */
function sseEvent(res, eventName, payload) {
  if (res.writableEnded) return;
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

function setSseHeaders(res, sessionId) {
  res.setHeader('Content-Type',                'text/event-stream');
  res.setHeader('Cache-Control',               'no-cache');
  res.setHeader('Connection',                  'keep-alive');
  res.setHeader('X-Accel-Buffering',           'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Session-Id',                sessionId);
  res.flushHeaders();
  // Initial comment to push headers to client immediately
  res.write(':ok\n\n');
  if (typeof res.flush === 'function') res.flush();
}

// ─── Severity classification ──────────────────────────────────────────────────

/**
 * Classify an entry's severity.
 * Works on structured log entries AND on Wikimedia/generic JSON events.
 */
function classifySeverityHeuristic(entry) {
  const level = (entry.level || '').toUpperCase();
  const msg   = (entry.message || '').toUpperCase();
  const raw   = entry._raw || {};  // original parsed JSON if available

  // ── 1. Explicit log level ──
  if (['CRITICAL','FATAL','EMERGENCY','EMERG'].includes(level)) return 'CRITICAL';
  if (['ERROR','ERR','CRIT','ALERT']          .includes(level)) return 'HIGH';
  if (['WARN','WARNING']                      .includes(level)) return 'MEDIUM';

  // ── 2. Wikimedia-specific fields ──
  if (raw.log_type) {
    if (['block','abusefilter','suppress'].includes(raw.log_type))  return 'CRITICAL';
    if (['delete','merge','move_redir']   .includes(raw.log_type))  return 'HIGH';
    if (['protect','rights','upload']     .includes(raw.log_type))  return 'MEDIUM';
  }
  if (raw.type === 'new' && !raw.bot) return 'MEDIUM'; // human new-page creation
  if (raw.type === 'categorize')      return 'LOW';

  // Large edits (≥ 5 kB change)
  if (raw.length && typeof raw.length.old === 'number' && typeof raw.length.new === 'number') {
    const delta = Math.abs(raw.length.new - raw.length.old);
    if (delta >= 5000 && !raw.bot) return 'HIGH';
    if (delta >= 1000 && !raw.bot) return 'MEDIUM';
  }

  // ── 3. Message keyword scan ──
  if (/\bCRITICAL\b|\bFATAL\b|\bEMERGENCY\b/.test(msg))             return 'CRITICAL';
  if (/\bERROR\b|\bFAILED?\b|\bTLS\b|\bOOM\b|\bDOWN\b/.test(msg))   return 'HIGH';
  if (/\bWARN\b|\bWARNING\b|\bATTEMPT\b|\bUSAGE\b/.test(msg))       return 'MEDIUM';

  return 'LOW';
}

function buildClassifierEntry(entry) {
  const raw = entry?._raw && typeof entry._raw === 'object' ? entry._raw : {};
  return {
    timestamp: entry?.timestamp || new Date().toISOString(),
    level: entry?.level || 'INFO',
    source: entry?.source || 'stream',
    message: entry?.message || '',
    metadata: raw,
  };
}

function chooseStrongerSeverity(left, right) {
  const leftSeverity = String(left || 'LOW').toUpperCase();
  const rightSeverity = String(right || 'LOW').toUpperCase();
  return (SEVERITY_RANK[leftSeverity] || 0) >= (SEVERITY_RANK[rightSeverity] || 0)
    ? leftSeverity
    : rightSeverity;
}

async function classifySeverity(entry, state) {
  const heuristicSeverity = classifySeverityHeuristic(entry);
  const classifier = state?.classifier;

  if (!classifier || typeof classifier.classify !== 'function') {
    return { severity: heuristicSeverity, classifiedBy: 'stream-heuristics' };
  }

  const classifierEntry = buildClassifierEntry(entry);
  const sharedSeverity = await classifier.classify(classifierEntry);

  if (classifierEntry.classifiedBy === 'ml') {
    return {
      severity: classifierEntry.severity,
      classifiedBy: 'ml',
      mlConfidence: classifierEntry.mlConfidence,
      mlScores: classifierEntry.mlScores || {},
    };
  }

  const finalSeverity = chooseStrongerSeverity(heuristicSeverity, sharedSeverity);
  return {
    severity: finalSeverity,
    classifiedBy: finalSeverity === heuristicSeverity
      ? 'stream-heuristics'
      : (classifierEntry.classifiedBy || 'rules'),
  };
}

function isIncident(severity) {
  return severity === 'CRITICAL' || severity === 'HIGH';
}

// ─── Metrics tracking ─────────────────────────────────────────────────────────

function makeState(options = {}) {
  return {
    totalEntries:       0,
    totalIncidents:     0,
    severityBreakdown:  {},
    startedAt:          Date.now(),
    bufferedEntries:    [],   // flushed to log_entries on session end
    bufferedIncidents:  [],   // flushed to incidents on session end
    classifier:         new SeverityClassifier(),
    notificationService: options.notificationService || null,
    notificationRecipientEmail: options.notificationRecipientEmail || null,
    notificationPreferences: options.notificationPreferences || null,
  };
}

function notifyIncidentIfConfigured(state, incidentRecord) {
  if (!state?.notificationService || typeof state.notificationService.notify !== 'function') {
    return;
  }

  void state.notificationService.notify({
    ...incidentRecord,
    type: incidentRecord.type || 'stream-incident',
    playbook: incidentRecord.playbook || 'live-stream-triage',
    notificationRecipientEmail: state.notificationRecipientEmail || null,
    notificationPreferences: state.notificationPreferences || null,
    analysisType: 'stream',
  }).catch((error) => {
    console.warn(`[StreamIngest] notification failed for ${incidentRecord.id}: ${error.message}`);
  });
}

function trackEntry(state, severity) {
  state.totalEntries++;
  state.severityBreakdown[severity] = (state.severityBreakdown[severity] || 0) + 1;
}

function emitMetrics(res, state) {
  const elapsedMs = Date.now() - state.startedAt;
  const eps = elapsedMs > 0 ? Math.round((state.totalEntries / elapsedMs) * 1000) : 0;
  sseEvent(res, 'metrics', { totalEntries: state.totalEntries, eps, severityBreakdown: state.severityBreakdown, elapsedMs });
}

// ─── Entry emitter — common path for both demo and URL streams ─────────────

/**
 * Emit a single parsed entry to the browser via SSE.
 * Also buffers the entry and any incident into `state.bufferedEntries` /
 * `state.bufferedIncidents` so they can be flushed to MongoDB at session end.
 */
async function emitEntry(res, state, sessionId, { timestamp, level, source, message, rawJson }) {
  const entry = {
    timestamp: timestamp || new Date().toISOString(),
    level:     level    || 'INFO',
    source:    source   || 'stream',
    message:   message  || '',
    _raw:      rawJson  || {},
  };

  const classification = await classifySeverity(entry, state);
  const severity  = classification.severity;
  const incident  = isIncident(severity);

  const structured = {
    timestamp: entry.timestamp,
    level: entry.level,
    severity,
    source: entry.source,
    message: entry.message,
    isIncident: incident,
    classifiedBy: classification.classifiedBy,
    ...(classification.mlConfidence !== undefined ? { mlConfidence: classification.mlConfidence } : {}),
  };
  sseEvent(res, 'entry', structured);
  trackEntry(state, severity);

  // ── Buffer for later MongoDB persistence ──
  state.bufferedEntries.push({
    timestamp:  entry.timestamp,
    level:      entry.level,
    severity,
    source:     entry.source,
    message:    entry.message,
    rawLine:    entry.message,  // mirrors LogEntry schema
    classifiedBy: classification.classifiedBy,
    ...(classification.mlConfidence !== undefined ? { mlConfidence: classification.mlConfidence } : {}),
    ...(classification.mlScores ? { mlScores: classification.mlScores } : {}),
    sessionId,
    source_type: 'stream',
  });

  if (incident) {
    state.totalIncidents++;
    const incidentRecord = {
      id:         `INC-${sessionId.slice(0, 6)}-${state.totalIncidents}`,
      severity,
      type:       'stream-incident',
      message:    entry.message,
      source:     entry.source,
      timestamp:  entry.timestamp,
      playbook:   'live-stream-triage',
      sessionId,
      source_type: 'stream',
    };
    sseEvent(res, 'incident', incidentRecord);
    state.bufferedIncidents.push(incidentRecord);
    notifyIncidentIfConfigured(state, incidentRecord);
  }

  if (state.totalEntries % 50 === 0) emitMetrics(res, state);
}

// ─── SSE / NDJSON line processor (for real-URL streams) ──────────────────────

/**
 * Detect whether the stream is SSE-formatted.
 * Returns true if any of the first lines starts with "event:", "data:", or ":"
 */
function detectSseFormat(line) {
  return /^(event:|data:|id:|retry:|\s*:)/.test(line.trim());
}

/**
 * Convert a Wikimedia (or any generic JSON) event to a log-like entry.
 */
function jsonEventToEntry(json) {
  // ── Wikimedia recentchange ──
  if (json.type && json.wiki) {
    const wiki   = (json.server_name || json.wiki || 'wikimedia').replace(/\.org$/, '');
    const user   = json.user   || 'unknown';
    const title  = json.title  || '';
    const bot    = json.bot    ? '[BOT] ' : '';
    const type   = json.type;
    const logType = json.log_type || '';

    let level   = 'INFO';
    let message = '';

    if (logType === 'block')       { level = 'CRITICAL'; message = `${bot}User blocked — "${user}" | wiki: ${wiki}`; }
    else if (logType === 'delete') { level = 'ERROR';    message = `${bot}Page deleted — "${title}" by ${user} | ${wiki}`; }
    else if (logType === 'abusefilter') { level = 'CRITICAL'; message = `${bot}Abuse filter triggered on "${title}" by ${user} | ${wiki}`; }
    else if (logType === 'protect') { level = 'WARN';   message = `${bot}Page protected — "${title}" by ${user} | ${wiki}`; }
    else if (logType === 'rights')  { level = 'WARN';   message = `${bot}User rights changed — "${user}" | ${wiki}`; }
    else if (logType === 'upload')  { level = 'INFO';   message = `${bot}File uploaded — "${title}" by ${user} | ${wiki}`; }
    else if (type === 'new') {
      const sizeNew = json.length?.new || 0;
      level   = bot ? 'INFO' : 'WARN';
      message = `${bot}New page created — "${title}" (${sizeNew} bytes) by ${user} | ${wiki}`;
    } else if (type === 'edit') {
      const delta   = json.length ? (json.length.new - json.length.old) : 0;
      const sign    = delta >= 0 ? '+' : '';
      const comment = (json.comment || '').slice(0, 80) || '(no summary)';
      level   = (Math.abs(delta) >= 5000 && !json.bot) ? 'WARN' : 'INFO';
      message = `${bot}Edit: "${title}" (${sign}${delta}B) by ${user} — ${comment} | ${wiki}`;
    } else if (type === 'log') {
      message = `${bot}Log entry [${logType}] on "${title}" by ${user} | ${wiki}`;
    } else if (type === 'categorize') {
      message = `${bot}Categorized: "${title}" | ${wiki}`;
      level   = 'INFO';
    } else {
      message = `${bot}Event [${type}] "${title}" by ${user} | ${wiki}`;
    }

    return {
      timestamp: json.meta?.dt || new Date().toISOString(),
      level,
      source:    wiki,
      message,
      rawJson:   json,
    };
  }

  // ── Generic JSON event — extract common fields ──
  const timestamp = json.timestamp || json.time || json.ts || json.datetime || new Date().toISOString();
  const level     = json.level || json.severity || json.log_level || json.priority || 'INFO';
  const source    = json.host || json.source || json.service || json.app || json.logger || 'stream';
  const message   = json.message || json.msg || json.text || json.log || JSON.stringify(json).slice(0, 200);

  return { timestamp, level, source, message, rawJson: json };
}

/**
 * Process a single text line from the upstream HTTP response.
 * Handles plain text, NDJSON, and SSE data lines.
 *
 * @param {string}  line       Raw text line (may have "data: " prefix)
 * @param {object}  state      Mutable metrics state
 * @param {string}  sessionId
 * @param {object}  res        Express response (SSE)
 * @param {boolean} isSse      Whether the stream is SSE-formatted
 */
async function processRawLine(line, state, sessionId, res, isSse) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(':')) return; // empty or SSE comment

  let payload = trimmed;

  // Strip SSE field prefix — we only care about "data:" lines
  if (isSse) {
    if (/^(event:|id:|retry:)/.test(trimmed)) return; // skip non-data SSE fields
    if (trimmed.startsWith('data:')) {
      payload = trimmed.slice(5).trimStart();
    } else {
      return;
    }
  }

  if (!payload) return;

  // Try to parse as JSON
  let entry;
  if (payload.startsWith('{') || payload.startsWith('[')) {
    try {
      const json = JSON.parse(payload);
      entry = jsonEventToEntry(Array.isArray(json) ? json[0] : json);
    } catch (_) {
      // Not valid JSON — treat as plain text
      entry = { timestamp: new Date().toISOString(), level: 'INFO', source: 'stream', message: payload };
    }
  } else {
    // Plain text log line — simple field extraction
    const ts  = payload.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)?.[0] || new Date().toISOString();
    const lvl = payload.match(/\b(CRITICAL|FATAL|ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\b/i)?.[1]?.toUpperCase() || 'INFO';
    const src = payload.match(/\[([^\]]{1,30})\]/)?.[1] || 'stream';
    entry = { timestamp: ts, level: lvl, source: src, message: payload };
  }

  await emitEntry(res, state, sessionId, entry);
}

// ─── DEMO GENERATOR ──────────────────────────────────────────────────────────

const DEMO_SOURCES  = ['nginx', 'auth', 'kernel', 'sshd', 'cron', 'app'];
const DEMO_LEVELS   = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
const DEMO_MESSAGES = [
  'Connection established from 192.168.1.{n}',
  'User login successful: admin@192.168.{n}.1',
  'Health check OK — latency {n}ms',
  'Disk usage at {n}% — approaching threshold',
  'Failed authentication attempt from 10.0.0.{n} (attempt {n})',
  'CRITICAL: Root process terminated unexpectedly — PID {n}',
  'GET /api/data HTTP/1.1 200 {n}ms',
  'Scheduled job completed: backup_{n}',
  'TLS handshake failed — certificate expired',
  'OOM killer invoked on process {n}',
];

function createDemoController(repository, notificationService) {
  return function demoStream(req, res) {
    const ownerId = req.user?.id || null;
    const notificationContext = resolveRequestNotificationContext(req.user);
    const sessionId = randomUUID();
    const count     = Math.min(parseInt(req.query.count || '500', 10), 5000);
    const delayMs   = Math.max(parseInt(req.query.delay || '30',  10), 5);

    setSseHeaders(res, sessionId);
    sseEvent(res, 'session', { sessionId, mode: 'demo', count, delayMs });

    const state     = makeState({
      notificationService,
      ...notificationContext,
    });
    let   sent      = 0;
    let   timer     = null;
    let   aborted   = false;
    let   persisting = false; // true while MongoDB write is in progress
    let   persisted = false;  // guard against duplicate persistence

    // sendNext drives the generator loop
    async function sendNext() {
      if (aborted || res.writableEnded) { doCleanup(); return; }
      if (sent >= count) {
        // Fire-and-forget — but guard cleanup until persist is done
        finish().catch((err) => console.error('[StreamIngest] finish error:', err.message));
        return;
      }

      const n   = Math.floor(Math.random() * 255);
      const msg = DEMO_MESSAGES[Math.floor(Math.random() * DEMO_MESSAGES.length)].replace(/\{n\}/g, String(n));
      const lvl = DEMO_LEVELS  [Math.floor(Math.random() * DEMO_LEVELS.length)];
      const src = DEMO_SOURCES [Math.floor(Math.random() * DEMO_SOURCES.length)];

      await emitEntry(res, state, sessionId, {
        timestamp: new Date().toISOString(),
        level:     lvl,
        source:    src,
        message:   msg,
      });

      sent++;
      timer = setTimeout(() => {
        sendNext().catch((err) => console.error('[StreamIngest] demo entry error:', err.message));
      }, delayMs);
    }

    async function finish() {
      persisting = true;
      if (timer) clearTimeout(timer);

      emitMetrics(res, state);
      const durationMs = Date.now() - state.startedAt;
      sseEvent(res, 'done', { totalEntries: state.totalEntries, totalIncidents: state.totalIncidents, durationMs });

      // ── Persist ALL buffered data to MongoDB before closing ──
      if (!persisted) {
        await persistStreamSession(repository, sessionId, 'demo', state, durationMs, ownerId);
        persisted = true;
      }
      persisting = false;
      doCleanup();
    }

    function doCleanup() {
      if (persisting) return; // do NOT close while MongoDB write is active
      if (timer) clearTimeout(timer);
      sessions.delete(sessionId);
      if (!res.writableEnded) res.end();
    }

    // abort() is called by stopStream controller OR on client disconnect.
    // It must persist whatever was buffered before cleaning up.
    const abortWithPersist = async () => {
      if (aborted) return;
      aborted = true;
      if (timer) clearTimeout(timer);
      if (!persisting && !persisted && state.totalEntries > 0) {
        persisting = true;
        const durationMs = Date.now() - state.startedAt;
        // Send 'done' event so the browser UI updates
        sseEvent(res, 'done', { totalEntries: state.totalEntries, totalIncidents: state.totalIncidents, durationMs });
        await persistStreamSession(repository, sessionId, 'demo', state, durationMs, ownerId);
        persisted = true;
        persisting = false;
      }
      doCleanup();
    };

    sessions.set(sessionId, { abort: abortWithPersist, ownerId });
    req.on('close', () => { if (!persisting) abortWithPersist().catch(() => {}); });
    sendNext().catch((err) => console.error('[StreamIngest] demo stream error:', err.message));
  };
}

// ─── REAL-URL STREAM ──────────────────────────────────────────────────────────

function createStartController(repository, notificationService) {
  return async function startStream(req, res) {
    const ownerId = req.user?.id || null;
    const notificationContext = resolveRequestNotificationContext(req.user);
    const { url, format = 'auto' } = req.query;
    if (!url) return res.status(400).json({ error: true, message: 'Query param "url" is required' });

    let parsedUrl;
    try { parsedUrl = new URL(url); }
    catch (_) { return res.status(400).json({ error: true, message: 'Invalid URL' }); }

    const sessionId  = randomUUID();
    setSseHeaders(res, sessionId);
    sseEvent(res, 'session', { sessionId, mode: 'url', url });

    const state     = makeState({
      notificationService,
      ...notificationContext,
    });
    let   buffer    = '';
    let   isSse     = format === 'sse' ? true : (format === 'auto' ? null : false);
    let   aborted   = false;
    let   persisting = false; // guard: do NOT close while MongoDB write is active
    let   persisted = false;  // guard against duplicate persistence
    let   processing = Promise.resolve();

    const driver = parsedUrl.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'GET',
      headers: {
        'Accept':        'text/event-stream, application/x-ndjson, text/plain, */*',
        'User-Agent':    'LogAnalyzer/2.0',
        'Cache-Control': 'no-cache',
      },
    };

    const upstream = driver.request(reqOptions, (upRes) => {
      const ct = upRes.headers['content-type'] || '';
      if (isSse === null && ct.includes('text/event-stream')) isSse = true;

      upRes.setEncoding('utf8');

      upRes.on('data', (chunk) => {
        if (aborted || res.writableEnded) return;
        processing = processing.then(async () => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (isSse === null && line.trim()) isSse = detectSseFormat(line);
            await processRawLine(line, state, sessionId, res, isSse === true);
          }
        }).catch((err) => {
          sseEvent(res, 'error', { message: err.message });
        });
      });

      upRes.on('end', async () => {
        await processing;
        if (buffer.trim()) await processRawLine(buffer, state, sessionId, res, isSse === true);
        emitMetrics(res, state);
        const durationMs = Date.now() - state.startedAt;
        sseEvent(res, 'done', { totalEntries: state.totalEntries, totalIncidents: state.totalIncidents, durationMs });

        // ── Persist ALL buffered data to MongoDB BEFORE closing ──
        persisting = true;
        if (!persisted) {
          await persistStreamSession(repository, sessionId, url, state, durationMs, ownerId);
          persisted = true;
        }
        persisting = false;
        doCleanup();
      });

      upRes.on('error', (err) => {
        sseEvent(res, 'error', { message: err.message });
        doCleanup();
      });
    });

    upstream.on('error', (err) => {
      sseEvent(res, 'error', { message: `Failed to connect to upstream: ${err.message}` });
      doCleanup();
    });

    upstream.end();

    function doCleanup() {
      if (persisting) return; // wait for MongoDB write to complete
      sessions.delete(sessionId);
      if (!res.writableEnded) res.end();
    }

    // abort() is called by stopStream controller OR on client disconnect.
    // For infinite streams (Wikimedia etc.) this is the ONLY way data gets saved.
    const abortWithPersist = async () => {
      if (aborted) return;
      aborted = true;
      upstream.destroy();
      if (!persisting && !persisted && state.totalEntries > 0) {
        persisting = true;
        const durationMs = Date.now() - state.startedAt;
        // Notify browser the stream is done
        sseEvent(res, 'done', { totalEntries: state.totalEntries, totalIncidents: state.totalIncidents, durationMs });
        await persistStreamSession(repository, sessionId, url, state, durationMs, ownerId);
        persisted = true;
        persisting = false;
      }
      doCleanup();
    };

    sessions.set(sessionId, { abort: abortWithPersist, ownerId });

    // Client closes tab / navigates away → persist whatever was collected
    req.on('close', () => {
      if (!aborted && !persisting) abortWithPersist().catch(() => {});
    });
  };
}

// ─── PERSIST STREAM SESSION TO MONGODB ───────────────────────────────────────

/**
 * Flush all buffered entries, incidents, and a session-level report to MongoDB.
 * Called once per session after streaming ends (done / stop / disconnect).
 * Silently no-ops if no repository is configured.
 *
 * @param {Object|null} repository       - MongoRepository (or FileRepository) instance
 * @param {string}      sessionId        - UUID for the session
 * @param {string}      source           - URL or 'demo'
 * @param {object}      state            - Session state (totalEntries, severityBreakdown, etc.)
 * @param {number}      durationMs       - Total session duration in ms
 */
async function persistStreamSession(repository, sessionId, source, state, durationMs, ownerId = null) {
  if (!repository || typeof repository.saveReport !== 'function') return;

  try {
    const isDemo      = source === 'demo';
    const displayName = isDemo ? 'Demo Stream' : source;
    const eps         = durationMs > 0 ? Math.round((state.totalEntries / durationMs) * 1000) : 0;

    const report = {
      generatedAt:        new Date().toISOString(),
      source_type:        'stream',
      sessionId,
      source,
      processedEntries:   state.totalEntries,
      detectedIncidents:  state.totalIncidents,
      severityBreakdown:  state.severityBreakdown,
      durationMs,
      incidentsByType:    {},
      logFiles:           [],
      parseErrors:        0,
      formatDistribution: {},
      metrics:            { eps },
    };

    // ── 1. Save report + log_entries + incidents ──
    const { reportId } = await repository.saveReport(report, {
      entries:   state.bufferedEntries,
      incidents: state.bufferedIncidents,
      ownerId,
    });

    // ── 2. Save source_documents record (same as file uploads do) ──
    if (typeof repository.saveSourceDocument === 'function') {
      try {
        await repository.saveSourceDocument({
          reportId,
          sessionId,
          ownerId,
          source_type:      'stream',
          originalName:     displayName,
          mimeType:         isDemo ? 'application/x-demo-stream' : 'text/event-stream',
          fileSizeBytes:    0,           // streams have no file size
          extractedLines:   state.totalEntries,
          durationMs,
          eps,
          detectedIncidents: state.totalIncidents,
          severityBreakdown: state.severityBreakdown,
          streamUrl:        isDemo ? null : source,
        });
      } catch (docErr) {
        console.warn(`[StreamIngest] source_documents save failed: ${docErr.message}`);
      }
    }

    console.log(
      `[StreamIngest] ✅ Session ${sessionId} saved — ` +
      `${state.totalEntries} entries, ${state.totalIncidents} incidents → reports + log_entries + incidents + source_documents`
    );
  } catch (err) {
    console.error(`[StreamIngest] Failed to persist session ${sessionId}:`, err.message);
  }
}

// ─── STOP ─────────────────────────────────────────────────────────────────────

function createStopController() {
  // abort() is now async (it waits for MongoDB persist).
  // We still respond immediately so the UI doesn't hang — persist runs in background.
  return function stopStream(req, res) {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: true, message: 'Session not found' });
    if (session.ownerId && session.ownerId !== req.user?.id) {
      return res.status(403).json({ error: true, message: 'You do not have access to this session' });
    }
    // Respond immediately, let persist finish in background
    res.json({ success: true, message: `Session ${req.params.sessionId} stopped — saving to MongoDB…` });
    session.abort().catch((err) => console.error('[StreamIngest] stop+persist error:', err.message));
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Factory — call with the shared repository instance from app.js.
 * The returned object is mounted by streamIngestRoutes.
 *
 * @param {Object|null} repository - Mongo/File repository (optional)
 */
function createStreamIngestControllers(options = {}) {
  const repository = options.repository || null;
  const notificationService = options.notificationService || null;
  return {
    demoStream:  createDemoController(repository, notificationService),
    startStream: createStartController(repository, notificationService),
    stopStream:  createStopController(),
  };
}

module.exports = createStreamIngestControllers;
module.exports._private = {
  classifySeverityHeuristic,
  buildClassifierEntry,
  chooseStrongerSeverity,
  classifySeverity,
};
