const path = require("path");

class ValidationService {
  static parsePort(rawPort, defaultPort = 3000) {
    const value = this.normalizeText(rawPort);
    if (!value) {
      return defaultPort;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
      throw new Error(`Invalid port: ${rawPort}`);
    }

    return parsed;
  }

  static normalizeText(value) {
    if (value === undefined || value === null) {
      return "";
    }

    return String(value).trim();
  }

  static normalizeCsv(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeText(item)).filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => this.normalizeText(item))
        .filter(Boolean);
    }

    return [];
  }

  static validateLogFileNames(fileNames) {
    for (const fileName of fileNames) {
      const extension = path.extname(fileName).toLowerCase();
      if (extension !== ".log") {
        throw new Error(`Only .log files are allowed: ${fileName}`);
      }
    }
  }

  static ensureFilePathArray(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error("No log files were resolved for analysis.");
    }

    const normalized = filePaths
      .map((item) => this.normalizeText(item))
      .filter(Boolean);

    if (normalized.length === 0) {
      throw new Error("No valid log file paths were provided.");
    }

    return [...new Set(normalized)];
  }

  static normalizeSeverity(value) {
    const normalized = this.normalizeText(value).toUpperCase();
    if (!normalized) {
      return "ALL";
    }

    if (["ALL", "HIGH", "MEDIUM", "LOW"].includes(normalized)) {
      return normalized;
    }

    throw new Error(`Invalid severity filter: ${value}`);
  }
}

module.exports = ValidationService;
