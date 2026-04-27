/**
 * Worker for asynchronous analysis queue jobs.
 */

const { Worker } = require('bullmq');

function createAnalysisWorker({ queueManager, orchestrator, concurrency = 2 }) {
  if (!queueManager) {
    throw new Error('createAnalysisWorker requires queueManager');
  }

  if (!orchestrator) {
    throw new Error('createAnalysisWorker requires orchestrator');
  }

  const worker = new Worker(
    queueManager.analysisQueueName,
    async (job) => {
      const { filePaths, options = {} } = job.data || {};

      if (!Array.isArray(filePaths) || filePaths.length === 0) {
        throw new Error('Analysis job requires non-empty filePaths');
      }

      const startedAt = Date.now();
      const result = await orchestrator.analyze(filePaths, {
        persistReport: true,
        analysisType: 'file',
        ...options,
      });

      return {
        processedEntries: result.report?.processedEntries || 0,
        detectedIncidents: result.report?.detectedIncidents || 0,
        reportId: result.reportId || null,
        reportPath: result.reportPath || null,
        durationMs: Date.now() - startedAt,
      };
    },
    {
      connection: queueManager.getConnection(),
      concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    const jobId = job ? job.id : 'unknown';
    console.error(`❌ [Queue] Analysis job ${jobId} failed: ${err.message}`);
  });

  return worker;
}

module.exports = createAnalysisWorker;
