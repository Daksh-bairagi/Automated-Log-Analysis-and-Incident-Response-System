/**
 * ============================================================================
 * WHITE-BOX TEST SUITE — IncidentOrchestrator
 * ============================================================================
 * Tests the top-level orchestrator that coordinates:
 *   AnalysisEngine → ReportViewModelBuilder → Repository (persistence)
 *
 * TEST STRATEGY:
 *   - Mock AnalysisEngine, ReportViewModelBuilder, and Repository
 *   - Verify analyze() orchestrates engine + view model + optional persistence
 *   - Verify analyzeLineGroups() delegates to engine correctly
 *   - Verify saveReport() calls repository
 *   - Verify getLatestReport() retrieves and transforms report
 *   - Test error cases: no repository configured
 *
 * COVERAGE:
 *   ✓ analyze() with persistReport=true and false
 *   ✓ analyzeLineGroups() delegation
 *   ✓ saveReport() with and without repository
 *   ✓ getLatestReport() with and without data
 *   ✓ Error handling for missing repository
 * ============================================================================
 */

const IncidentOrchestrator = require('../../src/services/IncidentOrchestrator');

describe('IncidentOrchestrator', () => {
  // ---- Shared mock objects ----

  const MOCK_ENGINE_RESULT = {
    entries: [
      { timestamp: '2026-04-04 09:00:00', level: 'ERROR', source: 'auth', message: 'Unauthorized', severity: 'HIGH' },
      { timestamp: '2026-04-04 09:01:00', level: 'INFO', source: 'system', message: 'OK', severity: 'LOW' },
    ],
    incidents: [
      {
        id: 'INC-001',
        severity: 'HIGH',
        source: 'auth',
        message: 'Unauthorized',
        playbook: 'security-containment',
        actions: ['Isolate systems'],
        toJSON() { return { ...this }; },
      },
    ],
    parseErrors: [],
    report: {
      generatedAt: '2026-04-04T09:05:00.000Z',
      processedEntries: 2,
      detectedIncidents: 1,
      severityBreakdown: { HIGH: 1, MEDIUM: 0, LOW: 1 },
      incidents: [],
      logFiles: ['/logs/app.log'],
      parseErrors: 0,
    },
    logFiles: ['/logs/app.log'],
  };

  const MOCK_DASHBOARD_VIEW = {
    summary: { total: 2, incidents: 1, parseErrors: 0 },
    analyzedFiles: ['/logs/app.log'],
    incidents: [{ id: 'INC-001', severity: 'HIGH' }],
  };

  // Factory to create mock dependencies
  function createMocks(hasRepository = true) {
    const engine = {
      analyzeLogs: jest.fn().mockResolvedValue(MOCK_ENGINE_RESULT),
      analyzeLineGroups: jest.fn().mockResolvedValue(MOCK_ENGINE_RESULT),
    };

    const vmBuilder = {
      attachMetadata: jest.fn().mockReturnValue({ ...MOCK_ENGINE_RESULT.report, analysisType: 'file', durationMs: 42 }),
      toDashboardView: jest.fn().mockReturnValue(MOCK_DASHBOARD_VIEW),
    };

    const repository = hasRepository
      ? {
          saveReport: jest.fn().mockResolvedValue({ reportId: 'abc123', reportPath: 'mongodb://reports/abc123' }),
          getLatestReport: jest.fn().mockResolvedValue(MOCK_ENGINE_RESULT.report),
          listSourceDocuments: jest.fn().mockResolvedValue([]),
        }
      : null;

    const notificationService = {
      notify: jest.fn().mockResolvedValue({
        sent: true,
        reason: 'processed',
        results: [{ channel: 'google-chat', status: 'sent' }],
      }),
    };

    return { engine, vmBuilder, repository, notificationService };
  }

  // ===========================================================================
  // analyze() — Full analysis with file paths
  // ===========================================================================

  describe('analyze()', () => {
    test('should run engine, enrich report, and generate dashboard view', async () => {
      const { engine, vmBuilder, repository } = createMocks();
      const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder });

      const result = await orchestrator.analyze(['/logs/app.log']);

      // Engine should be called with the file paths
      expect(engine.analyzeLogs).toHaveBeenCalledWith(['/logs/app.log']);

      // View model builder should enrich the report
      expect(vmBuilder.attachMetadata).toHaveBeenCalled();
      expect(vmBuilder.toDashboardView).toHaveBeenCalled();

      // Result should contain all expected fields
      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('incidents');
      expect(result).toHaveProperty('report');
      expect(result).toHaveProperty('view');
      expect(result).toHaveProperty('logFiles');
    });

    test('should persist report when persistReport=true', async () => {
      const { engine, vmBuilder, repository } = createMocks();
      const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder });

      const result = await orchestrator.analyze(['/logs/app.log'], {
        persistReport: true,
      });

      // Repository should be called to save
      expect(repository.saveReport).toHaveBeenCalled();

      // Result should include persistence info
      expect(result.reportId).toBe('abc123');
      expect(result.reportPath).toContain('mongodb://');
    });

    test('should NOT persist report when persistReport=false', async () => {
      const { engine, vmBuilder, repository } = createMocks();
      const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder });

      const result = await orchestrator.analyze(['/logs/app.log'], {
        persistReport: false,
      });

      // Repository should NOT be called
      expect(repository.saveReport).not.toHaveBeenCalled();

      // No persistence info in result
      expect(result.reportId).toBeUndefined();
      expect(result.reportPath).toBeUndefined();
    });

    test('should work without a repository (fallback mode)', async () => {
      const { engine, vmBuilder } = createMocks(false);
      const orchestrator = new IncidentOrchestrator({ engine, repository: null, vmBuilder });

      // Should not throw even with persistReport=true
      const result = await orchestrator.analyze(['/logs/app.log'], {
        persistReport: true,
      });

      expect(result.entries).toHaveLength(2);
      expect(result.reportId).toBeUndefined();
    });

    test('should notify detected incidents with the authenticated user email', async () => {
      const { engine, vmBuilder, repository, notificationService } = createMocks();
      const orchestrator = new IncidentOrchestrator({
        engine,
        repository,
        vmBuilder,
        notificationService,
      });

      const result = await orchestrator.analyze(['/logs/app.log'], {
        notificationRecipientEmail: 'analyst@example.com',
      });

      expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
        id: 'INC-001',
        notificationRecipientEmail: 'analyst@example.com',
        analysisType: 'file',
      }));
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]).toEqual(expect.objectContaining({
        incidentId: 'INC-001',
        sent: true,
      }));
    });
  });

  // ===========================================================================
  // analyzeLineGroups() — Upload-based pipeline
  // ===========================================================================

  describe('analyzeLineGroups()', () => {
    test('should delegate to engine.analyzeLineGroups for pre-read lines', async () => {
      const { engine, vmBuilder, repository } = createMocks();
      const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder });

      const lineGroups = { 'upload.log': ['line1', 'line2'] };
      const result = await orchestrator.analyzeLineGroups(lineGroups);

      // Should call engine's analyzeLineGroups, not analyzeLogs
      expect(engine.analyzeLineGroups).toHaveBeenCalledWith(lineGroups);
      expect(engine.analyzeLogs).not.toHaveBeenCalled();

      expect(result).toHaveProperty('report');
      expect(result).toHaveProperty('view');
    });

    test('should default to persistReport=true for uploads', async () => {
      const { engine, vmBuilder, repository } = createMocks();
      const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder });

      await orchestrator.analyzeLineGroups({ 'test.log': ['line'] });

      // Default option for uploads is persistReport: true
      expect(repository.saveReport).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // saveReport()
  // ===========================================================================

  describe('saveReport()', () => {
    test('should save report via repository', async () => {
      const { engine, vmBuilder, repository } = createMocks();
      const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder });

      const result = await orchestrator.saveReport(
        MOCK_ENGINE_RESULT.report,
        { entries: MOCK_ENGINE_RESULT.entries, incidents: MOCK_ENGINE_RESULT.incidents }
      );

      expect(repository.saveReport).toHaveBeenCalledWith(
        MOCK_ENGINE_RESULT.report,
        expect.objectContaining({ entries: expect.any(Array), incidents: expect.any(Array) })
      );
      expect(result.reportId).toBe('abc123');
    });

    test('should throw when no repository is configured', async () => {
      const { engine, vmBuilder } = createMocks(false);
      const orchestrator = new IncidentOrchestrator({ engine, repository: null, vmBuilder });

      await expect(
        orchestrator.saveReport(MOCK_ENGINE_RESULT.report)
      ).rejects.toThrow('No repository configured');
    });
  });

  // ===========================================================================
  // getLatestReport()
  // ===========================================================================

  describe('getLatestReport()', () => {
    test('should retrieve latest report and transform to dashboard view', async () => {
      const { engine, vmBuilder, repository } = createMocks();
      const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder });

      const result = await orchestrator.getLatestReport();

      expect(repository.getLatestReport).toHaveBeenCalled();
      expect(vmBuilder.toDashboardView).toHaveBeenCalled();
      expect(result).toHaveProperty('report');
      expect(result).toHaveProperty('view');
    });

    test('should return null when no reports exist', async () => {
      const { engine, vmBuilder, repository } = createMocks();
      repository.getLatestReport.mockResolvedValue(null);
      const orchestrator = new IncidentOrchestrator({ engine, repository, vmBuilder });

      const result = await orchestrator.getLatestReport();

      expect(result).toBeNull();
    });

    test('should return null when no repository is configured', async () => {
      const { engine, vmBuilder } = createMocks(false);
      const orchestrator = new IncidentOrchestrator({ engine, repository: null, vmBuilder });

      const result = await orchestrator.getLatestReport();

      expect(result).toBeNull();
    });
  });
});
