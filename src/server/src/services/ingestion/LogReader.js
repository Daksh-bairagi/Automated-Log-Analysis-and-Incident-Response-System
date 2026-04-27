/**
 * ============================================================================
 * LOG READER — File I/O Service
 * ============================================================================
 * Reads raw log files from disk and returns their content as arrays of lines.
 * This is the first step in the ingestion pipeline:
 *
 *   LogReader.readLogFile(filePath)
 *       → String[] (one element per line, empty lines filtered out)
 *
 * RESPONSIBILITIES:
 *   - Read file contents from absolute paths
 *   - Split content into individual lines
 *   - Filter out empty/whitespace-only lines
 *   - Handle file read errors gracefully
 *
 * USAGE:
 *   const LogReader = require('./LogReader');
 *   const lines = LogReader.readLogFile('/path/to/app.log');
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

class LogReader {
  static readFile(filePath) {
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Log file not found: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      filePath: resolvedPath,
      lines,
      lineCount: lines.length,
    };
  }

  /**
   * Reads a single log file and returns its content as an array of non-empty lines.
   *
   * @param {string} filePath - Absolute or relative path to the log file
   * @returns {string[]} Array of non-empty, trimmed log lines
   * @throws {Error} If the file cannot be read (not found, permission denied, etc.)
   */
  static readLogFile(filePath) {
    return LogReader.readFile(filePath).lines;
  }

  /**
   * Reads multiple log files and returns a map of filePath → lines[].
   * Continues processing even if individual files fail (logs errors).
   *
   * @param {string[]} filePaths - Array of file paths to read
   * @returns {{ fileGroups: Object<string, string[]>, errors: string[] }}
   *   fileGroups: Map of filePath → array of lines
   *   errors: Array of error messages for files that couldn't be read
   */
  static readMultipleFiles(filePaths) {
    const fileGroups = {};
    const errors = [];

    for (const filePath of filePaths) {
      try {
        fileGroups[filePath] = LogReader.readLogFile(filePath);
      } catch (err) {
        // Record the error but continue processing remaining files
        errors.push(`Failed to read ${filePath}: ${err.message}`);
      }
    }

    return { fileGroups, errors };
  }
}

module.exports = LogReader;
