/**
 * useStreamIngest.js
 * ------------------
 * React hook that manages the entire life-cycle of a stream-ingest session:
 *   open EventSource → receive entries/incidents/metrics → close cleanly.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { openDemoSource, openUrlSource, stopSession } from '../services/streamIngestApi';

const MAX_ENTRIES        = 2000;
const METRICS_INTERVAL_MS = 1000;

function initialMetrics() {
  return {
    totalEntries:      0,
    totalIncidents:    0,
    eps:               0,
    severityBreakdown: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    elapsedMs:         0,
    epsHistory:        [],
  };
}

export default function useStreamIngest() {
  const [status,    setStatus]    = useState('idle');
  const [entries,   setEntries]   = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [metrics,   setMetrics]   = useState(initialMetrics());
  const [error,     setError]     = useState(null);
  const [sessionId, setSessionId] = useState(null);

  // All mutable state lives in refs so callbacks never go stale
  const esRef          = useRef(null);
  const sessionIdRef   = useRef(null);
  const metricsRef     = useRef(initialMetrics());
  const epsTimerRef    = useRef(null);
  const lastCountRef   = useRef(0);
  const startedAtRef   = useRef(null);
  const abortedRef     = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortedRef.current = true;
      if (epsTimerRef.current) clearInterval(epsTimerRef.current);
      if (esRef.current) esRef.current.close();
    };
  }, []);

  // ── EPS timer ────────────────────────────────────────────────────────────
  const startEpsTimer = useCallback(() => {
    if (epsTimerRef.current) clearInterval(epsTimerRef.current);
    lastCountRef.current = metricsRef.current.totalEntries;

    epsTimerRef.current = setInterval(() => {
      const m         = metricsRef.current;
      const delta     = m.totalEntries - lastCountRef.current;
      lastCountRef.current = m.totalEntries;
      const eps       = Math.round(delta / (METRICS_INTERVAL_MS / 1000));
      const elapsedMs = Date.now() - (startedAtRef.current || Date.now());
      const point     = { t: elapsedMs, eps };

      metricsRef.current = {
        ...m,
        eps,
        elapsedMs,
        epsHistory: [...m.epsHistory.slice(-59), point],
      };
      setMetrics({ ...metricsRef.current });
    }, METRICS_INTERVAL_MS);
  }, []);

  const stopEpsTimer = useCallback(() => {
    if (epsTimerRef.current) {
      clearInterval(epsTimerRef.current);
      epsTimerRef.current = null;
    }
  }, []);

  // ── EventSource listener attachment ──────────────────────────────────────
  const attachListeners = useCallback((es) => {

    // session: server confirmed session is live
    es.addEventListener('session', (e) => {
      try {
        const d = JSON.parse(e.data);
        sessionIdRef.current = d.sessionId;
        setSessionId(d.sessionId);
        setStatus('streaming');
      } catch {
        // Ignore malformed session payloads from the stream.
      }
    });

    // entry: one processed log line
    es.addEventListener('entry', (e) => {
      if (abortedRef.current) return;
      try {
        const entry = JSON.parse(e.data);
        const sev   = entry.severity || 'LOW';

        // Update mutable ref directly (no state update per entry — batched by EPS timer)
        metricsRef.current.totalEntries++;
        metricsRef.current.severityBreakdown[sev] =
          (metricsRef.current.severityBreakdown[sev] || 0) + 1;

        setEntries((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next;
        });
      } catch {
        // Ignore malformed entry payloads and keep streaming.
      }
    });

    // incident: a HIGH/CRITICAL entry raised as an incident
    es.addEventListener('incident', (e) => {
      if (abortedRef.current) return;
      try {
        const inc = JSON.parse(e.data);
        metricsRef.current.totalIncidents++;
        setIncidents((prev) => [inc, ...prev].slice(0, 200));
      } catch {
        // Ignore malformed incident payloads and keep streaming.
      }
    });

    // metrics: server-side rolling stats every 50 entries
    es.addEventListener('metrics', (e) => {
      if (abortedRef.current) return;
      try {
        const m = JSON.parse(e.data);
        metricsRef.current = {
          ...metricsRef.current,
          ...m,
          epsHistory: metricsRef.current.epsHistory, // keep local history
        };
        setMetrics({ ...metricsRef.current });
      } catch {
        // Ignore malformed metrics payloads and keep streaming.
      }
    });

    // done: stream finished
    es.addEventListener('done', (e) => {
      try {
        const d = JSON.parse(e.data);
        metricsRef.current = {
          ...metricsRef.current,
          totalEntries:   d.totalEntries   ?? metricsRef.current.totalEntries,
          totalIncidents: d.totalIncidents ?? metricsRef.current.totalIncidents,
          elapsedMs:      d.durationMs     ?? metricsRef.current.elapsedMs,
        };
        setMetrics({ ...metricsRef.current });
      } catch {
        // Ignore malformed completion payloads and fall back to local metrics.
      }
      setStatus('done');
      stopEpsTimer();
      es.close();
      esRef.current = null;
    });

    // error: SSE transport error OR server-sent error event
    es.addEventListener('error', (e) => {
      // Server-sent named error event (has JSON data)
      if (e.data) {
        try {
          const d = JSON.parse(e.data);
          setError(d.message || 'Stream error');
          setStatus('error');
          stopEpsTimer();
          return;
        } catch {
          // Ignore invalid server error payloads and use the native connection error below.
        }
      }

      // Native EventSource connection error (e.data is undefined)
      if (es.readyState === EventSource.CLOSED) {
        setStatus((s) => (s === 'streaming' || s === 'connecting') ? 'error' : s);
        setError('Connection to the server was lost. Make sure the backend is running on port 3001.');
        stopEpsTimer();
      }
    });

  }, [stopEpsTimer]);

  // ── Public: start ─────────────────────────────────────────────────────────
  const start = useCallback((cfg = {}) => {
    // Close any existing session first
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    stopEpsTimer();
    abortedRef.current = false;

    // Reset state
    setStatus('connecting');
    setEntries([]);
    setIncidents([]);
    setError(null);
    setSessionId(null);
    sessionIdRef.current  = null;
    metricsRef.current    = initialMetrics();
    startedAtRef.current  = Date.now();
    lastCountRef.current  = 0;
    setMetrics(initialMetrics());

    let es;
    try {
      if (!cfg.url || cfg.url === 'demo') {
        es = openDemoSource({ count: cfg.count ?? 500, delay: cfg.delay ?? 30 });
      } else {
        es = openUrlSource({ url: cfg.url, format: cfg.format ?? 'auto' });
      }
    } catch (err) {
      setError(err.message);
      setStatus('error');
      return;
    }

    esRef.current = es;
    attachListeners(es);
    startEpsTimer();
  }, [attachListeners, startEpsTimer, stopEpsTimer]);

  // ── Public: stop ──────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    abortedRef.current = true;
    stopEpsTimer();

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    // Show 'saving' while the server persists buffered data to MongoDB
    setStatus('saving');
    if (sessionIdRef.current) {
      try { await stopSession(sessionIdRef.current); } catch {
        // Ignore stop races when the server has already finished the session.
      }
    }

    // Give MongoDB ~2s to finish writing before marking done
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setStatus('done');
  }, [stopEpsTimer]);


  // ── Public: clear ─────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    setEntries([]);
    setIncidents([]);
    setError(null);
    metricsRef.current = initialMetrics();
    setMetrics(initialMetrics());
    setStatus((s) => (s === 'done' || s === 'error') ? 'idle' : s);
  }, []);

  // ── Public: exportCSV ─────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    setEntries((currentEntries) => {
      if (currentEntries.length === 0) return currentEntries;
      const rows = [
        ['timestamp', 'level', 'severity', 'source', 'message', 'isIncident'],
        ...currentEntries.map((e) => [
          e.timestamp ?? '',
          e.level     ?? '',
          e.severity  ?? '',
          e.source    ?? '',
          `"${(e.message || '').replace(/"/g, '""')}"`,
          e.isIncident ? 'true' : 'false',
        ]),
      ];
      const csv  = rows.map((r) => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `stream-ingest-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return currentEntries; // no change
    });
  }, []);

  return {
    status,
    entries,
    incidents,
    metrics,
    error,
    sessionId,
    start,
    stop,
    clear,
    exportCSV,
  };
}
