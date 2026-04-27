'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const FileRepository = require('../../src/repositories/FileRepository');

describe('FileRepository', () => {
  let tempDir;
  let repository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-analyzer-file-repo-'));
    repository = new FileRepository(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('saveReport persists report, entries, incidents, and ownerId', async () => {
    const report = { processedEntries: 2, detectedIncidents: 1 };
    const result = await repository.saveReport(report, {
      ownerId: 'owner-1',
      entries: [{ id: 'entry-1' }],
      incidents: [{ id: 'inc-1' }],
    });

    const saved = JSON.parse(fs.readFileSync(result.reportPath, 'utf8'));
    expect(saved.ownerId).toBe('owner-1');
    expect(saved.log_entries).toHaveLength(1);
    expect(saved.incidents).toHaveLength(1);
    expect(saved.processedEntries).toBe(2);
  });

  test('getLatestReport respects owner filtering', async () => {
    await repository.saveReport({ processedEntries: 1 }, { ownerId: 'owner-a' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repository.saveReport({ processedEntries: 2 }, { ownerId: 'owner-b' });

    const latestA = await repository.getLatestReport({ ownerId: 'owner-a' });
    const latestB = await repository.getLatestReport({ ownerId: 'owner-b' });

    expect(latestA.ownerId).toBe('owner-a');
    expect(latestA.processedEntries).toBe(1);
    expect(latestB.ownerId).toBe('owner-b');
    expect(latestB.processedEntries).toBe(2);
  });

  test('saveSourceDocument and listSourceDocuments return newest-first filtered data', async () => {
    await repository.saveSourceDocument({ ownerId: 'owner-a', originalName: 'a.log' });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await repository.saveSourceDocument({ ownerId: 'owner-b', originalName: 'b.log' });

    const docsA = await repository.listSourceDocuments({ ownerId: 'owner-a' });
    const docsB = await repository.listSourceDocuments({ ownerId: 'owner-b' });

    expect(docsA).toHaveLength(1);
    expect(docsA[0].originalName).toBe('a.log');
    expect(docsB).toHaveLength(1);
    expect(docsB[0].originalName).toBe('b.log');
  });
});
