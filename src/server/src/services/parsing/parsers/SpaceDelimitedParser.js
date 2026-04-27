class SpaceDelimitedParser {
  parse(line) {
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 5) return null;
    return {
      timestamp: tokens[0] + ' ' + tokens[1],
      level: tokens[2].toUpperCase(),
      source: tokens[3],
      message: tokens.slice(4).join(' '),
      rawLine: line
    };
  }
}

module.exports = SpaceDelimitedParser;
