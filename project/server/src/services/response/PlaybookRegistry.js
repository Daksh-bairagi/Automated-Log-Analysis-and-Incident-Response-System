class PlaybookRegistry {
  constructor(playbooksConfig) {
    this.playbooks = playbooksConfig;
  }

  get(name) {
    return this.playbooks[name] || this.playbooks['manual-triage'];
  }

  getPlaybook(type) {
    return this.get(type);
  }
}

module.exports = PlaybookRegistry;
