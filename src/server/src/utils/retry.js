/**
 * ============================================================================
 * RETRY — Exponential Backoff Retry Utility
 * ============================================================================
 * Retries an async function up to `retries` times with optional exponential
 * or linear backoff between attempts.
 *
 * USAGE:
 *   const retry = require('./utils/retry');
 *
 *   // Basic (3 attempts, 1s exponential backoff)
 *   const result = await retry(() => fetchData());
 *
 *   // Custom config
 *   await retry(() => db.connect(uri), { retries: 5, delayMs: 500, backoff: 'exponential' });
 *
 * OPTIONS:
 *   retries    {number}  Max number of attempts           (default: 3)
 *   delayMs    {number}  Base delay between attempts (ms) (default: 1000)
 *   backoff    {string}  'exponential' | 'linear'         (default: 'exponential')
 *   onRetry    {Function} Optional callback (err, attempt) called before each retry
 * ============================================================================
 */

/**
 * Sleeps for the specified number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async function with configurable backoff.
 *
 * @template T
 * @param {() => Promise<T>} fn - Async function to retry
 * @param {Object} [options]
 * @param {number} [options.retries=3] - Maximum number of attempts
 * @param {number} [options.delayMs=1000] - Base delay between attempts in ms
 * @param {'exponential'|'linear'} [options.backoff='exponential'] - Backoff strategy
 * @param {Function} [options.onRetry] - Called with (error, attempt) before each retry
 * @returns {Promise<T>}
 * @throws {Error} The last error after all attempts are exhausted
 */
async function retry(fn, { retries = 3, delayMs = 1000, backoff = 'exponential', onRetry } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // If this was the last attempt, break immediately (don't sleep)
      if (attempt === retries) {
        break;
      }

      // Call optional retry hook
      if (typeof onRetry === 'function') {
        onRetry(err, attempt);
      }

      // Calculate wait time based on backoff strategy
      const waitMs = backoff === 'exponential'
        ? delayMs * Math.pow(2, attempt - 1)   // 1s → 2s → 4s → …
        : delayMs;                              // flat linear delay

      await sleep(waitMs);
    }
  }

  throw lastError;
}

module.exports = retry;
