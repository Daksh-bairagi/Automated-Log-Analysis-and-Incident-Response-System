/**
 * ============================================================================
 * UPLOAD MIDDLEWARE — Multer File Upload Configuration
 * ============================================================================
 * Configures Multer for handling multipart/form-data file uploads.
 * Used by the POST /api/analyze/upload endpoint to receive .log and .pdf files.
 *
 * CONFIGURATION:
 *   - Storage: Memory buffer (files stay in RAM, not written to disk)
 *   - Max file size: 10MB (from FILE_CONSTRAINTS)
 *   - Max files: 10 per request
 *   - Allowed types: .log, .pdf
 *
 * WHY MEMORY STORAGE?
 *   Files are processed immediately by the analysis pipeline and don't need
 *   persistent disk storage. Memory storage avoids cleanup complexity.
 *
 * USAGE:
 *   const upload = require('./middleware/uploadMiddleware');
 *   router.post('/upload', upload.array('files', 10), controller);
 * ============================================================================
 */

const multer = require('multer');
const path = require('path');
const { FILE_CONSTRAINTS } = require('../../../shared/constants');
const { ValidationError } = require('../utils/errors');

// ---------------------------------------------------------------------------
// Storage Configuration — Use memory storage for immediate processing
// ---------------------------------------------------------------------------
const storage = multer.memoryStorage();

// ---------------------------------------------------------------------------
// File Filter — Only accept .log and .pdf files
// ---------------------------------------------------------------------------
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (FILE_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(ext)) {
    // Accept the file
    cb(null, true);
  } else {
    cb(
      new ValidationError(
        `Unsupported file type: "${ext}". Allowed types: ${FILE_CONSTRAINTS.ALLOWED_EXTENSIONS.join(', ')}`
      ),
      false
    );
  }
}

// ---------------------------------------------------------------------------
// Multer Instance — Combine storage, filter, and size limits
// ---------------------------------------------------------------------------
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_CONSTRAINTS.MAX_UPLOAD_SIZE,  // 10 MB per file
    files: FILE_CONSTRAINTS.MAX_UPLOAD_FILES,    // Max 10 files per request
  },
});

module.exports = upload;
