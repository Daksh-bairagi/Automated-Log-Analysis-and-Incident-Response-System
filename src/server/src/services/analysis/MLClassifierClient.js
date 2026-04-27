/**
 * MLClassifierClient.js
 * HTTP client for the local Python FastAPI inference service.
 *
 * - Calls POST http://localhost:5001/classify
 * - Calls POST http://localhost:5001/classify/structured
 * - Returns null on failure so SeverityClassifier falls back to rule engine
 * - Has a simple circuit-breaker: after 3 failures, waits 30 s before retrying
 */

const axios = require('axios');

class MLClassifierClient {
  /**
   * @param {Object} opts
   * @param {string} [opts.url='http://localhost:5001']
   * @param {number} [opts.timeoutMs=300]   - Hard timeout per request (ms)
   * @param {number} [opts.confidenceThreshold=0.75]
   */
  constructor({ url, timeoutMs, confidenceThreshold } = {}) {
    this.url                 = url                 || 'http://localhost:5001';
    this.timeoutMs           = timeoutMs           || 300;
    this.confidenceThreshold = confidenceThreshold || 0.75;

    // Circuit-breaker state
    this._available  = true;
    this._failCount  = 0;
    this._resetAfter = 30_000; // ms before circuit closes again
  }

  /**
   * Classify a raw log message.
   * @param {string} message - Raw log message text
   * @param {string} [level='INFO'] - Log level (ERROR, WARN, INFO, DEBUG...)
   * @returns {Promise<{label:string, confidence:number, scores:Object}|null>}
   */
  async classify(message, level = 'INFO') {
    return this._post('/classify', {
      message: String(message || ''),
      level: String(level || 'INFO'),
    });
  }

  /**
   * Classify an already-structured anomaly payload.
   * @param {Object} payload
   * @returns {Promise<{label:string, confidence:number, scores:Object}|null>}
   */
  async classifyStructured(payload = {}) {
    return this._post('/classify/structured', payload);
  }

  /** For testing â€” check if service is reachable */
  async ping() {
    try {
      const { data } = await axios.get(`${this.url}/health`, { timeout: 1000 });
      return data?.status === 'ok';
    } catch {
      return false;
    }
  }

  async _post(path, payload) {
    if (!this._available) return null; // circuit open â€” skip

    try {
      const { data } = await axios.post(`${this.url}${path}`, payload, {
        timeout: this.timeoutMs,
      });

      // Reset fail counter on success
      this._failCount = 0;
      this._available = true;
      return data; // { label, confidence, scores }
    } catch (err) {
      this._failCount += 1;

      if (this._failCount >= 3) {
        this._available = false;
        console.warn(
          `[MLClassifierClient] Service unreachable â€” circuit open for ${this._resetAfter / 1000}s`
        );
        setTimeout(() => {
          this._available = true;
          this._failCount = 0;
          console.info('[MLClassifierClient] Circuit closed â€” retrying ML service');
        }, this._resetAfter);
      }

      return null; // triggers rule-based fallback
    }
  }
}

module.exports = MLClassifierClient;
