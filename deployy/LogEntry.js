class IncidentDetector {
  static isIncident(entry, severity) {
    if (severity.toUpperCase() === "HIGH") {
      return true;
    }

    if (severity.toUpperCase() === "MEDIUM") {
      const message = entry.message.toLowerCase();

      if (
        message.includes("failed") ||
        message.includes("unauthorized") ||
        message.includes("suspicious") ||
        message.includes("multiple")
      ) {
        return true;
      }
    }

    return false;
  }
}

module.exports = IncidentDetector;
