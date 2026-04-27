'use strict';

const createStreamIngestControllers = require('../../src/controllers/streamIngestController');

describe('streamIngestController severity integration', () => {
  const { buildClassifierEntry, chooseStrongerSeverity, classifySeverity } = createStreamIngestControllers._private;

  test('buildClassifierEntry preserves raw JSON as metadata for ML', () => {
    const entry = buildClassifierEntry({
      timestamp: '2026-04-14T12:00:00.000Z',
      level: 'INFO',
      source: 'api',
      message: 'structured anomaly payload',
      _raw: {
        Anomaly_Type: 'Database',
        CPU_Usage_Percent: 95,
      },
    });

    expect(entry).toEqual({
      timestamp: '2026-04-14T12:00:00.000Z',
      level: 'INFO',
      source: 'api',
      message: 'structured anomaly payload',
      metadata: {
        Anomaly_Type: 'Database',
        CPU_Usage_Percent: 95,
      },
    });
  });

  test('chooseStrongerSeverity returns the more severe value', () => {
    expect(chooseStrongerSeverity('LOW', 'HIGH')).toBe('HIGH');
    expect(chooseStrongerSeverity('CRITICAL', 'HIGH')).toBe('CRITICAL');
  });

  test('uses ML result when stream entry classifier resolves via ml', async () => {
    const state = {
      classifier: {
        classify: jest.fn().mockImplementation(async (entry) => {
          entry.severity = 'CRITICAL';
          entry.classifiedBy = 'ml';
          entry.mlConfidence = 0.93;
          entry.mlScores = { CRITICAL: 0.93 };
          return 'CRITICAL';
        }),
      },
    };

    const result = await classifySeverity({
      timestamp: '2026-04-14T12:00:00.000Z',
      level: 'INFO',
      source: 'api',
      message: 'Database anomaly detected',
      _raw: {
        Anomaly_Type: 'Database',
        Status: 'Open',
        Alert_Method: 'Email',
        Service_Type: 'API',
        CPU_Usage_Percent: 95,
        Memory_Usage_MB: 4096,
        Response_Time_ms: 6000,
      },
    }, state);

    expect(state.classifier.classify).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      severity: 'CRITICAL',
      classifiedBy: 'ml',
      mlConfidence: 0.93,
    }));
  });

  test('falls back to stream heuristics when they are stronger than shared rules', async () => {
    const state = {
      classifier: {
        classify: jest.fn().mockImplementation(async (entry) => {
          entry.severity = 'LOW';
          entry.classifiedBy = 'rules';
          return 'LOW';
        }),
      },
    };

    const result = await classifySeverity({
      timestamp: '2026-04-14T12:00:00.000Z',
      level: 'INFO',
      source: 'en.wikipedia',
      message: 'Abuse filter triggered on "Example" by user',
      _raw: {
        log_type: 'abusefilter',
      },
    }, state);

    expect(result).toEqual({
      severity: 'CRITICAL',
      classifiedBy: 'stream-heuristics',
    });
  });
});
