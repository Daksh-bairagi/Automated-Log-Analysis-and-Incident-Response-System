const fs = require("fs");

class LogReader {
  static readLogFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}

module.exports = LogReader;
