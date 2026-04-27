class SyslogParser {
  parse(line) {
    const match = line.match(/^<(\d+)>\d?\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
    if (!match) return null;
    const priority = parseInt(match[1]);
    return {
      timestamp: match[2],
      level: this.priorityToLevel(priority % 8),
      source: match[4],
      message: match[6],
      rawLine: line,
      metadata: { facility: Math.floor(priority / 8), host: match[3] }
    };
  }

  priorityToLevel(severity) {
    const map = {
      0: 'CRITICAL', // Emergency
      1: 'CRITICAL', // Alert
      2: 'CRITICAL', // Critical
      3: 'ERROR',    // Error
      4: 'WARNING',  // Warning
      5: 'INFO',     // Notice
      6: 'INFO',     // Informational
      7: 'DEBUG'     // Debug
    };
    return map[severity] || 'INFO';
  }
}

module.exports = SyslogParser;
