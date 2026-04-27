class CorrelationEngine {
  constructor() {
    this.windows = {};
    this.rules = [
      {
        name: 'brute-force',
        match: e => e.message.toLowerCase().includes('login failed'),
        windowMs: 120000,
        threshold: 5,
        type: 'brute-force-attack',
        severity: 'CRITICAL'
      },
      {
        name: 'cascade',
        match: e => e.level === 'ERROR',
        windowMs: 60000,
        threshold: 3,
        groupBy: 'source',
        type: 'cascade-failure',
        severity: 'CRITICAL'
      },
      {
        name: 'timeout-storm',
        match: e => e.message.toLowerCase().includes('timeout'),
        windowMs: 300000,
        threshold: 10,
        type: 'service-degradation',
        severity: 'HIGH'
      }
    ];
  }

  reset() {
    this.windows = {};
  }

  analyze(entry) {
    const detected = [];
    const now = this._getEventTime(entry);
    for (const rule of this.rules) {
      if (!rule.match(entry)) continue;
      const key = rule.name + ':' + (rule.groupBy ? 'multi' : entry.source);
      if (!this.windows[key]) {
        this.windows[key] = { events: [], sources: new Set() };
      }
      const win = this.windows[key];
      win.events.push({ ts: now, source: entry.source });
      win.sources.add(entry.source);
      win.events = win.events.filter(e => now - e.ts < rule.windowMs);
      
      const count = rule.groupBy === 'source' ? win.sources.size : win.events.length;
      if (count >= rule.threshold) {
        detected.push({
          type: rule.type,
          severity: rule.severity,
          eventCount: count,
          triggerEntry: entry
        });
        // Reset window after triggering
        this.windows[key] = { events: [], sources: new Set() };
      }
    }
    return detected;
  }

  _getEventTime(entry) {
    const parsed = Date.parse(entry.timestamp);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }
}

module.exports = CorrelationEngine;
