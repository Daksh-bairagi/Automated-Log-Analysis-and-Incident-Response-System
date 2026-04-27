'use strict';
const ParserFactory = require('../../../src/services/parsing/ParserFactory');
const FormatDetector = require('../../../src/services/parsing/FormatDetector');
const parserFormats = require('../../../src/config/parserFormats');

describe('ParserFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new ParserFactory();
  });

  test('returns SpaceDelimitedParser for "spaceDelimited" format', () => {
    const parser = factory.getParser('spaceDelimited');
    expect(parser).toBeDefined();
    expect(typeof parser.parse).toBe('function');
  });

  test('returns JsonLogParser for "json" format', () => {
    const parser = factory.getParser('json');
    expect(parser).toBeDefined();
    const result = parser.parse('{"timestamp":"2026-04-06T09:00:00Z","level":"error","service":"auth","msg":"DB error"}');
    expect(result).not.toBeNull();
    expect(result.level).toBeDefined();
  });

  test('returns SyslogParser for "syslog" format', () => {
    const parser = factory.getParser('syslog');
    expect(parser).toBeDefined();
  });

  test('returns ApacheParser for "apache" format', () => {
    const parser = factory.getParser('apache');
    expect(parser).toBeDefined();
  });

  test('returns GenericParser for "generic" format', () => {
    const parser = factory.getParser('generic');
    expect(parser).toBeDefined();
  });

  test('returns GenericParser for unknown format', () => {
    const parser = factory.getParser('unknown-format-xyz');
    expect(parser).toBeDefined();
    expect(typeof parser.parse).toBe('function');
  });
});

describe('FormatDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new FormatDetector(parserFormats);
  });

  test('detects json format from JSON log lines', () => {
    const lines = [
      '{"timestamp":"2026-04-06T09:00:00Z","level":"info","service":"auth","msg":"ok"}',
      '{"timestamp":"2026-04-06T09:01:00Z","level":"error","service":"db","msg":"fail"}',
    ];
    expect(detector.detect(lines)).toBe('json');
  });

  test('detects syslog format from syslog lines', () => {
    const lines = [
      '<34>1 2026-04-06T09:00:00Z webserver01 nginx 1234 - GET /health 200',
      '<27>1 2026-04-06T09:01:00Z dbserver01 postgresql 5678 - FATAL: connections',
    ];
    expect(detector.detect(lines)).toBe('syslog');
  });

  test('detects apache format from Apache log lines', () => {
    const lines = [
      '192.168.1.100 - admin [06/Apr/2026:09:00:00 +0000] "GET /api HTTP/1.1" 200 1234',
      '192.168.1.101 - - [06/Apr/2026:09:01:00 +0000] "POST /login HTTP/1.1" 401 89',
    ];
    expect(detector.detect(lines)).toBe('apache');
  });

  test('detects spaceDelimited format from space-delimited log lines', () => {
    const lines = [
      '2026-04-06 09:00:00 INFO system Service started successfully',
      '2026-04-06 09:01:00 ERROR auth Login failed for user admin',
    ];
    expect(detector.detect(lines)).toBe('spaceDelimited');
  });

  test('returns "generic" for unrecognized format', () => {
    const lines = ['random unstructured log line', 'another weird line'];
    expect(detector.detect(lines)).toBe('generic');
  });

  test('returns "generic" for empty lines array', () => {
    expect(detector.detect([])).toBe('generic');
  });
});
