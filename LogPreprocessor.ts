/**
 * LogPreprocessor.ts
 * 
 * Preprocesses raw logs: cleans, normalizes, enriches, and validates
 * Prepares logs for analysis by standardizing formats and extracting features
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// ENUMS & INTERFACES
// ============================================================================

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface RawLog {
  logId: string;
  timestamp: Date;
  source: string;
  logLevel: LogLevel;
  message: string;
  metadata: any;
  ipAddress: string;
  userId?: string;
}

interface ProcessedLog extends RawLog {
  normalizedMessage: string;
  tokens: string[];
  features: {
    messageLength: number;
    hasError: boolean;
    hasWarning: boolean;
    containsIP: boolean;
    containsURL: boolean;
    containsEmail: boolean;
    wordCount: number;
    specialCharCount: number;
  };
  enrichedMetadata: {
    ipType?: 'public' | 'private' | 'localhost';
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek?: string;
    isBusinessHours?: boolean;
  };
  isValid: boolean;
  processingTimestamp: Date;
}

interface Filter {
  filterId: string;
  name: string;
  type: 'include' | 'exclude';
  condition: string; // e.g., "source === 'nginx'" or "logLevel === 'DEBUG'"
  isActive: boolean;
}

interface Transformation {
  transformationId: string;
  name: string;
  description: string;
  operation: (log: RawLog) => RawLog;
  isActive: boolean;
}

interface PreprocessingStats {
  totalProcessed: number;
  validLogs: number;
  invalidLogs: number;
  filteredLogs: number;
  transformedLogs: number;
  averageProcessingTime: number; // milliseconds
  lastProcessingTime: Date;
}

// ============================================================================
// LOG PREPROCESSOR CLASS
// ============================================================================

class LogPreprocessor extends EventEmitter {
  private preprocessorId: string;
  private filters: Map<string, Filter>;
  private transformations: Map<string, Transformation>;
  private stats: PreprocessingStats;
  private isActive: boolean;

  constructor() {
    super();
    this.preprocessorId = uuidv4();
    this.filters = new Map();
    this.transformations = new Map();
    this.isActive = true;

    this.stats = {
      totalProcessed: 0,
      validLogs: 0,
      invalidLogs: 0,
      filteredLogs: 0,
      transformedLogs: 0,
      averageProcessingTime: 0,
      lastProcessingTime: new Date()
    };

    this.initializeDefaultTransformations();
    console.log(`[LogPreprocessor ${this.preprocessorId}] Initialized`);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private initializeDefaultTransformations(): void {
    // Trim whitespace transformation
    this.addTransformation({
      transformationId: uuidv4(),
      name: 'Trim Whitespace',
      description: 'Removes leading and trailing whitespace from log messages',
      operation: (log: RawLog) => {
        log.message = log.message.trim();
        return log;
      },
      isActive: true
    });

    // Lowercase source transformation
    this.addTransformation({
      transformationId: uuidv4(),
      name: 'Normalize Source',
      description: 'Converts source name to lowercase',
      operation: (log: RawLog) => {
        log.source = log.source.toLowerCase();
        return log;
      },
      isActive: true
    });

    // Remove duplicate spaces
    this.addTransformation({
      transformationId: uuidv4(),
      name: 'Remove Duplicate Spaces',
      description: 'Replaces multiple spaces with single space',
      operation: (log: RawLog) => {
        log.message = log.message.replace(/\s+/g, ' ');
        return log;
      },
      isActive: true
    });
  }

  // ============================================================================
  // MAIN PREPROCESSING METHOD
  // ============================================================================

  public preprocessLog(log: RawLog): ProcessedLog | null {
    if (!this.isActive) {
      console.warn(`[LogPreprocessor] Preprocessor not active`);
      return null;
    }

    const startTime = Date.now();

    try {
      // Step 1: Apply filters
      if (!this.applyFilters(log)) {
        this.stats.filteredLogs++;
        this.emit('logFiltered', log);
        return null;
      }

      // Step 2: Clean the log
      const cleanedLog = this.cleanData(log);

      // Step 3: Apply transformations
      const transformedLog = this.applyTransformations(cleanedLog);

      // Step 4: Normalize format
      const normalizedLog = this.normalizeFormat(transformedLog);

      // Step 5: Enrich metadata
      const enrichedLog = this.enrichMetadata(normalizedLog);

      // Step 6: Extract features
      const processedLog = this.extractFeatures(enrichedLog);

      // Step 7: Validate
      processedLog.isValid = this.validateLog(processedLog);

      // Update statistics
      this.stats.totalProcessed++;
      if (processedLog.isValid) {
        this.stats.validLogs++;
      } else {
        this.stats.invalidLogs++;
      }

      const processingTime = Date.now() - startTime;
      this.updateAverageProcessingTime(processingTime);
      this.stats.lastProcessingTime = new Date();

      this.emit('logProcessed', processedLog);
      return processedLog;

    } catch (error) {
      console.error(`[LogPreprocessor] Error preprocessing log:`, error);
      this.stats.invalidLogs++;
      this.emit('processingError', { log, error });
      return null;
    }
  }

  public batchPreprocess(logs: RawLog[]): ProcessedLog[] {
    const processedLogs: ProcessedLog[] = [];

    for (const log of logs) {
      const processed = this.preprocessLog(log);
      if (processed) {
        processedLogs.push(processed);
      }
    }

    this.emit('batchProcessed', {
      total: logs.length,
      successful: processedLogs.length,
      filtered: logs.length - processedLogs.length
    });

    return processedLogs;
  }

  // ============================================================================
  // DATA CLEANING
  // ============================================================================

  public cleanData(log: RawLog): RawLog {
    const cleaned = { ...log };

    // Remove null bytes
    cleaned.message = cleaned.message.replace(/\0/g, '');

    // Remove control characters except newlines and tabs
    cleaned.message = cleaned.message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Normalize line endings
    cleaned.message = cleaned.message.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Remove ANSI escape codes (colors in terminal output)
    cleaned.message = cleaned.message.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

    // Sanitize metadata
    if (cleaned.metadata) {
      cleaned.metadata = this.sanitizeMetadata(cleaned.metadata);
    }

    return cleaned;
  }

  private sanitizeMetadata(metadata: any): any {
    const sanitized = { ...metadata };
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'creditCard', 'ssn', 'apiSecret'];

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // ============================================================================
  // NORMALIZATION
  // ============================================================================

  public normalizeFormat(log: RawLog): RawLog {
    const normalized = { ...log };

    // Normalize log level to uppercase
    normalized.logLevel = normalized.logLevel.toUpperCase() as LogLevel;

    // Standardize timestamp
    if (typeof normalized.timestamp === 'string') {
      normalized.timestamp = new Date(normalized.timestamp);
    }

    // Normalize IP address format
    normalized.ipAddress = this.normalizeIPAddress(normalized.ipAddress);

    // Standardize source name
    normalized.source = normalized.source.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '_');

    return normalized;
  }

  private normalizeIPAddress(ip: string): string {
    // Remove leading zeros from IP octets (e.g., 192.168.001.001 -> 192.168.1.1)
    return ip.split('.').map(octet => parseInt(octet, 10).toString()).join('.');
  }

  // ============================================================================
  // METADATA ENRICHMENT
  // ============================================================================

  public enrichMetadata(log: RawLog): ProcessedLog {
    const processedLog = log as ProcessedLog;
    
    processedLog.enrichedMetadata = {
      ipType: this.classifyIPAddress(log.ipAddress),
      timeOfDay: this.getTimeOfDay(log.timestamp),
      dayOfWeek: this.getDayOfWeek(log.timestamp),
      isBusinessHours: this.isBusinessHours(log.timestamp)
    };

    processedLog.processingTimestamp = new Date();
    processedLog.normalizedMessage = this.normalizeMessage(log.message);
    processedLog.tokens = this.tokenizeMessage(processedLog.normalizedMessage);

    return processedLog;
  }

  private classifyIPAddress(ip: string): 'public' | 'private' | 'localhost' {
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return 'localhost';
    }

    const octets = ip.split('.').map(o => parseInt(o, 10));
    
    if (octets[0] === 10) return 'private';
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return 'private';
    if (octets[0] === 192 && octets[1] === 168) return 'private';
    
    return 'public';
  }

  private getTimeOfDay(timestamp: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = timestamp.getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  private getDayOfWeek(timestamp: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[timestamp.getDay()];
  }

  private isBusinessHours(timestamp: Date): boolean {
    const hour = timestamp.getHours();
    const day = timestamp.getDay();
    // Business hours: Monday-Friday, 9 AM - 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  }

  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  private tokenizeMessage(message: string): string[] {
    return message.split(/\s+/).filter(token => token.length > 0);
  }

  // ============================================================================
  // FEATURE EXTRACTION
  // ============================================================================

  private extractFeatures(log: ProcessedLog): ProcessedLog {
    const message = log.message;

    log.features = {
      messageLength: message.length,
      hasError: /error|exception|fail/i.test(message),
      hasWarning: /warn|warning|caution/i.test(message),
      containsIP: /\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(message),
      containsURL: /https?:\/\/[^\s]+/.test(message),
      containsEmail: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(message),
      wordCount: message.split(/\s+/).length,
      specialCharCount: (message.match(/[^a-zA-Z0-9\s]/g) || []).length
    };

    return log;
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  public validateLog(log: ProcessedLog): boolean {
    // Check required fields
    if (!log.message || log.message.trim() === '') {
      console.warn(`[LogPreprocessor] Invalid log: empty message`);
      return false;
    }

    if (!log.source || log.source.trim() === '') {
      console.warn(`[LogPreprocessor] Invalid log: empty source`);
      return false;
    }

    // Validate timestamp
    if (!(log.timestamp instanceof Date) || isNaN(log.timestamp.getTime())) {
      console.warn(`[LogPreprocessor] Invalid log: invalid timestamp`);
      return false;
    }

    // Validate log level
    const validLevels = Object.values(LogLevel);
    if (!validLevels.includes(log.logLevel)) {
      console.warn(`[LogPreprocessor] Invalid log: invalid log level`);
      return false;
    }

    // Check message length (not too short, not too long)
    if (log.message.length < 3 || log.message.length > 10000) {
      console.warn(`[LogPreprocessor] Invalid log: message length out of range`);
      return false;
    }

    return true;
  }

  // ============================================================================
  // FILTERS
  // ============================================================================

  public addFilter(filter: Filter): boolean {
    if (this.filters.has(filter.filterId)) {
      console.warn(`[LogPreprocessor] Filter already exists: ${filter.name}`);
      return false;
    }

    this.filters.set(filter.filterId, filter);
    console.log(`[LogPreprocessor] Added filter: ${filter.name}`);
    this.emit('filterAdded', filter);
    return true;
  }

  public removeFilter(filterId: string): boolean {
    const result = this.filters.delete(filterId);
    if (result) {
      console.log(`[LogPreprocessor] Removed filter: ${filterId}`);
      this.emit('filterRemoved', filterId);
    }
    return result;
  }

  private applyFilters(log: RawLog): boolean {
    for (const filter of this.filters.values()) {
      if (!filter.isActive) continue;

      const shouldInclude = this.evaluateFilterCondition(filter, log);
      
      if (filter.type === 'include' && !shouldInclude) return false;
      if (filter.type === 'exclude' && shouldInclude) return false;
    }
    return true;
  }

  private evaluateFilterCondition(filter: Filter, log: RawLog): boolean {
    try {
      // Simple condition evaluation (in production, use a proper expression evaluator)
      const condition = filter.condition;
      
      if (condition.includes('source')) {
        const match = condition.match(/source\s*===\s*['"]([^'"]+)['"]/);
        if (match) return log.source === match[1];
      }
      
      if (condition.includes('logLevel')) {
        const match = condition.match(/logLevel\s*===\s*['"]([^'"]+)['"]/);
        if (match) return log.logLevel === match[1];
      }

      return true;
    } catch (error) {
      console.error(`[LogPreprocessor] Error evaluating filter:`, error);
      return true;
    }
  }

  // ============================================================================
  // TRANSFORMATIONS
  // ============================================================================

  public addTransformation(transformation: Transformation): boolean {
    if (this.transformations.has(transformation.transformationId)) {
      console.warn(`[LogPreprocessor] Transformation already exists: ${transformation.name}`);
      return false;
    }

    this.transformations.set(transformation.transformationId, transformation);
    console.log(`[LogPreprocessor] Added transformation: ${transformation.name}`);
    this.emit('transformationAdded', transformation);
    return true;
  }

  public removeTransformation(transformationId: string): boolean {
    const result = this.transformations.delete(transformationId);
    if (result) {
      console.log(`[LogPreprocessor] Removed transformation: ${transformationId}`);
      this.emit('transformationRemoved', transformationId);
    }
    return result;
  }

  private applyTransformations(log: RawLog): RawLog {
    let transformedLog = { ...log };

    for (const transformation of this.transformations.values()) {
      if (transformation.isActive) {
        transformedLog = transformation.operation(transformedLog);
        this.stats.transformedLogs++;
      }
    }

    return transformedLog;
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  public getStats(): PreprocessingStats {
    return { ...this.stats };
  }

  public resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      validLogs: 0,
      invalidLogs: 0,
      filteredLogs: 0,
      transformedLogs: 0,
      averageProcessingTime: this.stats.averageProcessingTime,
      lastProcessingTime: new Date()
    };
    console.log(`[LogPreprocessor] Statistics reset`);
  }

  private updateAverageProcessingTime(newTime: number): void {
    const total = this.stats.totalProcessed;
    const currentAvg = this.stats.averageProcessingTime;
    this.stats.averageProcessingTime = (currentAvg * (total - 1) + newTime) / total;
  }

  // ============================================================================
  // CONTROL
  // ============================================================================

  public activate(): void {
    this.isActive = true;
    console.log(`[LogPreprocessor ${this.preprocessorId}] Activated`);
    this.emit('activated');
  }

  public deactivate(): void {
    this.isActive = false;
    console.log(`[LogPreprocessor ${this.preprocessorId}] Deactivated`);
    this.emit('deactivated');
  }

  public shutdown(): void {
    this.deactivate();
    this.filters.clear();
    this.transformations.clear();
    this.removeAllListeners();
    console.log(`[LogPreprocessor ${this.preprocessorId}] Shutdown complete`);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  LogPreprocessor,
  ProcessedLog,
  RawLog,
  Filter,
  Transformation,
  PreprocessingStats,
  LogLevel
};
