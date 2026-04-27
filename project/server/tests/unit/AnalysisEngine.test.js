/**
 * ============================================================================
 * WHITE-BOX TEST SUITE â€” AnalysisEngine
 * ============================================================================
 */

const AnalysisEngine = require('../../src/services/analysis/AnalysisEngine');
const SeverityClassifier = require('../../src/services/analysis/SeverityClassifier');
const LogReader = require('../../src/services/ingestion/LogReader');
const IncidentRecord = require('../../src/models/IncidentRecord');

jest.mock('../../src/services/ingestion/LogReader');

describe('AnalysisEngine', () => {
  let engine;

  const SAMPLE_LINES = [
    '2026-04-04 09:00:00 INFO system Service health check passed',
    '2026-04-04 09:01:00 WARNING network Packet loss detected on eth0',
    '2026-04-04 09:02:00 ERROR auth Unauthorized access attempt from 192.168.1.100',
    '2026-04-04 09:03:00 ERROR database Connection pool exhausted timeout after 30s',
    '2026-04-04 09:04:00 INFO scheduler Cron job completed successfully',
  ];

  const MALFORMED_LINES = [
    'just a random string',
    'too short',
    '',
  ];

  beforeEach(() => {
    engine = new AnalysisEngine({
      classifier: new SeverityClassifier({ mlEnabled: false }),
    });
    IncidentRecord.resetCounter();
    jest.clearAllMocks();
  });

  describe('analyzeLogs()', () => {
    test('should run full pipeline on log files and return structured result', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: { '/logs/app.log': SAMPLE_LINES },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);

      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('incidents');
      expect(result).toHaveProperty('parseErrors');
      expect(result).toHaveProperty('report');
      expect(result).toHaveProperty('logFiles');
      expect(result).toHaveProperty('readErrors');
    });

    test('should correctly parse all valid log lines into LogEntry objects', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: { '/logs/app.log': SAMPLE_LINES },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);

      expect(result.entries).toHaveLength(5);
      expect(result.parseErrors).toHaveLength(0);

      const firstEntry = result.entries[0];
      expect(firstEntry.timestamp).toBe('2026-04-04 09:00:00');
      expect(firstEntry.level).toBe('INFO');
      expect(firstEntry.source).toBe('system');
      expect(firstEntry.message).toBe('Service health check passed');
    });

    test('should classify severity correctly for each log level', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: { '/logs/app.log': SAMPLE_LINES },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);

      expect(result.entries[0].severity).toBe('LOW');
      expect(result.entries[1].severity).toBe('MEDIUM');
      expect(result.entries[2].severity).toBe('CRITICAL');
      expect(result.entries[3].severity).toBe('HIGH');
      expect(result.entries[4].severity).toBe('LOW');
    });

    test('should detect incidents for HIGH severity entries', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: { '/logs/app.log': SAMPLE_LINES },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);

      expect(result.incidents.length).toBeGreaterThanOrEqual(2);
      expect(result.incidents[0].id).toBe('INC-001');
      expect(result.incidents[1].id).toBe('INC-002');
    });

    test('should assign correct playbooks to detected incidents', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: {
          '/logs/app.log': [
            '2026-04-04 09:00:00 ERROR security Unauthorized login attempt detected',
            '2026-04-04 09:01:00 ERROR api Database connection failed',
          ],
        },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);

      const securityIncident = result.incidents.find((incident) => incident.message.includes('Unauthorized'));
      expect(securityIncident).toBeDefined();
      expect(securityIncident.playbook).toBe('security-containment');

      const serviceIncident = result.incidents.find((incident) => incident.message.includes('failed'));
      expect(serviceIncident).toBeDefined();
      expect(serviceIncident.playbook).toBe('service-recovery');
    });

    test('should handle parse errors for malformed log lines', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: {
          '/logs/bad.log': [...SAMPLE_LINES, ...MALFORMED_LINES],
        },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/bad.log']);

      expect(result.entries).toHaveLength(5);
      expect(result.parseErrors).toHaveLength(2);
    });

    test('should include read errors from LogReader in the result', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: { '/logs/app.log': SAMPLE_LINES },
        errors: ['Failed to read /logs/missing.log: File not found'],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);

      expect(result.readErrors).toHaveLength(1);
      expect(result.readErrors[0]).toContain('missing.log');
    });

    test('should build a complete report with correct aggregation', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: { '/logs/app.log': SAMPLE_LINES },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);
      const report = result.report;

      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('processedEntries', 5);
      expect(report).toHaveProperty('detectedIncidents');
      expect(report).toHaveProperty('severityBreakdown');
      expect(report).toHaveProperty('logFiles');
      expect(report).toHaveProperty('parseErrors', 0);

      expect(report.severityBreakdown.CRITICAL).toBe(1);
      expect(report.severityBreakdown.HIGH).toBe(1);
      expect(report.severityBreakdown.MEDIUM).toBe(1);
      expect(report.severityBreakdown.LOW).toBe(2);
    });

    test('should handle multiple log files merged together', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: {
          '/logs/app.log': SAMPLE_LINES.slice(0, 3),
          '/logs/system.log': SAMPLE_LINES.slice(3, 5),
        },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log', '/logs/system.log']);

      expect(result.entries).toHaveLength(5);
      expect(result.logFiles).toContain('/logs/app.log');
      expect(result.logFiles).toContain('/logs/system.log');
    });
  });

  describe('analyzeLineGroups()', () => {
    test('should process pre-read line groups (for uploaded files)', async () => {
      const lineGroups = {
        'upload1.log': SAMPLE_LINES.slice(0, 3),
        'upload2.log': SAMPLE_LINES.slice(3, 5),
      };

      const result = await engine.analyzeLineGroups(lineGroups);

      expect(result.entries).toHaveLength(5);
      expect(result.logFiles).toContain('upload1.log');
      expect(result.logFiles).toContain('upload2.log');
    });

    test('should produce same analysis quality as file-based pipeline', async () => {
      const lineGroups = { 'test.log': SAMPLE_LINES };

      const result = await engine.analyzeLineGroups(lineGroups);

      expect(result.entries[0].severity).toBe('LOW');
      expect(result.entries[2].severity).toBe('CRITICAL');
      expect(result.incidents.length).toBeGreaterThanOrEqual(2);
      expect(result.report.processedEntries).toBe(5);
    });

    test('should handle empty line groups gracefully', async () => {
      const result = await engine.analyzeLineGroups({ 'empty.log': [] });

      expect(result.entries).toHaveLength(0);
      expect(result.incidents).toHaveLength(0);
      expect(result.report.processedEntries).toBe(0);
    });
  });

  describe('IncidentRecord counter reset', () => {
    test('should reset counter between analysis runs for clean ID sequences', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: {
          '/logs/app.log': [
            '2026-04-04 09:00:00 ERROR auth Unauthorized access',
          ],
        },
        errors: [],
      });

      const result1 = await engine.analyzeLogs(['/logs/app.log']);
      expect(result1.incidents[0].id).toBe('INC-001');

      const result2 = await engine.analyzeLogs(['/logs/app.log']);
      expect(result2.incidents[0].id).toBe('INC-001');
    });
  });

  describe('keyword-based incident detection', () => {
    test('should detect incidents via keywords even for MEDIUM severity', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: {
          '/logs/app.log': [
            '2026-04-04 09:00:00 WARNING network Connection timeout on port 8080',
          ],
        },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);

      expect(result.incidents).toHaveLength(1);
      expect(result.incidents[0].severity).toBe('MEDIUM');
    });

    test('should NOT detect incidents for clean INFO lines without keywords', async () => {
      LogReader.readMultipleFiles.mockReturnValue({
        fileGroups: {
          '/logs/app.log': [
            '2026-04-04 09:00:00 INFO system Service started successfully',
            '2026-04-04 09:01:00 INFO scheduler Job completed normally',
          ],
        },
        errors: [],
      });

      const result = await engine.analyzeLogs(['/logs/app.log']);

      expect(result.incidents).toHaveLength(0);
    });
  });
});
