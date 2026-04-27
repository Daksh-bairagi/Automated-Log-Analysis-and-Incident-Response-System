/**
 * Tracks pending critical incidents for time-based escalation follow-up.
 */
class EscalationPolicy {
  constructor(options = {}) {
    this.delayMs = options.delayMs || 5 * 60 * 1000;
    this.maxLevels = options.maxLevels || 3;
    this._queue = new Map();
  }

  register(incident) {
    const incidentId = incident.id || null;
    const key = incidentId || `${incident.type || 'unknown'}:${incident.source || 'unknown'}`;
    const now = Date.now();
    const existing = this._queue.get(key);

    if (existing && existing.status !== 'resolved') {
      return { ...existing };
    }

    const entry = {
      key,
      incidentId,
      severity: incident.severity || 'UNKNOWN',
      type: incident.type || 'unknown',
      source: incident.source || 'unknown',
      message: incident.message || '',
      registeredAt: new Date(now).toISOString(),
      dueAt: new Date(now + this.delayMs).toISOString(),
      escalationLevel: 1,
      status: 'pending',
    };

    this._queue.set(key, entry);
    return { ...entry };
  }

  getPending() {
    return [...this._queue.values()]
      .filter((entry) => entry.status === 'pending')
      .map((entry) => ({ ...entry }));
  }

  getDue(referenceTime = Date.now()) {
    return this.getPending().filter((entry) => Date.parse(entry.dueAt) <= referenceTime);
  }

  markEscalated(incidentIdOrKey) {
    const key = this._findKey(incidentIdOrKey);
    if (!key) return null;

    const entry = this._queue.get(key);
    if (!entry || entry.status === 'resolved') {
      return null;
    }

    const nextLevel = Math.min(entry.escalationLevel + 1, this.maxLevels);
    const updated = {
      ...entry,
      escalationLevel: nextLevel,
      escalatedAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + this.delayMs).toISOString(),
      status: nextLevel >= this.maxLevels ? 'maxed' : 'pending',
    };

    this._queue.set(key, updated);
    return { ...updated };
  }

  resolve(incidentIdOrKey) {
    const key = this._findKey(incidentIdOrKey);
    if (!key) return null;

    const entry = this._queue.get(key);
    if (!entry) return null;

    const resolved = {
      ...entry,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    };

    this._queue.set(key, resolved);
    return { ...resolved };
  }

  _findKey(incidentIdOrKey) {
    if (this._queue.has(incidentIdOrKey)) {
      return incidentIdOrKey;
    }

    for (const [key, entry] of this._queue.entries()) {
      if (entry.incidentId && entry.incidentId === incidentIdOrKey) {
        return key;
      }
    }

    return null;
  }
}

module.exports = EscalationPolicy;
