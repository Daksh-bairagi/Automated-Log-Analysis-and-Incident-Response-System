class LogEntry {
  constructor(timestamp, level, source, message) {
    this.timestamp = timestamp;
    this.level = level;
    this.source = source;
    this.message = message;
  }

  toString() {
    return `[${this.timestamp}] [${this.level}] [${this.source}] ${this.message}`;
  }
}

module.exports = LogEntry;
