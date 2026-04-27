'use strict';
const CorrelationEngine = require('../../src/services/analysis/CorrelationEngine');

describe('CorrelationEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new CorrelationEngine();
  });

  const makeEntry = (overrides = {}) => ({
    level: 'ERROR',
    source: 'auth-service',
    message: 'test message',
    timestamp: new Date().toISOString(),
    ...overrides,
  });

  describe('analyze() — brute-force rule', () => {
    test('detects brute-force attack after 5 failed logins from same source', () => {
      const entry = makeEntry({ message: 'login failed for user admin', source: 'auth' });
      let detected = [];
      for (let i = 0; i < 5; i++) {
        detected = engine.analyze(entry);
      }
      expect(detected.length).toBeGreaterThan(0);
      expect(detected[0].type).toBe('brute-force-attack');
      expect(detected[0].severity).toBe('CRITICAL');
    });

    test('does not trigger before reaching the threshold (4 attempts)', () => {
      const entry = makeEntry({ message: 'login failed' });
      let lastResult = [];
      for (let i = 0; i < 4; i++) {
        lastResult = engine.analyze(entry);
      }
      expect(lastResult).toHaveLength(0);
    });

    test('resets window after triggering brute-force', () => {
      const entry = makeEntry({ message: 'login failed', source: 'auth' });
      // Trigger once
      for (let i = 0; i < 5; i++) engine.analyze(entry);
      // Should not re-trigger immediately on next single event
      const result = engine.analyze(entry);
      expect(result).toHaveLength(0);
    });
  });

  describe('analyze() — cascade failure rule', () => {
    test('detects cascade failure from 3 different ERROR sources', () => {
      let detected = [];
      detected = engine.analyze(makeEntry({ level: 'ERROR', source: 'service-a' }));
      detected = engine.analyze(makeEntry({ level: 'ERROR', source: 'service-b' }));
      detected = engine.analyze(makeEntry({ level: 'ERROR', source: 'service-c' }));
      expect(detected.some(d => d.type === 'cascade-failure')).toBe(true);
    });

    test('does not trigger cascade from same source repeated', () => {
      // Only 1 unique source — should NOT trigger (threshold is 3 unique sources)
      let detected = [];
      for (let i = 0; i < 3; i++) {
        detected = engine.analyze(makeEntry({ level: 'ERROR', source: 'same-service' }));
      }
      expect(detected.filter(d => d.type === 'cascade-failure')).toHaveLength(0);
    });
  });

  describe('analyze() — timeout storm rule', () => {
    test('detects service degradation after 10 timeout messages', () => {
      const entry = makeEntry({ message: 'connection timeout after 30s' });
      let detected = [];
      for (let i = 0; i < 10; i++) {
        detected = engine.analyze(entry);
      }
      expect(detected.some(d => d.type === 'service-degradation')).toBe(true);
    });
  });

  describe('analyze() — non-matching entries', () => {
    test('returns empty array for benign INFO entry', () => {
      const entry = makeEntry({ level: 'INFO', message: 'health check ok' });
      expect(engine.analyze(entry)).toHaveLength(0);
    });
  });
});
