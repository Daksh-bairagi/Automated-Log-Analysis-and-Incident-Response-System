class GenericParser {
  parse(line) {
    if (!line || typeof line !== 'string' || line.trim().length === 0) return null;
    return {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      source: 'unknown',
      message: line.trim(),
      rawLine: line
    };
  }
}

module.exports = GenericParser;
