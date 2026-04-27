const QueueManager = require('./src/queues/queueManager');

async function checkRedisProject() {
  let qm;
  try {
    console.log('Connecting to Redis at redis://localhost:6379...');
    qm = new QueueManager({ redisUrl: 'redis://localhost:6379' });
    
    console.log('Adding test job to analysis queue...');
    const job = await qm.addAnalysisJob({ test: 'data' }, { jobId: 'test-job-1' });
    
    console.log('Fetching test job status...');
    const status = await qm.getAnalysisJobStatus(job.id);
    
    if (status && status.id === 'test-job-1') {
       console.log('✅ BullMQ / Redis is working correctly for the project!');
       console.log('Job status:', status.state);
    } else {
       console.log('❌ Failed to retrieve job status. Is BullMQ able to persist to Redis?');
    }
  } catch(e) {
    console.log('❌ Error connecting or using queues via Redis:', e.message);
  } finally {
    if (qm) {
      await qm.close();
      console.log('Closed connection.');
    }
    setTimeout(() => process.exit(0), 1000); 
  }
}

checkRedisProject();
