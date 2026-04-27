/**
 * Redis-backed queue manager for asynchronous analysis jobs.
 */

const { Queue } = require('bullmq');

class QueueManager {
  constructor({ redisUrl, analysisQueueName = 'analysis', notificationQueueName = 'notifications' } = {}) {
    if (!redisUrl) {
      throw new Error('QueueManager requires redisUrl');
    }

    this.connection = buildRedisConnection(redisUrl);
    this.analysisQueueName = analysisQueueName;
    this.notificationQueueName = notificationQueueName;

    this.analysisQueue = new Queue(this.analysisQueueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    this.notificationQueue = new Queue(this.notificationQueueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }

  getConnection() {
    return this.connection;
  }

  async addAnalysisJob(data, options = {}) {
    return this.analysisQueue.add('analyze', data, options);
  }

  async addNotificationJob(data, options = {}) {
    return this.notificationQueue.add('notify', data, options);
  }

  async getAnalysisJobStatus(jobId) {
    const job = await this.analysisQueue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();

    return {
      id: job.id,
      name: job.name,
      state,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn || null,
      finishedOn: job.finishedOn || null,
      failedReason: job.failedReason || null,
      progress: job.progress,
      data: job.data,
      result: job.returnvalue || null,
    };
  }

  async close() {
    await Promise.allSettled([
      this.analysisQueue.close(),
      this.notificationQueue.close(),
    ]);
  }
}

function buildRedisConnection(redisUrl) {
  const parsed = new URL(redisUrl);

  const connection = {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
  };

  if (parsed.username) connection.username = decodeURIComponent(parsed.username);
  if (parsed.password) connection.password = decodeURIComponent(parsed.password);
  if (parsed.protocol === 'rediss:') connection.tls = {};

  return connection;
}

module.exports = QueueManager;
