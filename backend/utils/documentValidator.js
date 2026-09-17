/**
 * MedEx Document Upload Security Validator
 *
 * Enforces:
 * 1. Configurable max size (default 5 MB) & non-empty checks
 * 2. File extension (.pdf only) & MIME type (application/pdf only)
 * 3. Binary magic byte signature (%PDF-)
 * 4. Disguised binary/image signature detection (JPEG, PNG, GIF, EXE, ELF, ZIP)
 * 5. Structural PDF integrity checks (objects, trailer/xref, %%EOF)
 * 6. Filename sanitization (path traversal, null bytes, double extensions)
 */

const crypto = require('crypto');
const path = require('path');
const environment = require('../config/environment');

const PDF_MAGIC_BYTES = Buffer.from('%PDF-'); // 0x25 0x50 0x44 0x46 0x2D

// Known signatures for disguised files
const DISGUISED_SIGNATURES = [
  { name: 'JPEG', bytes: Buffer.from([0xFF, 0xD8, 0xFF]) },
  { name: 'PNG', bytes: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) },
  { name: 'GIF', bytes: Buffer.from([0x47, 0x49, 0x46, 0x38]) },
  { name: 'Windows Executable (EXE/DLL)', bytes: Buffer.from([0x4D, 0x5A]) },
  { name: 'Linux Executable (ELF)', bytes: Buffer.from([0x7F, 0x45, 0x4C, 0x46]) },
  { name: 'ZIP/Archive', bytes: Buffer.from([0x50, 0x4B, 0x03, 0x04]) },
];

const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.bin', '.dll', '.com', '.msi',
  '.vbs', '.js', '.jsx', '.ts', '.tsx', '.php', '.py', '.rb',
  '.html', '.htm', '.svg', '.jar', '.war', '.scr', '.ps1',
];

/**
 * Custom error class for document security rejections
 */
class DocumentValidationError extends Error {
  constructor(message, code = 'INVALID_DOCUMENT', statusCode = 400) {
    super(message);
    this.name = 'DocumentValidationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Sanitizes user-provided filename to prevent path traversal and null byte injection.
 * Never used directly as storage path.
 */
function sanitizeOriginalFilename(rawFilename = 'document.pdf') {
  if (typeof rawFilename !== 'string' || !rawFilename.trim()) {
    return 'document.pdf';
  }

  // 1. Strip null bytes
  let cleaned = rawFilename.replace(/\0/g, '');

  // 2. Extract basename to defeat path traversal (../, ..\, absolute paths)
  cleaned = path.basename(cleaned);

  // 3. Normalize multiple dots & remove dangerous sequences
  cleaned = cleaned.replace(/\.{2,}/g, '.');

  // 4. Check for double/executable extensions (e.g. doc.pdf.exe)
  const lower = cleaned.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (lower.endsWith(ext) || lower.includes(`${ext}.`)) {
      throw new DocumentValidationError(
        `Executable or unsafe file extension rejected: ${ext}`,
        'INVALID_DOCUMENT_TYPE',
        400
      );
    }
  }

  // 5. Replace non-whitelisted characters
  cleaned = cleaned.replace(/[^a-zA-Z0-9._-]/g, '_');

  // 6. Ensure .pdf extension
  if (!cleaned.toLowerCase().endsWith('.pdf')) {
    cleaned += '.pdf';
  }

  // 7. Limit length
  if (cleaned.length > 150) {
    cleaned = cleaned.substring(0, 146) + '.pdf';
  }

  return cleaned;
}

/**
 * Generates an unguessable server-side storage filename
 */
function generateStorageFilename() {
  return `${crypto.randomUUID()}.pdf`;
}

/**
 * Validates document buffer, original filename, and declared MIME type.
 * Returns sanitized metadata and validated Buffer.
 */
function validateDocumentUpload({ buffer, originalFilename, mimeType, declaredSize = null }) {
  const maxBytes = environment.documents?.maxSizeBytes || (5 * 1024 * 1024);
  const maxMb = environment.documents?.maxSizeMb || 5;

  // 1. Buffer existence & empty file check
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new DocumentValidationError('No document payload provided.', 'INVALID_PDF', 400);
  }

  if (buffer.length === 0) {
    throw new DocumentValidationError('Uploaded file is empty (0 bytes).', 'INVALID_PDF', 400);
  }

  // 2. File size enforcement
  if (buffer.length > maxBytes || (declaredSize && declaredSize > maxBytes)) {
    throw new DocumentValidationError(
      `Document size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of ${maxMb} MB.`,
      'DOCUMENT_TOO_LARGE',
      413
    );
  }

