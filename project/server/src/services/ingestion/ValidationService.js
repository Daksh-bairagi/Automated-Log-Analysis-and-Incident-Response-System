/**
 * ============================================================================
 * VALIDATION SERVICE — Input Validation Utility
 * ============================================================================
 * Provides reusable validation methods for file paths, arrays, and inputs
 * throughout the application. Used by LogSourceResolver, controllers, and
 * the orchestrator to ensure data integrity before processing.
 *
 * USAGE:
 *   const ValidationService = require('./ValidationService');
 *   ValidationService.ensureFilePathArray(paths);   // throws if invalid
 *   ValidationService.ensureNonEmptyString(val);     // throws if empty
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { FILE_CONSTRAINTS } = require('../../../../shared/constants');

class ValidationService {
  /**
   * Validates that the input is a non-empty array of file path strings.
   * Each path must be a non-empty string (existence is NOT checked here).
   *
   * @param {*} paths - Value to validate
   * @throws {Error} If paths is not a non-empty array of strings
   */
  static ensureFilePathArray(paths) {
    if (!Array.isArray(paths)) {
      throw new Error('Expected an array of file paths');
    }
    if (paths.length === 0) {
      throw new Error('File paths array must not be empty');
    }
    for (const p of paths) {
      if (typeof p !== 'string' || p.trim().length === 0) {
        throw new Error(`Invalid file path: "${p}". Each path must be a non-empty string.`);
      }
    }
  }

  /**
   * Validates that the input is a non-empty string.
   *
   * @param {*} value - Value to validate
   * @param {string} [fieldName='value'] - Name of the field (for error messages)
   * @throws {Error} If value is not a non-empty string
   */
  static ensureNonEmptyString(value, fieldName = 'value') {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
  }

  /**
   * Validates that all file paths in the array point to existing files on disk.
   * Returns arrays of valid paths and missing paths.
   *
   * @param {string[]} filePaths - Array of file paths to verify
   * @returns {{ valid: string[], missing: string[] }}
   */
  static verifyFilesExist(filePaths) {
    const valid = [];
    const missing = [];

    for (const fp of filePaths) {
      const resolved = path.resolve(fp);
      if (fs.existsSync(resolved)) {
        valid.push(resolved);
      } else {
        missing.push(resolved);
      }
    }

    return { valid, missing };
  }

  /**
   * Validates that a file has an allowed extension (.log or .pdf).
   *
   * @param {string} filename - Filename or path to check
   * @returns {boolean} True if the extension is allowed
   */
  static isAllowedFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    return FILE_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(ext);
  }

  /**
   * Validates uploaded file objects for the upload endpoint.
   * Checks file count, size limits, and allowed types.
   *
   * @param {Object[]} files - Array of Multer file objects
   * @throws {Error} If validation fails
   */
  static validateUploadedFiles(files) {
    if (!files || files.length === 0) {
      throw new Error('No files uploaded');
    }
    if (files.length > FILE_CONSTRAINTS.MAX_UPLOAD_FILES) {
      throw new Error(`Maximum ${FILE_CONSTRAINTS.MAX_UPLOAD_FILES} files allowed per upload`);
    }
    for (const file of files) {
      if (file.size > FILE_CONSTRAINTS.MAX_UPLOAD_SIZE) {
        throw new Error(
          `File "${file.originalname}" exceeds max size of ${FILE_CONSTRAINTS.MAX_UPLOAD_SIZE / (1024 * 1024)}MB`
        );
      }
      if (!ValidationService.isAllowedFileType(file.originalname)) {
        throw new Error(
          `File "${file.originalname}" has unsupported type. Allowed: ${FILE_CONSTRAINTS.ALLOWED_EXTENSIONS.join(', ')}`
        );
      }
    }
  }
}

module.exports = ValidationService;
