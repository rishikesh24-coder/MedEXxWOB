const documentService = require('../services/documentService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const documentController = {
  /**
   * POST /api/documents/upload
   * Handles document uploads via multipart/form-data or JSON (base64)
   * Strictly verifies ownership, size, MIME type, and magic bytes.
   */
  async uploadDocument(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return errorResponse(res, 'Authentication required for document upload.', 401, 'UNAUTHORIZED');
      }

      // 1. Authoritative Hospital ID Resolution
      let targetHospitalId = null;
      if (user.role === 'admin') {
        targetHospitalId = req.body?.hospitalId || req.query?.hospitalId;
        if (!targetHospitalId) {
          return errorResponse(
            res,
            'Hospital ID (hospitalId) is required for administrative document filing.',
            400,
            'INVALID_METADATA'
          );
        }
      } else if (user.role === 'hospital') {
        targetHospitalId = user.hospitalId;
        // Security check: hospital users cannot inject another hospitalId
        if (req.body?.hospitalId && req.body.hospitalId !== user.hospitalId) {
          return errorResponse(
            res,
            'Access restricted: You cannot attach documents to another hospital.',
            403,
            'UNAUTHORIZED_DOCUMENT_ACCESS'
          );
        }
      } else {
        return errorResponse(res, 'Forbidden: Insufficient institutional role.', 403, 'FORBIDDEN');
      }

      // 2. Extract Document Metadata
      const documentType = req.body?.documentType || req.body?.type;
      if (!documentType || typeof documentType !== 'string' || !documentType.trim()) {
        return errorResponse(
          res,
          'Document type (documentType) is required (e.g., Registration Certificate, Drug License).',
          400,
          'INVALID_DOCUMENT_TYPE'
        );
      }

      // 3. Extract File Payload (Multipart req.file OR JSON Base64 fileData)
      let fileBuffer = null;
      let originalFilename = null;
      let mimeType = 'application/pdf';

      if (req.file) {
        // Multipart upload
        fileBuffer = req.file.buffer;
        originalFilename = req.file.originalname;
        mimeType = req.file.mimetype || 'application/pdf';
      } else if (req.body?.fileData || req.body?.fileBase64 || req.body?.content) {
        // JSON Base64 upload
        const rawData = req.body.fileData || req.body.fileBase64 || req.body.content;
        originalFilename = req.body.documentName || req.body.originalFilename || `${documentType}.pdf`;
        mimeType = req.body.mimeType || 'application/pdf';

        if (typeof rawData === 'string') {
          // Check for data URL prefix (e.g. data:application/pdf;base64,...)
          const matches = rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            fileBuffer = Buffer.from(matches[2], 'base64');
          } else {
            fileBuffer = Buffer.from(rawData, 'base64');
          }
        } else if (Buffer.isBuffer(rawData)) {
          fileBuffer = rawData;
        }
      } else if (req.body?.fileBuffer && Buffer.isBuffer(req.body.fileBuffer)) {
        fileBuffer = req.body.fileBuffer;
        originalFilename = req.body.documentName || `${documentType}.pdf`;
        mimeType = req.body.mimeType || 'application/pdf';
      } else {
        return errorResponse(
          res,
          'No document file payload attached. Provide multipart file or base64 fileData.',
          400,
          'INVALID_PDF'
        );
      }

      if (!originalFilename) {
        originalFilename = req.body?.documentName || `${documentType}.pdf`;
      }

      const uploadedBy = user.name || user.email || 'Hospital Administrator';

      // 4. Delegate to Document Service with Full Security Validation
      const result = await documentService.uploadDocument({
        hospitalId: targetHospitalId,
        documentType: documentType.trim(),
        documentName: originalFilename,
        fileBuffer,
        mimeType,
        uploadedBy,
        reqUser: user,
      });

      return successResponse(res, result, 'Statutory document uploaded and verified successfully', 201);
    } catch (err) {
      logger.error('Document upload controller error:', err.message);

      const statusCode = err.statusCode || (err.code === 'DOCUMENT_TOO_LARGE' ? 413 : 400);
      const errorCode = err.code || 'DOCUMENT_UPLOAD_FAILED';

      return errorResponse(res, err.message, statusCode, errorCode);
    }
  },

  /**
   * GET /api/documents/:id/signed-url
   * Generates time-limited signed URL for viewing/downloading statutory document.
   * Strictly enforces institutional ownership and administrator access.
   */
  async getSignedUrl(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return errorResponse(res, 'Authentication required.', 401, 'UNAUTHORIZED');
      }

      const { id } = req.params;
      const expiresInSeconds = parseInt(req.query?.expiresIn, 10) || 900;

      const result = await documentService.getSignedUrl({
        documentId: id,
        reqUser: user,
        expiresInSeconds,
      });

      return successResponse(res, result, 'Time-limited signed viewing URL generated successfully');
    } catch (err) {
      logger.error('Signed URL controller error:', err.message);

      const statusCode = err.statusCode || 500;
      const errorCode = err.code || 'SIGNED_URL_FAILED';

      return errorResponse(res, err.message, statusCode, errorCode);
    }
  }
};

module.exports = documentController;
