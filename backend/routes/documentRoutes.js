const express = require('express');
const multer = require('multer');
const documentController = require('../controllers/documentController');
const { authenticateUser } = require('../middleware/auth');
const { documentUploadLimiter } = require('../middleware/rateLimiter');
const environment = require('../config/environment');

const router = express.Router();

// Configure multer memory storage with strict file size cap
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: environment.documents?.maxSizeBytes || (5 * 1024 * 1024),
  },
});

/**
 * Custom wrapper for multer to catch LIMIT_FILE_SIZE and return clean HTTP 413 DOCUMENT_TOO_LARGE
 */
const handleUploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const maxMb = environment.documents?.maxSizeMb || 5;
        return res.status(413).json({
          success: false,
          error: {
            code: 'DOCUMENT_TOO_LARGE',
            message: `Document size exceeds the maximum allowed limit of ${maxMb} MB.`,
          },
          timestamp: new Date().toISOString(),
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          message: err.message,
        },
        timestamp: new Date().toISOString(),
      });
    }
    next();
  });
};

// All document routes require authentication
router.use(authenticateUser);

// 1. Upload Statutory Document (Protected by rate limiter + streaming size check)
router.post('/upload', documentUploadLimiter, handleUploadMiddleware, documentController.uploadDocument);

// 2. Retrieve Secure Time-Limited Viewing / Download URL
router.get('/:id/signed-url', documentController.getSignedUrl);
router.get('/:id/view', documentController.getSignedUrl);
router.get('/:id/download', documentController.getSignedUrl);

module.exports = router;
