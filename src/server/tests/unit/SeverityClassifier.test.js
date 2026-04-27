'use strict';

const SeverityClassifier = require('../../src/services/analysis/SeverityClassifier');

describe('SeverityClassifier', () => {
  let classifier;

  beforeEach(() => {
    classifier = new SeverityClassifier({ mlEnabled: false });
  });

  describe('classify()', () => {
    test('maps ERROR level to HIGH severity', async () => {
      const entry = { level: 'ERROR', message: 'something went wrong' };
      const result = await classifier.classify(entry);
      expect(result).toBe('HIGH');
      expect(entry.severity).toBe('HIGH');
    });

    test('maps WARNING level to MEDIUM severity', async () => {
      const entry = { level: 'WARNING', message: 'approaching limit' };
      await expect(classifier.classify(entry)).resolves.toBe('MEDIUM');
    });

    test('maps WARN (alias) level to MEDIUM severity', async () => {
      const entry = { level: 'WARN', message: 'warn message' };
      await expect(classifier.classify(entry)).resolves.toBe('MEDIUM');
    });

    test('maps INFO level to LOW severity', async () => {
      const entry = { level: 'INFO', message: 'service started' };
      await expect(classifier.classify(entry)).resolves.toBe('LOW');
    });

    test('maps DEBUG level to LOW severity', async () => {
      const entry = { level: 'DEBUG', message: 'debug info' };
      await expect(classifier.classify(entry)).resolves.toBe('LOW');
    });

    test('defaults unknown level to LOW', async () => {
      const entry = { level: 'TRACE', message: 'trace line' };
      await expect(classifier.classify(entry)).resolves.toBe('LOW');
    });

    test('handles case-insensitive levels', async () => {
      await expect(classifier.classify({ level: 'error', message: 'x' })).resolves.toBe('HIGH');
      await expect(classifier.classify({ level: 'warning', message: 'x' })).resolves.toBe('MEDIUM');
    });

    test('handles missing level gracefully', async () => {
      const entry = { message: 'no level field' };
      const result = await classifier.classify(entry);
      expect(result).toBe('LOW');
    });

    test('mutates the entry by adding .severity property', async () => {
      const entry = { level: 'ERROR', message: 'test' };
      await classifier.classify(entry);
      expect(entry).toHaveProperty('severity', 'HIGH');
    });
  });

  describe('ML integration', () => {
    test('uses structured ML classification when enough anomaly fields are present', async () => {
      const mlClient = {
        confidenceThreshold: 0.75,
        classifyStructured: jest.fn().mockResolvedValue({
          label: 'critical',
          confidence: 0.91,
          scores: { CRITICAL: 0.91, HIGH: 0.09 },
        }),
      };

      classifier = new SeverityClassifier({ mlEnabled: true, mlClient });

      const entry = {
        level: 'INFO',
        source: 'Database',
        message: 'Storage anomaly detected from Database. Status: Open. CPU usage 95%, memory 4096MB, disk 90%. Response time 6000ms. Login attempts: 4, failed transactions: 12, retry count: 3. Alert via Email. Service type: API.',
        metadata: {
          Anomaly_Type: 'Storage',
          Status: 'Open',
          CPU_Usage_Percent: 95,
          Memory_Usage_MB: 4096,
          Disk_Usage_Percent: 90,
          Response_Time_ms: 6000,
          Login_Attempts: 4,
          Failed_Transactions: 12,
          Retry_Count: 3,
          Alert_Method: 'Email',
          Service_Type: 'API',
        },
      };

      const result = await classifier.classify(entry);

      expect(mlClient.classifyStructured).toHaveBeenCalledWith(expect.objectContaining({
        anomaly_type: 'Storage',
        source: 'Database',
        status: 'Open',
        cpu_usage: 95,
        memory_usage: 4096,
        disk_usage: 90,
        response_time_ms: 6000,
        login_attempts: 4,
        failed_transactions: 12,
        retry_count: 3,
        alert_method: 'Email',
        service_type: 'API',
      }));
      expect(result).toBe('CRITICAL');
      expect(entry.classifiedBy).toBe('ml');
      expect(entry.mlConfidence).toBe(0.91);
    });

    test('falls back to rules when ML confidence is too low', async () => {
      const mlClient = {
        confidenceThreshold: 0.75,
        classifyStructured: jest.fn().mockResolvedValue({
          label: 'CRITICAL',
          confidence: 0.42,
          scores: { CRITICAL: 0.42, HIGH: 0.58 },
        }),
      };

      classifier = new SeverityClassifier({ mlEnabled: true, mlClient });

      const entry = {
        level: 'ERROR',
        source: 'api',
        message: 'service failed during request processing',
        metadata: {
          Anomaly_Type: 'Application',
          Status: 'Open',
          Alert_Method: 'Dashboard',
          Service_Type: 'API',
          CPU_Usage_Percent: 82,
          Memory_Usage_MB: 2048,
          Response_Time_ms: 1500,
        },
      };

      const result = await classifier.classify(entry);

      expect(mlClient.classifyStructured).toHaveBeenCalledTimes(1);
      expect(result).toBe('HIGH');
      expect(entry.classifiedBy).toBe('rules');
      expect(entry.mlConfidence).toBeUndefined();
    });

    test('skips ML for generic logs without enough structured signal', async () => {
      const mlClient = {
        confidenceThreshold: 0.75,
        classifyStructured: jest.fn(),
      };

      classifier = new SeverityClassifier({ mlEnabled: true, mlClient });

      const entry = {
        level: 'ERROR',
        source: 'http',
        message: 'GET /api/users -> 500',
      };

      const result = await classifier.classify(entry);

      expect(mlClient.classifyStructured).not.toHaveBeenCalled();
      expect(result).toBe('HIGH');
      expect(entry.classifiedBy).toBe('rules');
    });

    test('skips ML for partial structured payloads that do not match training shape', async () => {
      const mlClient = {
        confidenceThreshold: 0.75,
        classifyStructured: jest.fn(),
      };

      classifier = new SeverityClassifier({ mlEnabled: true, mlClient });

      const entry = {
        level: 'ERROR',
        source: 'api',
        message: 'latency increased and retries started',
        metadata: {
          CPU_Usage_Percent: 82,
          Response_Time_ms: 1500,
        },
      };

      const result = await classifier.classify(entry);

      expect(mlClient.classifyStructured).not.toHaveBeenCalled();
      expect(result).toBe('HIGH');
      expect(entry.classifiedBy).toBe('rules');
    });
  });

  describe('classifyAll()', () => {
    test('returns breakdown object with counts per severity', async () => {
      const entries = [
        { level: 'ERROR', message: 'e1' },
        { level: 'ERROR', message: 'e2' },
        { level: 'WARNING', message: 'w1' },
        { level: 'INFO', message: 'i1' },
      ];
      const breakdown = await classifier.classifyAll(entries);
      expect(breakdown.HIGH).toBe(2);
      expect(breakdown.MEDIUM).toBe(1);
      expect(breakdown.LOW).toBe(1);
    });

    test('returns all-zero breakdown for empty array', async () => {
      const breakdown = await classifier.classifyAll([]);
      expect(breakdown).toEqual({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });
    });

    test('mutates all entries with severity', async () => {
      const entries = [
        { level: 'ERROR', message: 'e' },
        { level: 'INFO', message: 'i' },
      ];
      await classifier.classifyAll(entries);
      expect(entries[0].severity).toBe('HIGH');
      expect(entries[1].severity).toBe('LOW');
    });
  });
});
