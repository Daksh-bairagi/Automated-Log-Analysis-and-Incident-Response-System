class FormatDetector {
  constructor(formatConfig) {
    this.formatConfig = formatConfig;
  }

  detect(sampleLines) {
    const samples = sampleLines.slice(0, 5).filter(Boolean);
    if (samples.length === 0) return 'generic';

    for (const format of this.formatConfig.detectionOrder) {
      const matchCount = samples.filter((l) => this.formatConfig.patterns[format].test(l)).length;
      if (matchCount / samples.length > 0.6) {
        return format;
      }
    }
    return 'generic';
  }
}

module.exports = FormatDetector;
