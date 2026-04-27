/**
 * ============================================================================
 * HEALTH CHECK — Redis, BullMQ, and MongoDB
 * ============================================================================
 * Run:  node health_check.js
 * ============================================================================
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const { MongoClient } = require('mongodb');
const { Queue }       = require('bullmq');
const IORedis         = require('ioredis');

const MONGO_URI  = process.env.MONGO_URI  || 'mongodb://arav:280820@localhost:27017/log_analyzer?authSource=admin';
const DB_NAME    = process.env.DB_NAME    || 'log_analyzer';
const REDIS_URL  = process.env.REDIS_URL  || 'redis://localhost:6379';

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';

function ok(label, detail = '')  { console.log(`  ${GREEN}✔ ${label}${RESET}${detail ? '  ' + detail : ''}`); }
function fail(label, err = '')   { console.log(`  ${RED}✘ ${label}${RESET}${err ? '  → ' + err : ''}`); }
function info(label)             { console.log(`  ${YELLOW}ℹ ${label}${RESET}`); }
function section(title)          { console.log(`\n${CYAN}━━━ ${title} ━━━${RESET}`); }

// ─── Redis ──────────────────────────────────────────────────────────────────
async function checkRedis() {
  section('Redis');
  const parsed = new URL(REDIS_URL);
  const redis = new IORedis({
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong === 'PONG') ok('PING → PONG', `(host ${parsed.hostname}:${parsed.port || 6379})`);
    else fail('Unexpected PING response', pong);

    // Quick SET / GET round-trip
    await redis.set('healthcheck:test', '1', 'EX', 5);
    const val = await redis.get('healthcheck:test');
    if (val === '1') ok('SET / GET round-trip');
    else             fail('SET / GET mismatch');

    // Server info
    const info2 = await redis.info('server');
    const match  = info2.match(/redis_version:([^\r\n]+)/);
    if (match) ok('Redis version', match[1].trim());

  } catch (err) {
    fail('Redis connection failed', err.message);
  } finally {
    redis.disconnect();
  }
}

// ─── BullMQ ─────────────────────────────────────────────────────────────────
async function checkBullMQ() {
  section('BullMQ');
  const parsed = new URL(REDIS_URL);
  const connection = {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };

  const QUEUES = ['analysis', 'notifications'];

  for (const name of QUEUES) {
    let queue;
    try {
      queue = new Queue(name, { connection });

      // Add a test job
      const job = await queue.add('healthcheck', { at: new Date().toISOString() });
      ok(`Queue "${name}" — job added`, `jobId=${job.id}`);

      // Count queued jobs
      const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
      info(`Queue "${name}" counts: waiting=${counts.waiting} active=${counts.active} completed=${counts.completed} failed=${counts.failed}`);

    } catch (err) {
      fail(`Queue "${name}" failed`, err.message);
    } finally {
      if (queue) await queue.close();
    }
  }
}

// ─── MongoDB ─────────────────────────────────────────────────────────────────
async function checkMongo() {
  section('MongoDB');
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });

  try {
    await client.connect();
    ok('Connected to MongoDB', MONGO_URI.replace(/:[^:@]*@/, ':****@'));

    // Ping the admin DB
    const adminDb = client.db('admin');
    const pingRes = await adminDb.command({ ping: 1 });
    if (pingRes.ok === 1) ok('ping command → ok');
    else                  fail('ping returned unexpected result', JSON.stringify(pingRes));

    // List collections + document counts
    const db = client.db(DB_NAME);
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      info(`Database "${DB_NAME}" exists but has no collections yet`);
    } else {
      ok(`Database "${DB_NAME}" has ${collections.length} collection(s)`);
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        info(`  collection "${col.name}" — ${count} document(s)`);
      }
    }

  } catch (err) {
    fail('MongoDB connection failed', err.message);
  } finally {
    await client.close();
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\n${CYAN}╔══════════════════════════════════════════╗`);
  console.log(`║       SYSTEM HEALTH CHECK                ║`);
  console.log(`╚══════════════════════════════════════════╝${RESET}`);
  console.log(`  REDIS_URL : ${REDIS_URL}`);
  console.log(`  MONGO_URI : ${MONGO_URI.replace(/:[^:@]*@/, ':****@')}`);
  console.log(`  DB_NAME   : ${DB_NAME}`);

  await checkRedis();
  await checkBullMQ();
  await checkMongo();

  console.log(`\n${CYAN}━━━ Done ━━━${RESET}\n`);
})();
