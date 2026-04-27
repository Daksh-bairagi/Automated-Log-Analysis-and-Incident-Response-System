/**
 * Redis-backed queue definitions matching Flow 12 and SDE Queue flow.
 * Consolidates job names and configurations.
 */

const JOB_TYPES = {
    ANALYZE: 'analyze',
    NOTIFY: 'notify'
};

const QUEUE_OPTIONS = {
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 200
    }
};

module.exports = {
    JOB_TYPES,
    QUEUE_OPTIONS
};
