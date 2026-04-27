/**
 * ============================================================================
 * SEVERITY CLASSIFIER â€” Risk Assessment Service
 * ============================================================================
 * Assigns a severity grade (CRITICAL / HIGH / MEDIUM / LOW) to each LogEntry.
 *
 * FLOW:
 *   1. Try the structured ML classifier when the parsed entry contains enough
 *      anomaly-style fields to match the trained model schema.
 *   2. Fall back to the rule-based classifier for generic log lines or when
 *      the ML service is unavailable / low-confidence.
 * ============================================================================
 */

const { severityMap, keywordWeights, frequencyRules } = require('../../config/rules');
const { SEVERITY } = require('../../../../shared/constants');
const MLClassifierClient = require('./MLClassifierClient');
const config = require('../../config/env');

const STRUCTURED_FIELD_ALIASES = Object.freeze({
  anomaly_type: ['anomaly_type', 'Anomaly_Type', 'anomalyType'],
  status: ['status', 'Status'],
  cpu_usage: ['cpu_usage', 'CPU_Usage_Percent', 'cpuUsage'],
  memory_usage: ['memory_usage', 'Memory_Usage_MB', 'memoryUsage'],
  disk_usage: ['disk_usage', 'Disk_Usage_Percent', 'diskUsage'],
  response_time_ms: ['response_time_ms', 'Response_Time_ms', 'responseTimeMs', 'latency_ms'],
  login_attempts: ['login_attempts', 'Login_Attempts', 'loginAttempts'],
  failed_transactions: ['failed_transactions', 'Failed_Transactions', 'failedTransactions'],
  retry_count: ['retry_count', 'Retry_Count', 'retryCount'],
  alert_method: ['alert_method', 'Alert_Method', 'alertMethod'],
  service_type: ['service_type', 'Service_Type', 'serviceType'],
});

const CATEGORICAL_ML_FIELDS = Object.freeze([
  'anomaly_type',
  'status',
  'alert_method',
  'service_type',
]);

const NUMERIC_ML_FIELDS = Object.freeze([
  'cpu_usage',
  'memory_usage',
  'disk_usage',
  'response_time_ms',
  'login_attempts',
  'failed_transactions',
  'retry_count',
]);

const MIN_STRUCTURED_NUMERIC_SIGNALS = 3;
const MIN_STRUCTURED_CATEGORICAL_SIGNALS = 2;

class SeverityClassifier {
  constructor({ mlEnabled = config.ML_ENABLED, mlClient } = {}) {
    this.levelMap = severityMap;
    this.keywords = keywordWeights;
    this.frequencyRules = frequencyRules;
    this.recentEvents = new Map();

    this.mlEnabled = Boolean(mlEnabled);
    this.mlClient = mlClient || new MLClassifierClient({
      url: config.ML_SERVICE_URL,
      timeoutMs: config.ML_TIMEOUT_MS,
      confidenceThreshold: config.ML_CONFIDENCE_THRESHOLD,
    });
  }

  reset() {
    this.recentEvents.clear();
  }

  /**
   * @param {import('../../models/LogEntry')} entry
   * @returns {Promise<string>}
   */
  async classify(entry) {
    const mlSeverity = await this._classifyWithMl(entry);
    if (mlSeverity) {
      return mlSeverity;
    }

    return this._classifyWithRules(entry);
  }

  /**
   * @param {import('../../models/LogEntry')[]} entries
   * @returns {Promise<Object>}
   */
  async classifyAll(entries) {
    const breakdown = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

    for (const entry of entries) {
      const severity = await this.classify(entry);
      breakdown[severity] = (breakdown[severity] || 0) + 1;
    }

    return breakdown;
  }

  async _classifyWithMl(entry) {
    if (!this.mlEnabled) {
      return null;
    }

    const payload = this._buildStructuredPayload(entry);
    if (!payload) {
      return null;
    }

    try {
      const prediction = await this.mlClient.classifyStructured(payload);
      const label = this._normalizeMlSeverity(prediction?.label);
      if (!label) {
        return null;
      }

      if (
        typeof prediction?.confidence !== 'number' ||
        prediction.confidence < this.mlClient.confidenceThreshold
      ) {
        return null;
      }

      entry.severity = label;
      entry.mlConfidence = prediction.confidence;
      entry.mlScores = prediction.scores || {};
      entry.classifiedBy = 'ml';
      return label;
    } catch {
      return null;
    }
  }

