/**
 * ============================================================================
 * ALERT DEDUPLICATOR — Suppresses duplicate incident notifications
 * ============================================================================
 * Keeps a short-lived memory of recently alerted incident signatures so the
 * same signal does not spam alert channels repeatedly.
 *
 * DEDUPE STRATEGY:
 *   key = "<type|source|message-signature>"
 *   - If key was alerted within the configured TTL, treat as duplicate.
 *   - Otherwise allow alert and record key with current timestamp.
 * ============================================================================
 */

class AlertDeduplicator {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.ttlMs=600000] - How long a key stays deduped (10 min)
   */
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 10 * 60 * 1000;
    this._recent = new Map(); // key -> timestamp(ms)
  }

  /**
   * Checks whether a key is still inside the dedupe window.
   *
   * @param {string} key - Dedupe key
   * @returns {boolean} True if duplicate
   */
  isDuplicate(key) {
    this._cleanupExpired();

    const lastSentAt = this._recent.get(key);
    if (!lastSentAt) return false;

    return Date.now() - lastSentAt < this.ttlMs;
  }

  /**
   * Records a key as recently alerted.
   *
   * @param {string} key - Dedupe key
   */
  record(key) {
    this._recent.set(key, Date.now());
  }

  /**
   * Removes expired dedupe entries.
   * @private
   */
  _cleanupExpired() {
    const now = Date.now();
    for (const [key, timestamp] of this._recent.entries()) {
      if (now - timestamp >= this.ttlMs) {
        this._recent.delete(key);
      }
    }
  }
}

module.exports = AlertDeduplicator;
