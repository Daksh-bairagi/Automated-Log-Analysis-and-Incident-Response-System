/**
 * ============================================================================
 * WHITE-BOX TEST SUITE — LogSourceResolver
 * ============================================================================
 * Tests the file discovery service that resolves which log files to analyze.
 * Implements a 4-strategy fallback chain:
 *
 *   1. Explicit file list → resolve paths
 *   2. Custom directory   → discover .log files
 *   3. Generated logs dir → try ./generated_logs/
 *   4. Default logs dir   → use ./logs/*.log
 *
 * TEST STRATEGY:
 *   - Mock the `fs` module to simulate directory/file states
 *   - Test each resolution strategy in isolation
 *   - Test the fallback cascade when earlier strategies fail
 *   - Verify error conditions (empty directories, no files found)
 *
 * COVERAGE:
 *   ✓ Strategy 1: Explicit logFiles[] resolution
 *   ✓ Strategy 2: Custom logDir directory scanning
 *   ✓ Strategy 3: Generated logs fallback
 *   ✓ Strategy 4: Default log directory fallback
 *   ✓ Error: No log files found anywhere
 *   ✓ Error: Empty custom directory
 *   ✓ Multiple directories (dirs[])
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');
const LogSourceResolver = require('../../src/services/ingestion/LogSourceResolver');

// Mock the fs module for controlled filesystem behavior
jest.mock('fs');

describe('LogSourceResolver', () => {
  let resolver;
  const TEST_LOG_DIR = '/project/logs';

  beforeEach(() => {
    // Reset all fs mocks before each test
    jest.clearAllMocks();
    resolver = new LogSourceResolver({ LOG_DIR: TEST_LOG_DIR });
  });

  // ===========================================================================
  // Strategy 1: Explicit file list
  // ===========================================================================

  describe('resolve() — explicit logFiles[]', () => {
    test('should resolve absolute file paths directly', () => {
      const files = ['/logs/app.log', '/logs/system.log'];

      const result = resolver.resolve({ logFiles: files });

      // Absolute paths should be returned as-is
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('/logs/app.log');
      expect(result[1]).toBe('/logs/system.log');
    });

    test('should resolve relative file paths against the default log directory', () => {
      const files = ['app.log', 'system.log'];

      const result = resolver.resolve({ logFiles: files });

      // Relative paths should be resolved against defaultLogDir
      expect(result).toHaveLength(2);
      for (const filePath of result) {
        expect(path.isAbsolute(filePath)).toBe(true);
      }
    });

    test('should prioritize logFiles over logDir when both provided', () => {
      // Mock: logDir has files, but logFiles should take priority
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['other.log']);

      const result = resolver.resolve({
        logFiles: ['/specific/file.log'],
        logDir: '/other/directory',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('/specific/file.log');
    });
  });

  // ===========================================================================
  // Strategy 2: Custom directory
  // ===========================================================================

  describe('resolve() — custom logDir', () => {
    test('should discover all .log files in the custom directory', () => {
      const customDir = '/custom/logs';
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([
        'application.log',
        'security.log',
        'notes.txt',       // Should be filtered out
        'readme.md',       // Should be filtered out
        'system.log',
      ]);

      const result = resolver.resolve({ logDir: customDir });

      // Only .log files should be included
      expect(result).toHaveLength(3);
      expect(result.every((f) => f.endsWith('.log'))).toBe(true);
    });

    test('should throw error when custom directory has no .log files', () => {
      const customDir = '/empty/logs';
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['readme.txt', 'config.json']);

      expect(() => {
        resolver.resolve({ logDir: customDir });
      }).toThrow('No .log files found');
    });

    test('should return files sorted alphabetically for consistency', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['z-system.log', 'a-app.log', 'm-middleware.log']);

      const result = resolver.resolve({ logDir: '/logs' });

      // Should be alphabetically sorted
      expect(result[0]).toContain('a-app.log');
      expect(result[1]).toContain('m-middleware.log');
      expect(result[2]).toContain('z-system.log');
    });
  });

  // ===========================================================================
  // Strategy 2b: Multiple directories
  // ===========================================================================

  describe('resolve() — multiple dirs[]', () => {
    test('should combine .log files from multiple directories', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync
        .mockReturnValueOnce(['app.log'])
        .mockReturnValueOnce(['security.log']);

      const result = resolver.resolve({
        dirs: ['/dir1', '/dir2'],
      });

      expect(result).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Strategy 3 & 4: Fallback chain
  // ===========================================================================

  describe('resolve() — fallback chain', () => {
    test('should fall back to default log directory when no options provided', () => {
      // Default directory exists and has .log files
      fs.existsSync.mockImplementation((p) => {
        return path.resolve(p) === path.resolve(TEST_LOG_DIR);
      });
      fs.readdirSync.mockReturnValue(['log-01.log', 'log-02.log']);

      const result = resolver.resolve({});

      expect(result).toHaveLength(2);
    });

    test('should throw when no log files are found anywhere', () => {
      // No directories exist
      fs.existsSync.mockReturnValue(false);

      expect(() => {
        resolver.resolve({});
      }).toThrow('No log files found');
    });
  });

  // ===========================================================================
  // _discoverLogFiles() — Internal directory scanning
  // ===========================================================================

  describe('_discoverLogFiles()', () => {
    test('should return empty array for non-existent directory', () => {
      fs.existsSync.mockReturnValue(false);

      const result = resolver._discoverLogFiles('/nonexistent');

      expect(result).toEqual([]);
    });

    test('should filter only .log extension files (case-insensitive)', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([
        'app.log',
        'APP.LOG',
        'data.csv',
        'report.pdf',
      ]);

      const result = resolver._discoverLogFiles('/some/dir');

      // Both .log and .LOG should be included
      expect(result).toHaveLength(2);
    });
  });

  // ===========================================================================
  // _resolveFilePath() — Path resolution
  // ===========================================================================

  describe('_resolveFilePath()', () => {
    test('should return absolute paths unchanged', () => {
      const absPath = path.resolve('/absolute/path/to/file.log');
      const result = resolver._resolveFilePath(absPath);

      expect(result).toBe(absPath);
    });

    test('should resolve relative paths against defaultLogDir', () => {
      const result = resolver._resolveFilePath('relative.log');

      // Should be resolved relative to the configured LOG_DIR
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('relative.log');
    });
  });
});
