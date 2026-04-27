'use strict';
const NotificationService = require('../../src/services/notification/NotificationService');

// ---- Mock channel factory ----
function makeChannel({ name = 'test', enabled = true, shouldTrigger = true, sendOk = true } = {}) {
  return {
    name,
    isEnabled: jest.fn().mockReturnValue(enabled),
    shouldTrigger: jest.fn().mockReturnValue(shouldTrigger),
    send: jest.fn().mockImplementation(() =>
      sendOk ? Promise.resolve({ ok: true }) : Promise.reject(new Error('send failed'))
    ),
  };
}

// ---- Mock deduplicator ----
function makeDedup({ isDuplicate = false } = {}) {
  return {
    isDuplicate: jest.fn().mockReturnValue(isDuplicate),
    record: jest.fn(),
  };
}

// ---- Mock escalation policy ----
function makeEscalation() {
  return { register: jest.fn() };
}

// ---- Sample incident ----
const INCIDENT = {
  id: 'INC-001',
  source: 'auth-service',
  message: 'Unauthorized access attempt',
  severity: 'CRITICAL',
  type: 'keyword-trigger',
  playbook: 'security-containment',
  actions: [],
};

describe('NotificationService', () => {
  describe('notify()', () => {
    test('sends to all enabled channels and returns sent=true', async () => {
      const ch1 = makeChannel({ name: 'slack' });
      const ch2 = makeChannel({ name: 'email' });
      const dedup = makeDedup();
      const escalation = makeEscalation();
      const svc = new NotificationService({ channels: [ch1, ch2], deduplicator: dedup, escalationPolicy: escalation });

      const result = await svc.notify(INCIDENT);

      expect(result.sent).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(ch1.send).toHaveBeenCalledTimes(1);
      expect(ch2.send).toHaveBeenCalledTimes(1);
    });

    test('skips channels where isEnabled() is false', async () => {
      const ch = makeChannel({ enabled: false });
      const svc = new NotificationService({ channels: [ch], deduplicator: makeDedup(), escalationPolicy: makeEscalation() });

      const result = await svc.notify(INCIDENT);
      expect(ch.send).not.toHaveBeenCalled();
      expect(result.results).toHaveLength(0);
    });

    test('skips channels where shouldTrigger() is false', async () => {
      const ch = makeChannel({ shouldTrigger: false });
      const svc = new NotificationService({ channels: [ch], deduplicator: makeDedup(), escalationPolicy: makeEscalation() });

      await svc.notify(INCIDENT);
      expect(ch.send).not.toHaveBeenCalled();
    });

    test('returns sent=false and reason=duplicate when deduplicator flags duplicate', async () => {
      const ch = makeChannel();
      const svc = new NotificationService({
        channels: [ch],
        deduplicator: makeDedup({ isDuplicate: true }),
        escalationPolicy: makeEscalation(),
      });

      const result = await svc.notify(INCIDENT);
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('duplicate');
      expect(ch.send).not.toHaveBeenCalled();
    });

    test('records dedup key after successful send', async () => {
      const dedup = makeDedup();
      const svc = new NotificationService({ channels: [makeChannel()], deduplicator: dedup, escalationPolicy: makeEscalation() });

      await svc.notify(INCIDENT);
      expect(dedup.record).toHaveBeenCalledTimes(1);
    });

    test('uses the recipient identity in the dedupe key', async () => {
      const dedup = makeDedup();
      const svc = new NotificationService({ channels: [makeChannel()], deduplicator: dedup, escalationPolicy: makeEscalation() });

      await svc.notify({ ...INCIDENT, notificationRecipientEmail: 'analyst@example.com' });

      expect(dedup.record).toHaveBeenCalledWith(expect.stringContaining('analyst@example.com'));
    });

    test('registers CRITICAL incident with escalation policy', async () => {
      const escalation = makeEscalation();
      const svc = new NotificationService({ channels: [makeChannel()], deduplicator: makeDedup(), escalationPolicy: escalation });

      await svc.notify({ ...INCIDENT, severity: 'CRITICAL' });
      expect(escalation.register).toHaveBeenCalledWith(expect.objectContaining({ severity: 'CRITICAL' }));
    });

    test('does not register HIGH incident with escalation policy', async () => {
      const escalation = makeEscalation();
      const svc = new NotificationService({ channels: [makeChannel()], deduplicator: makeDedup(), escalationPolicy: escalation });

      await svc.notify({ ...INCIDENT, severity: 'HIGH' });
      expect(escalation.register).not.toHaveBeenCalled();
    });

    test('marks channel result as failed when send throws', async () => {
      const ch = makeChannel({ sendOk: false });
      const svc = new NotificationService({ channels: [ch], deduplicator: makeDedup(), escalationPolicy: makeEscalation() });

      const result = await svc.notify(INCIDENT);
      expect(result.results[0].status).toBe('failed');
    });

    test('continues sending to other channels even if one fails', async () => {
      const failCh = makeChannel({ name: 'slack', sendOk: false });
      const okCh = makeChannel({ name: 'email', sendOk: true });
      const svc = new NotificationService({ channels: [failCh, okCh], deduplicator: makeDedup(), escalationPolicy: makeEscalation() });

      const result = await svc.notify(INCIDENT);
      const sent = result.results.find(r => r.status === 'sent');
      expect(sent).toBeTruthy();
    });

    test('works with empty channels array', async () => {
      const svc = new NotificationService({ channels: [], deduplicator: makeDedup(), escalationPolicy: makeEscalation() });
      const result = await svc.notify(INCIDENT);
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('no-enabled-channels');
    });
  });
});
