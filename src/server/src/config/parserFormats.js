module.exports = {
  patterns: {
    json: {
      test: (line) => {
        try {
          JSON.parse(line);
          return true;
        } catch {
          return false;
        }
      }
    },
    syslog: {
      test: (line) => /^<\d+>/.test(line)
    },
    apache: {
      test: (line) => /^\d+\.\d+\.\d+\.\d+\s+-\s+\S+\s*\[/.test(line)
    },
    spaceDelimited: {
      test: (line) => /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+\w+\s+\w+/.test(line)
    }
  },
  detectionOrder: ['json', 'syslog', 'apache', 'spaceDelimited']
};
