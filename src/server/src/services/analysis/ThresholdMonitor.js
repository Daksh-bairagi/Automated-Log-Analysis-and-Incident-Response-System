class ThresholdMonitor {
  constructor() {
    this.counters = {};
  }

  track(entry) {
    const key = `${entry.level}:${entry.source}`;
    this.counters[key] = (this.counters[key] || 0) + 1;
  }

  checkThresholds() {
    const breaches = [];
    for (const [key, count] of Object.entries(this.counters)) {
      if (count >= 50) {
        breaches.push({ key, count, severity: 'CRITICAL', type: 'threshold-breach' });
      } else if (count >= 20) {
        breaches.push({ key, count, severity: 'HIGH', type: 'threshold-breach' });
      }
    }
    return breaches;
  }

  reset() {
    this.counters = {};
  }
}

module.exports = ThresholdMonitor;
