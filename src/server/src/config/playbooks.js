module.exports = {
  'security-containment': {
    priority: 'P1',
    estimatedMinutes: 15,
    actions: [
      'Isolate affected systems',
      'Block source IPs',
      'Revoke credentials',
      'Capture forensic snapshots',
      'Review audit logs',
      'Notify security lead'
    ]
  },
  'cascade-recovery': {
    priority: 'P1',
    estimatedMinutes: 20,
    actions: [
      'Identify root service',
      'Check shared dependencies',
      'Restart in order',
      'Enable circuit breakers',
      'Scale up healthy instances',
      'Monitor 30min'
    ]
  },
  'service-recovery': {
    priority: 'P2',
    estimatedMinutes: 30,
    actions: [
      'Check health endpoints',
      'Review recent deployments',
      'Restart services',
      'Check CPU/memory/disk',
      'Enable verbose logging',
      'Create post-mortem ticket'
    ]
  },
  'performance-remediation': {
    priority: 'P3',
    estimatedMinutes: 45,
    actions: [
      'Check network latency',
      'Review DB queries',
      'Check connection pools',
      'Scale up resources',
      'Add caching',
      'Setup performance alerts'
    ]
  },
  'manual-triage': {
    priority: 'P4',
    estimatedMinutes: 60,
    actions: [
      'Assign to on-call',
      'Gather context',
      'Determine root cause',
      'Escalate if unresolved'
    ]
  }
};
