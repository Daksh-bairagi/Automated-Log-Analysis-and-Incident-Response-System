const { Worker } = require('bullmq');

function createNotificationWorker({ queueManager, notificationService, concurrency = 2 }) {
  if (!queueManager) {
    throw new Error('createNotificationWorker requires queueManager');
  }

  if (!notificationService) {
    throw new Error('createNotificationWorker requires notificationService');
  }

  const worker = new Worker(
    queueManager.notificationQueueName,
    async (job) => {
      const { incident } = job.data || {};
      
      if (!incident) {
        throw new Error('Notification job requires incident data');
      }

      return await notificationService.notify(incident);
    },
    {
      connection: queueManager.getConnection(),
      concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    const jobId = job ? job.id : 'unknown';
    console.error(`❌ [Queue] Notification job ${jobId} failed: ${err.message}`);
  });

  return worker;
}

module.exports = createNotificationWorker;
