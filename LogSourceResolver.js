const path = require("path");
const AnalysisEngine = require("../services/AnalysisEngine");
const ValidationService = require("./ValidationService");

class LogSourceResolver {
  constructor({
    analysisEngine = AnalysisEngine,
    validationService = ValidationService
  } = {}) {
    this.analysisEngine = analysisEngine;
    this.validationService = validationService;
  }

  static getArgValue(args, key) {
    const argument = args.find((item) => item.startsWith(key));
    if (!argument) {
      return "";
    }

    return argument.slice(key.length).trim();
  }

  static parseScriptedAnswers(args) {
    const rawValue = this.getArgValue(args, "--script=");
    return ValidationService.normalizeCsv(rawValue);
  }

  resolve({
    logDir,
    logFiles,
    sampleLogDirectory,
    generatedLogDirectory
  }) {
    const customLogDirectory = this.validationService.normalizeText(logDir);
    const normalizedLogFiles = this.validationService.normalizeCsv(logFiles);
    this.validationService.validateLogFileNames(normalizedLogFiles);

    const resolvedCustomDirectory = customLogDirectory
      ? path.resolve(customLogDirectory)
      : "";
    const resolvedSampleDirectory = path.resolve(sampleLogDirectory);
    const resolvedGeneratedDirectory = path.resolve(generatedLogDirectory);
    const effectiveDirectory = resolvedCustomDirectory || resolvedSampleDirectory;

    if (normalizedLogFiles.length > 0) {
      const resolvedPaths = normalizedLogFiles.map((fileName) => (
        path.isAbsolute(fileName)
          ? fileName
          : path.resolve(effectiveDirectory, fileName)
      ));
      return this.validationService.ensureFilePathArray(resolvedPaths);
    }

    if (resolvedCustomDirectory) {
      const discovered = this.analysisEngine.discoverLogFiles(resolvedCustomDirectory);
      if (discovered.length === 0) {
        throw new Error(`No .log files found in directory: ${resolvedCustomDirectory}`);
      }
      return this.validationService.ensureFilePathArray(discovered);
    }

    try {
      const generatedLogs = this.analysisEngine.discoverLogFiles(resolvedGeneratedDirectory);
      if (generatedLogs.length > 0) {
        return this.validationService.ensureFilePathArray(generatedLogs);
      }
    } catch (error) {
      // Ignore generated directory errors and fall back to sample logs.
    }

    const defaults = this.analysisEngine.defaultLogFiles(resolvedSampleDirectory);
    return this.validationService.ensureFilePathArray(defaults);
  }
}

module.exports = LogSourceResolver;
