class JsonLogParser {
  parse(line) {
    try {
      const obj = JSON.parse(line);
      return {
        timestamp: obj.timestamp || obj.time || 'unknown',
        level: (obj.level || 'INFO').toUpperCase(),
        source: obj.service || obj.source || 'unknown',
        message: obj.message || obj.msg || '',
        rawLine: line,
        metadata: obj
      };
    } catch {
      return null;
    }
  }
}

module.exports = JsonLogParser;
