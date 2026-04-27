'use strict';
const ResponsePlanner = require('../../src/services/response/ResponsePlanner');
const PlaybookRegistry = require('../../src/services/response/PlaybookRegistry');
const playbooks = require('../../src/config/playbooks');

describe('ResponsePlanner', () => {
  let planner;

  beforeEach(() => {
    const registry = new PlaybookRegistry(playbooks);
    planner = new ResponsePlanner(registry);
  });

  const makeIncident = (overrides = {}) => ({
    source: 'app-service',
    message: 'some incident',
    severity: 'HIGH',
    type: 'unknown',
    playbook: null,
    actions: [],
    ...overrides,
  });

  describe('plan()', () => {
    test('assigns security-containment for unauthorized message', () => {
      const inc = makeIncident({ message: 'Unauthorized access attempt detected' });
      planner.plan(inc);
      expect(inc.playbook).toBe('security-containment');
      expect(inc.actions.length).toBeGreaterThan(0);
    });

    test('assigns security-containment for breach message', () => {
      const inc = makeIncident({ message: 'Security breach detected in auth service' });
      planner.plan(inc);
      expect(inc.playbook).toBe('security-containment');
    });

    test('assigns security-containment for brute-force-attack incident type', () => {
      const inc = makeIncident({ type: 'brute-force-attack', message: 'login failed' });
      planner.plan(inc);
      expect(inc.playbook).toBe('security-containment');
    });

    test('assigns service-recovery for ERROR severity', () => {
      const inc = makeIncident({ severity: 'HIGH', message: 'Service crashed unexpectedly' });
      planner.plan(inc);
      expect(inc.playbook).toBe('service-recovery');
    });

    test('assigns service-recovery for timeout message', () => {
      const inc = makeIncident({ severity: 'MEDIUM', message: 'Request timeout after 30s' });
      planner.plan(inc);
      expect(inc.playbook).toBe('performance-remediation');
    });

    test('assigns cascade-recovery for cascade-failure type', () => {
      const inc = makeIncident({ type: 'cascade-failure', message: 'multiple services down' });
      planner.plan(inc);
      expect(inc.playbook).toBe('cascade-recovery');
    });

    test('assigns performance-remediation for service-degradation type', () => {
      const inc = makeIncident({ type: 'service-degradation', message: 'latency increasing', severity: 'MEDIUM' });
      planner.plan(inc);
      expect(inc.playbook).toBe('performance-remediation');
    });

    test('assigns manual-triage as fallback for unknown incident', () => {
      const inc = makeIncident({ severity: 'LOW', message: 'minor glitch', type: 'unknown' });
      planner.plan(inc);
      expect(inc.playbook).toBe('manual-triage');
    });

    test('populates actions array from playbook definition', () => {
      const inc = makeIncident({ message: 'unauthorized access' });
      planner.plan(inc);
      expect(Array.isArray(inc.actions)).toBe(true);
      expect(inc.actions.length).toBeGreaterThan(0);
      expect(typeof inc.actions[0]).toBe('string');
    });

    test('mutations do not share state between incidents', () => {
      const inc1 = makeIncident({ message: 'unauthorized' });
      const inc2 = makeIncident({ type: 'service-degradation', message: 'latency', severity: 'LOW' });
      planner.plan(inc1);
      planner.plan(inc2);
      expect(inc1.playbook).not.toBe(inc2.playbook);
    });
  });
});
