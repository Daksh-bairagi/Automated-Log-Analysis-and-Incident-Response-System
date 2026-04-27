class ApacheParser {
  parse(line) {
    const match = line.match(/^(\S+)\s+\S+\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)[^"]*"\s+(\d+)\s+(\d+)/);
    if (!match) return null;
    const status = parseInt(match[6]);
    let level = 'INFO';
    if (status >= 500) level = 'ERROR';
    else if (status >= 400) level = 'WARNING';
    
    return {
      timestamp: match[3],
      level,
      source: 'http',
      message: `${match[4]} ${match[5]} → ${status}`,
      rawLine: line,
      metadata: { ip: match[1], user: match[2], method: match[4], path: match[5], status, bytes: match[7] }
    };
  }
}

module.exports = ApacheParser;
