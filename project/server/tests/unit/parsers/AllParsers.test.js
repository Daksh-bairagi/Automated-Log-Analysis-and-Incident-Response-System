'use strict';
const SpaceDelimitedParser = require('../../../src/services/parsing/parsers/SpaceDelimitedParser');
const JsonLogParser = require('../../../src/services/parsing/parsers/JsonLogParser');
const SyslogParser = require('../../../src/services/parsing/parsers/SyslogParser');
const ApacheParser = require('../../../src/services/parsing/parsers/ApacheParser');
const GenericParser = require('../../../src/services/parsing/parsers/GenericParser');

// ============================================================================
// SpaceDelimitedParser
// ============================================================================
describe('SpaceDelimitedParser', () => {
  let parser;
  beforeEach(() => { parser = new SpaceDelimitedParser(); });

  test('parses valid space-delimited log line', () => {
    const line = '2026-04-06 09:00:00 ERROR auth-service Login failed for user admin';
    const result = parser.parse(line);
    expect(result).not.toBeNull();
    expect(result.level).toBe('ERROR');
    expect(result.source).toBe('auth-service');
    expect(result.message).toContain('Login failed');
  });

  test('returns null for line with fewer than 5 tokens', () => {
    expect(parser.parse('2026-04-06 09:00:00 ERROR')).toBeNull();
  });

  test('sets rawLine on result', () => {
    const line = '2026-04-06 09:00:00 INFO sys Service started ok';
    const result = parser.parse(line);
    expect(result.rawLine).toBe(line);
  });

  test('normalizes level to uppercase', () => {
    const line = '2026-04-06 09:00:00 warning api-gw Slow response';
    const result = parser.parse(line);
    expect(result.level).toBe('WARNING');
  });
});

// ============================================================================
// JsonLogParser
// ============================================================================
describe('JsonLogParser', () => {
  let parser;
  beforeEach(() => { parser = new JsonLogParser(); });

  test('parses valid JSON log line with "msg" field', () => {
    const line = '{"timestamp":"2026-04-06T09:00:00Z","level":"error","service":"order-service","msg":"DB refused"}';
    const result = parser.parse(line);
    expect(result).not.toBeNull();
    expect(result.level).toBe('ERROR');
    expect(result.source).toBe('order-service');
    expect(result.message).toBe('DB refused');
  });

  test('parses JSON log with "message" field', () => {
    const line = '{"timestamp":"2026-04-06T09:01:00Z","level":"info","service":"cache","message":"Hit ratio ok"}';
    const result = parser.parse(line);
    expect(result.message).toBe('Hit ratio ok');
  });

  test('returns null for non-JSON line', () => {
    expect(parser.parse('not json at all')).toBeNull();
  });

  test('attaches full object as metadata', () => {
    const line = '{"timestamp":"2026-04-06T09:00:00Z","level":"warn","service":"net","msg":"high latency","latencyMs":350}';
    const result = parser.parse(line);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.latencyMs).toBe(350);
  });
});

// ============================================================================
// SyslogParser
// ============================================================================
describe('SyslogParser', () => {
  let parser;
  beforeEach(() => { parser = new SyslogParser(); });

  test('parses valid syslog line', () => {
    const line = '<34>1 2026-04-06T09:00:00Z webserver01 nginx 1234 - GET /api/health 200 12ms';
    const result = parser.parse(line);
    expect(result).not.toBeNull();
    expect(result.source).toBe('nginx');
    expect(result.timestamp).toBeTruthy();
  });

  test('returns null for non-syslog line', () => {
    expect(parser.parse('completely unrelated line')).toBeNull();
  });

  test('attaches metadata with host information', () => {
    const line = '<27>1 2026-04-06T09:01:00Z dbserver01 postgresql 5678 - FATAL: too many connections';
    const result = parser.parse(line);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.host).toBe('dbserver01');
  });
});

// ============================================================================
// ApacheParser
// ============================================================================
describe('ApacheParser', () => {
  let parser;
  beforeEach(() => { parser = new ApacheParser(); });

  test('parses valid Apache combined log format', () => {
    const line = '192.168.1.100 - admin [06/Apr/2026:09:00:00 +0000] "GET /api/users HTTP/1.1" 200 1234';
    const result = parser.parse(line);
    expect(result).not.toBeNull();
    expect(result.level).toBe('INFO');
    expect(result.metadata.ip).toBe('192.168.1.100');
    expect(result.metadata.status).toBe(200);
  });

  test('maps 4xx status to WARNING level', () => {
    const line = '192.168.1.101 - - [06/Apr/2026:09:01:00 +0000] "POST /login HTTP/1.1" 401 89';
    const result = parser.parse(line);
    expect(result.level).toBe('WARNING');
  });

  test('maps 5xx status to ERROR level', () => {
    const line = '192.168.1.102 - - [06/Apr/2026:09:02:00 +0000] "GET /api HTTP/1.1" 500 0';
    const result = parser.parse(line);
    expect(result.level).toBe('ERROR');
  });

  test('returns null for invalid line', () => {
    expect(parser.parse('not apache log')).toBeNull();
  });
});

// ============================================================================
// GenericParser
// ============================================================================
describe('GenericParser', () => {
  let parser;
  beforeEach(() => { parser = new GenericParser(); });

  test('returns a result object for any non-empty line', () => {
    const line = 'some arbitrary log line that fits no pattern';
    const result = parser.parse(line);
    expect(result).not.toBeNull();
    expect(result.rawLine).toBe(line);
  });

  test('returns null for empty or whitespace-only line', () => {
    expect(parser.parse('')).toBeNull();
    expect(parser.parse('   ')).toBeNull();
  });
});