  // 3. Original Filename & Extension validation
  const rawName = originalFilename || '';
  const lowerName = rawName.toLowerCase();

  // Check for path traversal attempts
  if (rawName.includes('..') || rawName.includes('/') || rawName.includes('\\') || rawName.includes('\0')) {
    // Flagged path traversal in incoming parameter
    const hasDangerousTraversal = rawName.includes('../') || rawName.includes('..\\') || rawName.includes('\0');
    if (hasDangerousTraversal) {
      throw new DocumentValidationError(
        'Path traversal or null bytes detected in filename.',
        'INVALID_DOCUMENT_TYPE',
        400
      );
    }
  }

  // Check dangerous extension before sanitization
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      throw new DocumentValidationError(
        `File extension ${ext} is prohibited. Only PDF documents are allowed.`,
        'INVALID_DOCUMENT_TYPE',
        400
      );
    }
  }

  if (!lowerName.endsWith('.pdf')) {
    throw new DocumentValidationError(
      'Invalid file extension. Only .pdf documents are accepted.',
      'INVALID_DOCUMENT_TYPE',
      400
    );
  }

  // 4. Declared MIME Type validation
  if (mimeType) {
    const cleanMime = mimeType.toLowerCase().trim();
    if (cleanMime !== 'application/pdf' && cleanMime !== 'application/x-pdf') {
      throw new DocumentValidationError(
        `Invalid MIME type '${mimeType}'. Only application/pdf is allowed.`,
        'INVALID_DOCUMENT_TYPE',
        400
      );
    }
  }

  // 5. Binary Magic Bytes validation (%PDF-)
  if (buffer.length < 5) {
    throw new DocumentValidationError('Corrupt file: insufficient data for PDF header.', 'INVALID_PDF_SIGNATURE', 400);
  }

  // First 5 bytes MUST be '%PDF-'
  if (buffer.compare(PDF_MAGIC_BYTES, 0, 5, 0, 5) !== 0) {
    // Check if it matches disguised image/binary
    for (const sig of DISGUISED_SIGNATURES) {
      if (buffer.length >= sig.bytes.length && buffer.compare(sig.bytes, 0, sig.bytes.length, 0, sig.bytes.length) === 0) {
        throw new DocumentValidationError(
          `Disguised file detected: file content matches ${sig.name}, not a valid PDF.`,
          'INVALID_PDF_SIGNATURE',
          400
        );
      }
    }

    throw new DocumentValidationError(
      'Invalid file signature: binary magic bytes do not begin with %PDF-.',
      'INVALID_PDF_SIGNATURE',
      400
    );
  }

  // 6. Structural PDF Validation
  // Valid PDF must have minimal length, structural objects/tables, and %%EOF marker
  if (buffer.length < 30) {
    throw new DocumentValidationError('Corrupt PDF: truncated file data.', 'INVALID_PDF', 400);
  }

  const fileString = buffer.toString('binary');

  // Check for PDF version string (e.g. %PDF-1.3, %PDF-1.4, %PDF-1.7, %PDF-2.0)
  const headerMatch = fileString.substring(0, 10).match(/^%PDF-[12]\.\d/);
  if (!headerMatch) {
    throw new DocumentValidationError('Malformed PDF header version format.', 'INVALID_PDF', 400);
  }

  // Check for PDF object or structural cross-reference markers
  const hasObjects = fileString.includes('obj') || fileString.includes('xref') || fileString.includes('trailer') || fileString.includes('stream');
  if (!hasObjects) {
    throw new DocumentValidationError('Corrupt or non-PDF content: missing essential PDF object structure.', 'INVALID_PDF', 400);
  }

  // Check for %%EOF marker (per PDF specification, typically near end of file)
  const trailingChunk = fileString.slice(-2048);
  if (!trailingChunk.includes('%%EOF') && !fileString.includes('%%EOF')) {
    throw new DocumentValidationError('Corrupt PDF document: missing %%EOF termination marker.', 'INVALID_PDF', 400);
  }

  // 7. Sanitize metadata filename
  const sanitizedOriginalFilename = sanitizeOriginalFilename(rawName);
  const storageFilename = generateStorageFilename();

  return {
    isValid: true,
    buffer,
    sizeBytes: buffer.length,
    sizeDisplay: `${(buffer.length / (1024 * 1024)).toFixed(1)} MB`,
    originalFilename: sanitizedOriginalFilename,
    storageFilename,
    mimeType: 'application/pdf',
  };
}

module.exports = {
  validateDocumentUpload,
  sanitizeOriginalFilename,
  generateStorageFilename,
  DocumentValidationError,
};
