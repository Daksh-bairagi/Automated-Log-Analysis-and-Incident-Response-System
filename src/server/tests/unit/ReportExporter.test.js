'use strict';

const ReportExporter = require('../../src/services/reporting/ReportExporter');

describe('ReportExporter', () => {
  let exporter;

  beforeEach(() => {
    exporter = new ReportExporter();
  });

  test('exports incidents to CSV safely', () => {
    const csv = exporter.exportToCsv({
      incidents: [
        {
          id: 'INC-001',
          severity: 'HIGH',
          type: 'security',
          source: 'auth',
          timestamp: '2026-04-14T12:00:00.000Z',
          message: 'Unauthorized "admin" attempt',
          playbook: 'security-containment',
        },
      ],
    });

    expect(csv).toContain('"INC-001"');
    expect(csv).toContain('"Unauthorized ""admin"" attempt"');
    expect(csv.split('\n')).toHaveLength(2);
  });

  test('exports a valid-looking PDF buffer', () => {
    const pdf = exporter.exportToPdf({
      reportId: 'report-123',
      generatedAt: '2026-04-14T12:00:00.000Z',
      processedEntries: 10,
      detectedIncidents: 1,
      parseErrors: 0,
      incidents: [
        {
          severity: 'CRITICAL',
          source: 'api',
          timestamp: '2026-04-14T12:01:00.000Z',
          message: 'Database outage detected',
        },
      ],
    });

    const text = pdf.toString('utf8');
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('%%EOF');
  });
});
