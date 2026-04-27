'use strict';
const IncidentDetector = require('../../src/services/analysis/IncidentDetector');

describe('IncidentDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new IncidentDetector();
  });

  describe('isIncident()', () => {
    test('returns true for HIGH severity entry', () => {
      const entry = { severity: 'HIGH', message: 'service error', level: 'ERROR' };
      expect(detector.isIncident(entry)).toMatchObject({
        isIncident: true,
        type: 'severity-trigger',
      });
    });

    test('returns true for entry with incident keyword "unauthorized"', () => {
      const entry = { severity: 'LOW', message: 'Unauthorized access attempt', level: 'INFO' };
      expect(detector.isIncident(entry)).toMatchObject({
        isIncident: true,
        type: 'keyword-trigger',
        reason: 'Keyword: unauthorized',
      });
    });

    test('returns true for entry with keyword "timeout"', () => {
      const entry = { severity: 'MEDIUM', message: 'Connection timeout', level: 'WARNING' };
      expect(detector.isIncident(entry)).toMatchObject({
        isIncident: true,
        type: 'keyword-trigger',
        reason: 'Keyword: timeout',
      });
    });

    test('returns true for entry with keyword "failed"', () => {
      const entry = { severity: 'LOW', message: 'Login failed for user admin', level: 'INFO' };
      expect(detector.isIncident(entry)).toMatchObject({
        isIncident: true,
        type: 'keyword-trigger',
        reason: 'Keyword: failed',
      });
    });

    test('returns true for entry with keyword "crash"', () => {
      const entry = { severity: 'MEDIUM', message: 'Process crash detected', level: 'WARNING' };
      expect(detector.isIncident(entry)).toMatchObject({
        isIncident: true,
        type: 'keyword-trigger',
        reason: 'Keyword: crash',
      });
    });

    test('returns false for benign LOW severity INFO entry', () => {
      const entry = { severity: 'LOW', message: 'Health check passed', level: 'INFO' };
      expect(detector.isIncident(entry)).toEqual({ isIncident: false });
    });

    test('returns false for normal system message', () => {
      const entry = { severity: 'LOW', message: 'Backup job completed', level: 'INFO' };
      expect(detector.isIncident(entry)).toEqual({ isIncident: false });
    });

    test('keyword matching is case-insensitive', () => {
      const entry = { severity: 'LOW', message: 'UNAUTHORIZED REQUEST', level: 'INFO' };
      expect(detector.isIncident(entry)).toMatchObject({
        isIncident: true,
        reason: 'Keyword: unauthorized',
      });
    });

    test('handles missing message gracefully', () => {
      const entry = { severity: 'LOW', level: 'INFO' };
      expect(() => detector.isIncident(entry)).not.toThrow();
    });
  });

  describe('detectAll()', () => {
    test('filters and returns only incident entries', () => {
      const entries = [
        { severity: 'HIGH', message: 'error occurred', level: 'ERROR' },
        { severity: 'LOW', message: 'service started', level: 'INFO' },
        { severity: 'MEDIUM', message: 'login failed attempt', level: 'WARNING' },
      ];
      const incidents = detector.detectAll(entries);
      expect(incidents).toHaveLength(2);
    });

    test('returns empty array when no incidents detected', () => {
      const entries = [
        { severity: 'LOW', message: 'ok', level: 'INFO' },
        { severity: 'LOW', message: 'all good', level: 'INFO' },
      ];
      expect(detector.detectAll(entries)).toHaveLength(0);
    });

    test('returns empty array for empty input', () => {
      expect(detector.detectAll([])).toEqual([]);
    });
  });
});
