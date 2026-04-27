/**
 * ============================================================================
 * PDF ANALYSIS SERVICE — File Upload Processing
 * ============================================================================
 * Handles uploaded files (.log and .pdf), extracts text/lines from them,
 * and runs the analysis pipeline via the IncidentOrchestrator.
 *
 * RESPONSIBILITIES:
 *   1. Validate uploaded files
 *   2. Extract lines from .log files (buffer → string → lines)
 *   3. Extract lines from .pdf files (pdf-parse → text → lines)
 *   4. Normalize extracted lines (trim, filter empty)
 *   5. Run analysis via orchestrator
 *   6. Save source document metadata
 *
 * DATA FLOW:
 *   Multer files[] → PdfAnalysisService.analyzeUploadedFiles(files)
 *     → extractLinesFromFile(file) per file
 *     → orchestrator.analyzeLineGroups(lineGroups)
 *     → repository.saveSourceDocument(metadata)
 *     → result
 *
 * USAGE:
 *   const service = new PdfAnalysisService({ orchestrator, repository });
 *   const result = await service.analyzeUploadedFiles(req.files);
 * ============================================================================
 */

const path = require('path');

class PdfAnalysisService {
  /**
   * @param {Object} deps - Injected dependencies
   * @param {import('../services/IncidentOrchestrator')} deps.orchestrator
   * @param {Object} [deps.repository] - Persistence repository
   */
  constructor({ orchestrator, repository }) {
    this.orchestrator = orchestrator;
    this.repository = repository;
  }

  /**
   * Processes an array of uploaded files: extracts lines, runs analysis,
   * and persists source document metadata.
   *
   * @param {Object[]} files - Multer file objects (from req.files)
   * @returns {Promise<Object>} Analysis result with upload metadata
   */
  async analyzeUploadedFiles(files, options = {}) {
    const {
      ownerId = null,
      notificationRecipientEmail = null,
      notificationPreferences = null,
    } = options;
    // ---- Step 1: Validate uploads ----
    this._assertValidUploads(files);

    // ---- Step 2: Extract lines from each file ----
    const lineGroups = {};
    const uploadMeta = [];

    for (const file of files) {
      const lines = await this._extractLinesFromFile(file);
      lineGroups[file.originalname] = lines;

      // Track upload metadata for source document persistence
      uploadMeta.push({
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        extractedLines: lines.length,
      });
    }

    // ---- Step 3: Run analysis pipeline on all line groups ----
    const result = await this.orchestrator.analyzeLineGroups(lineGroups, {
      persistReport: true,
      analysisType: 'upload',
      ownerId,
      notificationRecipientEmail,
      notificationPreferences,
    });

    // ---- Step 4: Save source document records (if repository available) ----
    if (this.repository && result.reportId) {
      for (const meta of uploadMeta) {
        try {
          await this.repository.saveSourceDocument({
            ...meta,
            reportId: result.reportId,
            ownerId,
          });
        } catch (err) {
          console.error(`Failed to save source document metadata: ${err.message}`);
        }
      }
    }

    const storedUploads = this.repository && typeof this.repository.listSourceDocuments === 'function'
      ? await this.repository.listSourceDocuments({ ownerId })
      : [];

    // ---- Step 5: Return enriched result ----
    return {
      ...result,
      uploads: uploadMeta,
      storedUploads,
    };
  }

  /**
   * Extracts text lines from a single uploaded file.
   * Handles both .log (text) and .pdf (binary) files.
   *
   * @param {Object} file - Multer file object
   * @returns {Promise<string[]>} Array of extracted lines
   * @private
   */
  async _extractLinesFromFile(file) {
    const ext = path.extname(file.originalname).toLowerCase();

    if (ext === '.pdf') {
      return this._extractFromPdf(file);
    }

    // Default: treat as text file (.log or similar)
    return this._extractFromText(file);
  }

  /**
   * Extracts lines from a text file buffer.
   *
   * @param {Object} file - Multer file object
   * @returns {string[]} Array of non-empty, trimmed lines
   * @private
   */
  _extractFromText(file) {
    const content = file.buffer.toString('utf-8');
    return this._normalizeLines(content);
  }

  /**
   * Extracts lines from a PDF file using pdf-parse.
   *
   * @param {Object} file - Multer file object with PDF buffer
   * @returns {Promise<string[]>} Array of extracted lines
   * @private
   */
  async _extractFromPdf(file) {
    try {
      // Dynamic import of pdf-parse (optional dependency)
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(file.buffer);

      // data.text contains the extracted text content
      return this._normalizeLines(data.text);
    } catch (error) {
      console.error(`PDF extraction failed for ${file.originalname}: ${error.message}`);
      throw new Error(`Failed to extract text from PDF "${file.originalname}": ${error.message}`);
    }
  }

  /**
   * Normalizes raw text into an array of clean, non-empty lines.
   *
   * @param {string} text - Raw text content
   * @returns {string[]} Cleaned line array
   * @private
   */
  _normalizeLines(text) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  /**
   * Validates that the uploads array is non-empty and contains valid files.
   *
   * @param {Object[]} files - Array of Multer file objects
   * @throws {Error} If validation fails
   * @private
   */
  _assertValidUploads(files) {
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('No files provided for analysis');
    }

    for (const file of files) {
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error(`File "${file.originalname}" is empty`);
      }
    }
  }
}

module.exports = PdfAnalysisService;
