class ResponsePlanner {
  constructor(playbookRegistry) {
    this.registry = playbookRegistry;
  }

  plan(incident) {
    const playbookKey = this.selectPlaybook(incident);
    const playbook = this.registry.get(playbookKey);
    incident.playbook = playbookKey;
    incident.actions = Array.isArray(playbook.actions) ? [...playbook.actions] : [];
    incident.priority = playbook.priority || 'P4';
    incident.estimatedMinutes = playbook.estimatedMinutes || null;
    return incident;
  }

  selectPlaybook(incident) {
    const message = (incident.message || '').toLowerCase();
    const type = incident.type || '';

    if (
      type === 'brute-force-attack' ||
      message.includes('unauthorized') ||
      message.includes('breach') ||
      message.includes('attack') ||
      message.includes('suspicious')
    ) {
      return 'security-containment';
    }

    if (type === 'cascade-failure') {
      return 'cascade-recovery';
    }

    if (type === 'severity-trigger' || message.includes('failed') || message.includes('crash')) {
      return 'service-recovery';
    }

    if (
      type === 'service-degradation' ||
      type === 'threshold-breach' ||
      message.includes('timeout')
    ) {
      return 'performance-remediation';
    }

    return 'manual-triage';
  }
}

module.exports = ResponsePlanner;
