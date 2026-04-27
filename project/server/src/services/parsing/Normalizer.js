class Normalizer {
  normalize(parsed) {
    if (!parsed) return null;
    return {
      timestamp: parsed.timestamp || new Date().toISOString(),
      level: this.normalizeLevel(parsed.level),
      source: parsed.source || 'unknown',
      message: parsed.message || '',
      rawLine: parsed.rawLine || '',
      metadata: parsed.metadata || {},
      parsedAt: new Date().toISOString()
    };
  }

  normalizeLevel(level) {
    const aliases = {
      FATAL: 'CRITICAL',
      SEVERE: 'CRITICAL',
      WARN: 'WARNING',
      ERR: 'ERROR'
    };
    const upperLevel = (level || 'INFO').toString().toUpperCase();
    return aliases[upperLevel] || upperLevel;
  }
}

module.exports = Normalizer;
