const path = require("path");
const LogReader = require("./LogReader");
const LogParser = require("./LogParser");
const SeverityClassifier = require("./SeverityClassifier");
const IncidentDetector = require("./IncidentDetector");

function processLogFile(filePath) {
  console.log(`\nReading logs from: ${filePath}`);

  const lines = LogReader.readLogFile(filePath);

  for (const line of lines) {
    try {
      const entry = LogParser.parseLogLine(line);
      const severity = SeverityClassifier.classify(entry);
      const incident = IncidentDetector.isIncident(entry, severity);

      console.log(`${entry.toString()} | Severity=${severity} | Incident=${incident}`);
    } catch (error) {
      console.log(`Skipping malformed line: ${line}`);
    }
  }
}

function main() {
  const base = path.join(__dirname, "..", "data", "sample_logs");

  processLogFile(path.join(base, "application.log"));
  processLogFile(path.join(base, "system.log"));
  processLogFile(path.join(base, "security.log"));
}

main();
