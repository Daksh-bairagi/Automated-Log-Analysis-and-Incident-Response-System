/**
 * streamIngestApi.js
 * ------------------
 * Client-side API helpers for the Stream Ingest feature.
 *
 *  openDemoSource(options)  → EventSource  (built-in demo)
 *  openUrlSource(options)   → EventSource  (external URL)
 *  stopSession(sessionId)   → Promise<void>
 */

const BASE = 'http://localhost:3001/api/stream-ingest';
const TOKEN_KEY = 'log_analyzer_token';

function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

/**
 * Open an SSE connection to the built-in demo generator.
 *
 * @param {{ count?: number, delay?: number }} options
 * @returns {EventSource}
 */
export function openDemoSource({ count = 500, delay = 30 } = {}) {
  const token = getAuthToken();
  const params = new URLSearchParams({ count: String(count), delay: String(delay) });
  if (token) params.set('token', token);
  return new EventSource(`${BASE}/demo?${params}`);
}

/**
 * Open an SSE connection that forwards an external streaming URL.
 *
 * @param {{ url: string, format?: string }} options
 * @returns {EventSource}
 */
export function openUrlSource({ url, format = 'auto' }) {
  if (!url) throw new Error('"url" is required');
  const token = getAuthToken();
  const params = new URLSearchParams({ url, format });
  if (token) params.set('token', token);
  return new EventSource(`${BASE}/start?${params}`);
}

/**
 * Abort a running session on the server side.
 *
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function stopSession(sessionId) {
  const token = getAuthToken();
  await fetch(`${BASE}/${sessionId}/stop`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