  _classifyWithRules(entry) {
    delete entry.mlConfidence;
    delete entry.mlScores;

    const level = entry.level?.toUpperCase();
    const baseSeverity = this.levelMap[level] || SEVERITY.LOW;
    const baseScore = this._getBaseScore(baseSeverity);
    const keywordScore = this._getKeywordScore(entry.message);
    const frequencyBoost = this._getFrequencyBoost(entry);
    const totalScore = baseScore + keywordScore + frequencyBoost;
    const severity = this._scoreToSeverity(totalScore);

    entry.severity = severity;
    entry.classifiedBy = 'rules';
    return severity;
  }

  _buildStructuredPayload(entry) {
    const metadata = this._getMetadata(entry);
    const sources = [entry, metadata];
    const payload = {};
    let categoricalSignals = 0;
    let numericSignals = 0;

    for (const field of CATEGORICAL_ML_FIELDS) {
      const value = this._pickText(sources, STRUCTURED_FIELD_ALIASES[field]);
      if (value) {
        payload[field] = value;
        categoricalSignals += 1;
      }
    }

    for (const field of NUMERIC_ML_FIELDS) {
      const value = this._pickNumber(sources, STRUCTURED_FIELD_ALIASES[field]);
      if (Number.isFinite(value)) {
        payload[field] = value;
        numericSignals += 1;
      }
    }

    // Avoid sending generic raw logs or lightly-inferred payloads to the
    // tabular model. It performs best only when the parsed entry really looks
    // like the anomaly dataset it was trained on.
    if (
      numericSignals < MIN_STRUCTURED_NUMERIC_SIGNALS ||
      categoricalSignals < MIN_STRUCTURED_CATEGORICAL_SIGNALS
    ) {
      return null;
    }

    if (entry?.source) {
      payload.source = entry.source;
    }
    if (entry?.message) {
      payload.message = entry.message;
    }
    if (entry?.level) {
      payload.level = entry.level;
    }

    return payload;
  }

  _getMetadata(entry) {
    return entry?.metadata && typeof entry.metadata === 'object' ? entry.metadata : {};
  }

  _pickText(sources, keys) {
    for (const source of sources) {
      if (!source) continue;
      for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }
    return null;
  }

  _pickNumber(sources, keys) {
    for (const source of sources) {
      if (!source) continue;
      for (const key of keys) {
        const value = source[key];
        const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
    return null;
  }

  _normalizeMlSeverity(label) {
    const normalized = String(label || '').trim().toUpperCase();
    return Object.values(SEVERITY).includes(normalized) ? normalized : null;
  }

  _getBaseScore(baseSeverity) {
    const scoreMap = {
      [SEVERITY.CRITICAL]: 8,
      [SEVERITY.HIGH]: 5,
      [SEVERITY.MEDIUM]: 3,
      [SEVERITY.LOW]: 1,
    };
    return scoreMap[baseSeverity] || 1;
  }

  _getKeywordScore(message) {
    const msg = (message || '').toLowerCase();
    let score = 0;

    for (const [keyword, weight] of Object.entries(this.keywords)) {
      if (msg.includes(keyword)) {
        score += weight;
      }
    }

    return score;
  }

  _getFrequencyBoost(entry) {
    const key = `${entry.source || 'unknown'}:${entry.level || 'INFO'}`;
    const eventTime = this._getEventTime(entry);
    const windowMs = (this.frequencyRules.windowSeconds || 120) * 1000;
    const recent = this.recentEvents.get(key) || [];
    const updated = recent.filter((timestamp) => eventTime - timestamp < windowMs);
    updated.push(eventTime);
    this.recentEvents.set(key, updated);

    let boost = 0;
    for (const rule of this.frequencyRules.thresholds) {
      if (updated.length >= rule.count) {
        boost = Math.max(boost, rule.boost);
      }
    }
    return boost;
  }

  _getEventTime(entry) {
    const parsed = Date.parse(entry.timestamp);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  _scoreToSeverity(score) {
    if (score >= 8) return SEVERITY.CRITICAL;
    if (score >= 5) return SEVERITY.HIGH;
    if (score >= 3) return SEVERITY.MEDIUM;
    return SEVERITY.LOW;
  }
}

module.exports = SeverityClassifier;
