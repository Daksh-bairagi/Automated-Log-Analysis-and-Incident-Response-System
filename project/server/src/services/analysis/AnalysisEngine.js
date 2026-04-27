const LogReader = require('../ingestion/LogReader');
const FormatDetector = require('../parsing/FormatDetector');
const ParserFactory = require('../parsing/ParserFactory');
const Normalizer = require('../parsing/Normalizer');
const parserFormats = require('../../config/parserFormats');
const SeverityClassifier = require('./SeverityClassifier');
const IncidentDetector = require('./IncidentDetector');
const CorrelationEngine = require('./CorrelationEngine');
const ThresholdMonitor = require('./ThresholdMonitor');
const ResponsePlanner = require('../response/ResponsePlanner');
const PlaybookRegistry = require('../response/PlaybookRegistry');
const playbooksConfig = require('../../config/playbooks');
const ReportBuilder = require('../reporting/ReportBuilder');
const IncidentRecord = require('../../models/IncidentRecord');

class AnalysisEngine {
  constructor({
    logReader,
    formatDetector,
    parserFactory,
    normalizer,
    classifier,
    detector,
    correlationEngine,
    thresholdMonitor,
    planner,
    reportBuilder,
  } = {}) {
    this.logReader = logReader || LogReader;
    this.formatDetector = formatDetector || new FormatDetector(parserFormats);
    this.parserFactory = parserFactory || new ParserFactory();
    this.normalizer = normalizer || new Normalizer();
    this.classifier = classifier || new SeverityClassifier();
    this.detector = detector || new IncidentDetector();
    this.correlationEngine = correlationEngine || new CorrelationEngine();
    this.thresholdMonitor = thresholdMonitor || new ThresholdMonitor();
    this.planner = planner || new ResponsePlanner(new PlaybookRegistry(playbooksConfig));
    this.reportBuilder = reportBuilder || new ReportBuilder();
  }

  async analyzeLogs(filePaths) {
    this._resetState();

    const allEntries = [];
    const allIncidents = [];
    const parseErrors = [];
    const fileFormats = {};
    const { fileGroups, readErrors } = this._readSources(filePaths);
    const processedFiles = Object.keys(fileGroups);

    for (const [filePath, lines] of Object.entries(fileGroups)) {
      await this._processSource({
        sourceName: filePath,
        lines,
        entries: allEntries,
        incidents: allIncidents,
        parseErrors,
        fileFormats,
      });
    }

    return this._finalizeResult({
      entries: allEntries,
      incidents: allIncidents,
      parseErrors,
      logFiles: processedFiles,
      fileFormats,
      readErrors,
    });
  }

  async analyzeLineGroups(lineGroups) {
    this._resetState();

    const allEntries = [];
    const allIncidents = [];
    const parseErrors = [];
    const fileFormats = {};
    const sourceNames = Object.keys(lineGroups || {});

    for (const [sourceName, lines] of Object.entries(lineGroups || {})) {
      await this._processSource({
        sourceName,
        lines,
        entries: allEntries,
        incidents: allIncidents,
        parseErrors,
        fileFormats,
      });
    }

    return this._finalizeResult({
      entries: allEntries,
      incidents: allIncidents,
      parseErrors,
      logFiles: sourceNames,
      fileFormats,
      readErrors: [],
    });
  }

  _readSources(filePaths) {
    if (typeof this.logReader.readMultipleFiles === 'function') {
      const result = this.logReader.readMultipleFiles(filePaths) || {};
      if (result.fileGroups || result.errors) {
        return {
          fileGroups: result.fileGroups || {},
          readErrors: result.errors || [],
        };
      }
    }

    const fileGroups = {};
    const readErrors = [];

    for (const filePath of filePaths) {
      try {
        const reader = typeof this.logReader.readFile === 'function'
          ? this.logReader.readFile.bind(this.logReader)
          : ((targetPath) => ({ filePath: targetPath, lines: this.logReader.readLogFile(targetPath) }));
        const file = reader(filePath);
        const sourceName = file?.filePath || filePath;
        fileGroups[sourceName] = file?.lines || [];
      } catch (error) {
        readErrors.push(`Failed to read ${filePath}: ${error.message}`);
      }
    }

    return { fileGroups, readErrors };
  }

  async _processSource({ sourceName, lines, entries, incidents, parseErrors, fileFormats }) {
    const sourceLines = Array.isArray(lines) ? lines.filter(Boolean) : [];
    const format = this.formatDetector.detect(sourceLines.slice(0, 5));
    const parser = this.parserFactory.getParser(format);
    fileFormats[sourceName] = format;

    for (const rawLine of sourceLines) {
      if (!rawLine || !rawLine.trim()) {
        continue;
      }

      const parsed = parser.parse(rawLine);
      if (!parsed) {
        parseErrors.push(rawLine);
        continue;
      }

      const entry = this.normalizer.normalize(parsed);
      entry.severity = await this.classifier.classify(entry);
      entry.incidentDetected = false;

      const single = this.detector.isIncident(entry);
      if (single.isIncident) {
        const incident = new IncidentRecord({
          severity: entry.severity,
          source: entry.source,
          timestamp: entry.timestamp,
          message: entry.message,
          type: single.type,
          reason: single.reason,
        });
        this.planner.plan(incident);
        incidents.push(incident);
        entry.incidentDetected = true;
      }

      for (const hit of this.correlationEngine.analyze(entry)) {
        const incident = new IncidentRecord({
          severity: hit.severity,
          source: hit.triggerEntry.source,
          timestamp: hit.triggerEntry.timestamp,
          message: `Correlated Incident: ${hit.type}`,
          type: hit.type,
          reason: `Correlation rule triggered (${hit.eventCount} events)`,
          eventCount: hit.eventCount,
          metadata: { triggerSource: sourceName },
        });
        this.planner.plan(incident);
        incidents.push(incident);
        entry.incidentDetected = true;
      }

      this.thresholdMonitor.track(entry);
      entries.push(entry);
    }
  }

  _finalizeResult({ entries, incidents, parseErrors, logFiles, fileFormats, readErrors }) {
    for (const breach of this.thresholdMonitor.checkThresholds()) {
      const [, source = 'multi'] = breach.key.split(':');
      const incident = new IncidentRecord({
        severity: breach.severity,
        source,
        timestamp: new Date().toISOString(),
        message: `Threshold Breach: ${breach.key} exceeded limit (${breach.count})`,
        type: breach.type,
        reason: `Threshold reached (${breach.count})`,
        eventCount: breach.count,
      });
      this.planner.plan(incident);
      incidents.push(incident);
    }

    const severityBreakdown = this._buildSeverityBreakdown(entries);
    const report = this.reportBuilder.build({
      entries,
      incidents,
      severityBreakdown,
      files: logFiles,
      parseErrors,
      fileFormats,
    });

    this.thresholdMonitor.reset();

    return {
      entries,
      incidents,
      parseErrors,
      report,
      logFiles,
      readErrors,
    };
  }

  _buildSeverityBreakdown(entries) {
    const breakdown = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const entry of entries) {
      breakdown[entry.severity] = (breakdown[entry.severity] || 0) + 1;
    }
    return breakdown;
  }

  _resetState() {
    IncidentRecord.resetCounter();
    if (typeof this.classifier.reset === 'function') {
      this.classifier.reset();
    }
    if (typeof this.correlationEngine.reset === 'function') {
      this.correlationEngine.reset();
    }
    if (typeof this.thresholdMonitor.reset === 'function') {
      this.thresholdMonitor.reset();
    }
  }
}

module.exports = AnalysisEngine;
