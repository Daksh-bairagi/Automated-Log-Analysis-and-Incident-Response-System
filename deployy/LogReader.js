const LogEntry = require("./LogEntry");

class LogParser {
  static parseLogLine(logLine) {
    const parts = logLine.trim().split(/\s+/);

    if (parts.length < 5) {
      throw new Error(`Invalid log format: ${logLine}`);
    }

    const timestamp = `${parts[0]} ${parts[1]}`;
    const level = parts[2];
    const source = parts[3];
    const message = parts.slice(4).join(" ");

    return new LogEntry(timestamp, level, source, message);
  }
}

module.exports = LogParser;
