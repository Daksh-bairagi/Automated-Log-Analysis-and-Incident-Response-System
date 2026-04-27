/**
 * ============================================================================
 * LOG SOURCE RESOLVER — File Discovery Service
 * ============================================================================
 * Resolves which log files should be analyzed based on user input. Implements
 * a fallback chain to find log files:
 *
 *   1. Explicit file list (logFiles[])  → resolve each path
 *   2. Custom directory (logDir)        → discover all .log files in it
 *   3. Generated logs directory         → try ./generated_logs/
 *   4. Default sample logs              → use ./logs/*.log
 *
 * FLOW DIAGRAM (see roadmap §7):
 *   resolve(opts) → HAS_FILES? → RESOLVE_FILES
 *                 → HAS_DIR?   → DISCOVER_DIR
 *                 → TRY_GENERATED → DEFAULT → VALIDATE → OUTPUT
 *
 * USAGE:
 *   const LogSourceResolver = require('./LogSourceResolver');
 *   const resolver = new LogSourceResolver(config);
 *   const filePaths = resolver.resolve({ logDir: './logs' });
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const ValidationService = require('./ValidationService');

class LogSourceResolver {
  /**
   * @param {Object} config - Application configuration
   * @param {string} config.LOG_DIR - Default log directory path
   */
  constructor(config) {
    this.config = config;
    // Resolve the default log directory from config
    this.defaultLogDir = path.resolve(config.LOG_DIR || path.join(__dirname, '../../../../logs'));
  }

  /**
   * Resolves log file paths based on provided options, following the
   * fallback chain described above.
   *
   * @param {Object} [options={}] - Resolution options
   * @param {string[]} [options.logFiles] - Explicit file paths to analyze
   * @param {string}   [options.logDir]   - Directory to scan for .log files
   * @param {string[]} [options.dirs]     - Additional directories to scan
   * @returns {string[]} Array of absolute file paths to analyze
   * @throws {Error} If no log files can be found via any method
   */
  resolve(options = {}) {
    const { logFiles, logDir, dirs } = options;

    // ---- Strategy 1: Explicit file list provided ----
    if (logFiles && Array.isArray(logFiles) && logFiles.length > 0) {
      const resolved = logFiles.map((f) => this._resolveFilePath(f));
      ValidationService.ensureFilePathArray(resolved);
      return resolved;
    }

    // ---- Strategy 2: Custom directory provided ----
    if (logDir) {
      const discovered = this._discoverLogFiles(logDir);
      if (discovered.length === 0) {
        throw new Error(`No .log files found in directory: ${logDir}`);
      }
      return discovered;
    }

    // ---- Strategy 2b: Additional directories provided ----
    if (dirs && Array.isArray(dirs) && dirs.length > 0) {
      const allFiles = [];
      for (const dir of dirs) {
        allFiles.push(...this._discoverLogFiles(dir));
      }
      if (allFiles.length > 0) return allFiles;
    }

    // ---- Strategy 3: Try generated_logs directory ----
    const generatedDir = path.resolve(this.defaultLogDir, '../generated_logs');
    if (fs.existsSync(generatedDir)) {
      const generated = this._discoverLogFiles(generatedDir);
      if (generated.length > 0) return generated;
    }

    // ---- Strategy 4: Default sample log files ----
    const defaults = this._discoverLogFiles(this.defaultLogDir);
    if (defaults.length > 0) return defaults;

    // ---- No files found anywhere ----
    throw new Error(
      'No log files found. Provide logFiles[], logDir, or place .log files in the logs/ directory.'
    );
  }

  /**
   * Discovers all .log files in a directory (non-recursive).
   *
   * @param {string} dirPath - Directory path to scan
   * @returns {string[]} Array of absolute paths to .log files
   * @private
   */
  _discoverLogFiles(dirPath) {
    const resolved = path.resolve(dirPath);

    if (!fs.existsSync(resolved)) {
      return [];
    }

    return fs
      .readdirSync(resolved)
      .filter((file) => path.extname(file).toLowerCase() === '.log')
      .sort() // Alphabetical order for consistent results
      .map((file) => path.join(resolved, file));
  }

  /**
   * Resolves a single file path — handles both absolute and relative paths.
   * Relative paths are resolved against the default log directory.
   *
   * @param {string} filePath - File path to resolve
   * @returns {string} Absolute file path
   * @private
   */
  _resolveFilePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(this.defaultLogDir, filePath);
  }
}

module.exports = LogSourceResolver;
