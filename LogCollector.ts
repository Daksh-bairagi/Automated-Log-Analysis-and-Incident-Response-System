/**
 * LogCollector.ts
 * 
 * Collects logs from various sources (application servers, system servers)
 * Handles real-time log ingestion, validation, and basic storage
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

enum LogSourceType {
  APPLICATION = 'APPLICATION',
  SYSTEM = 'SYSTEM',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE'
}

interface LogMetadata {
  hostname?: string;
  ipAddress?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

interface LogSource {
  sourceId: string;
  sourceName: string;
  sourceType: LogSourceType;
  endpoint: string;
  isActive: boolean;
  pollInterval: number; // in milliseconds
}

interface CollectionStats {
  totalLogsCollected: number;
  logsPerSecond: number;
  errorCount: number;
  lastCollectionTime: Date;
  activeSourcesCount: number;
}

// ============================================================================
// LOG CLASS
// ============================================================================

class Log {
  private logId: string;
  private timestamp: Date;
  private source: string;
  private logLevel: LogLevel;
  private message: string;
  private metadata: LogMetadata;
  private ipAddress: string;
  private userId?: string;
  private isProcessed: boolean;

  constructor(
    source: string,
    logLevel: LogLevel,
    message: string,
    metadata: LogMetadata = {},
    ipAddress: string = 'unknown'
  ) {
    this.logId = uuidv4();
    this.timestamp = new Date();
    this.source = source;
    this.logLevel = logLevel;
    this.message = message;
    this.metadata = metadata;
    this.ipAddress = ipAddress;
    this.userId = metadata.userId;
    this.isProcessed = false;
  }

  // PUBLIC GETTERS
  public getId(): string { return this.logId; }
  public getTimestamp(): Date { return this.timestamp; }
  public getSource(): string { return this.source; }
  public getMessage(): string { return this.message; }
  public getLogLevel(): LogLevel { return this.logLevel; }
  public getMetadata(): LogMetadata { return { ...this.metadata }; }
  public getIpAddress(): string { return this.ipAddress; }
  public getUserId(): string | undefined { return this.userId; }
  public isLogProcessed(): boolean { return this.isProcessed; }

  // PUBLIC METHODS
  public markAsProcessed(): void {
    this.isProcessed = true;
  }

  // PRIVATE METHODS
  private sanitizeData(): void {
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    sensitiveFields.forEach(field => {
      if (this.metadata[field]) this.metadata[field] = '[REDACTED]';
    });
    this.message = this.message.replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]');
  }

  // SERIALIZATION
  public toJSON(): object {
    this.sanitizeData();
    return {
      logId: this.logId,
      timestamp: this.timestamp.toISOString(),
      source: this.source,
      logLevel: this.logLevel,
      message: this.message,
      metadata: this.metadata,
      ipAddress: this.ipAddress,
      userId: this.userId,
      isProcessed: this.isProcessed
    };
  }
}

// ============================================================================
// LOG COLLECTOR CLASS
// ============================================================================

class LogCollector extends EventEmitter {
  private collectorId: string;
  private sources: Map<string, LogSource>;
  private isActive: boolean;
  private collectionRate: number;
  private stats: CollectionStats;
  private collectionIntervals: Map<string, NodeJS.Timeout>;
  private collectedLogs: Log[];
  private readonly MAX_BUFFER_SIZE = 1000;

  constructor(collectionRate: number = 1000) {
    super();
    this.collectorId = uuidv4();
    this.sources = new Map();
    this.isActive = false;
    this.collectionRate = collectionRate;
    this.collectionIntervals = new Map();
    this.collectedLogs = [];

    this.stats = {
      totalLogsCollected: 0,
      logsPerSecond: 0,
      errorCount: 0,
      lastCollectionTime: new Date(),
      activeSourcesCount: 0
    };
  }

  // SOURCE MANAGEMENT
  public addSource(source: LogSource): boolean {
    if (this.sources.has(source.sourceId)) return false;
    this.sources.set(source.sourceId, source);
    if (this.isActive && source.isActive) this.startSourceCollection(source);
    this.emit('sourceAdded', source);
    return true;
  }

  public removeSource(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    if (!source) return false;
    this.stopSourceCollection(sourceId);
    this.sources.delete(sourceId);
    this.emit('sourceRemoved', source);
    return true;
  }

  // COLLECTION CONTROL
  public startCollection(): void {
    this.isActive = true;
    this.sources.forEach(source => {
      if (source.isActive) this.startSourceCollection(source);
    });
    this.emit('collectionStarted');
  }

  public stopCollection(): void {
    this.isActive = false;
    this.collectionIntervals.forEach(interval => clearInterval(interval));
    this.collectionIntervals.clear();
    this.emit('collectionStopped');
  }

  private startSourceCollection(source: LogSource): void {
    const interval = setInterval(() => this.collectFromSource(source), source.pollInterval);
    this.collectionIntervals.set(source.sourceId, interval);
  }

  private stopSourceCollection(sourceId: string): void {
    const interval = this.collectionIntervals.get(sourceId);
    if (interval) {
      clearInterval(interval);
      this.collectionIntervals.delete(sourceId);
    }
  }

  // LOG COLLECTION
  public collectLogs(): Log[] {
    const logs = [...this.collectedLogs];
    this.collectedLogs = [];
    return logs;
  }

  private collectFromSource(source: LogSource): void {
    const newLogs = this.fetchLogsFromSource(source);
    const validLogs = newLogs.filter(log => this.validateLogFormat(log));
    this.collectedLogs.push(...validLogs);
    
    if (this.collectedLogs.length > this.MAX_BUFFER_SIZE) {
      this.collectedLogs.splice(0, this.collectedLogs.length - this.MAX_BUFFER_SIZE);
    }

    this.stats.totalLogsCollected += validLogs.length;
    validLogs.forEach(log => this.emit('logCollected', log));
  }

  private fetchLogsFromSource(source: LogSource): Log[] {
    const logs: Log[] = [];
    const logCount = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < logCount; i++) {
      const logLevel = this.generateRandomLogLevel(source.sourceType);
      const message = this.generateLogMessage(source.sourceType);
      const metadata: LogMetadata = {
        hostname: `${source.sourceName}-host`,
        ipAddress: this.generateRandomIP(),
        requestId: uuidv4()
      };
      logs.push(new Log(source.sourceName, logLevel, message, metadata, metadata.ipAddress));
    }
    return logs;
  }

  // VALIDATION
  private validateLogFormat(log: Log): boolean {
    return log.getMessage().trim() !== '' && log.getSource().trim() !== '';
  }

  // STATISTICS
  public getCollectionStats(): CollectionStats {
    return { ...this.stats };
  }

  // UTILITIES
  private generateRandomLogLevel(sourceType: LogSourceType): LogLevel {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARNING, LogLevel.ERROR];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private generateLogMessage(sourceType: LogSourceType): string {
    const messages = ['User login', 'API call', 'Database query', 'Cache hit'];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private generateRandomIP(): string {
    return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  public shutdown(): void {
    this.stopCollection();
    this.sources.clear();
    this.collectedLogs = [];
    this.removeAllListeners();
  }
}

export { LogCollector, Log, LogSource, LogLevel, LogSourceType, LogMetadata, CollectionStats };
