const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { supabaseAdmin, isConfigured } = require('../config/supabase');
const auditService = require('./auditService');
const logger = require('../utils/logger');
const environment = require('../config/environment');
const {
  validateDocumentUpload,
  sanitizeOriginalFilename,
  generateStorageFilename,
  DocumentValidationError,
} = require('../utils/documentValidator');

const BUCKET_NAME = 'hospital-documents';

// Local in-memory document registry for development / test simulations
const devDocumentRegistry = [];

const documentService = {
  /**
   * Uploads statutory document to Supabase Storage (or local development storage fallback)
   * with strict size, MIME, magic-byte, and filename sanitization controls.
   */
  async uploadDocument({
    hospitalId,
    documentType,
    documentName,
    fileBuffer = null,
    mimeType = 'application/pdf',
    uploadedBy = 'Hospital Administrator',
    reqUser = null,
  }) {
    if (!hospitalId) {
      const err = new Error('Hospital ID is required for statutory document submission.');
      err.code = 'INVALID_METADATA';
      err.statusCode = 400;
      throw err;
    }

    if (!documentType || typeof documentType !== 'string' || !documentType.trim()) {
      const err = new Error('Statutory document type is required.');
      err.code = 'INVALID_DOCUMENT_TYPE';
      err.statusCode = 400;
      throw err;
    }

    // 1. Strict File Validation (Size, Extension, MIME, Magic Bytes, Structural Integrity)
    let validated;
    try {
      validated = validateDocumentUpload({
        buffer: fileBuffer,
        originalFilename: documentName || `${documentType}.pdf`,
        mimeType,
      });
    } catch (valErr) {
      // Audit log the rejected upload attempt (no secrets or binary data logged)
      await auditService.logEvent({
        action: 'DOCUMENT_UPLOAD_REJECTED',
        entityType: 'DOCUMENT',
        entityId: `rejected-${Date.now()}`,
        actorRole: reqUser?.role || 'hospital',
        hospitalId,
        summary: `Document upload rejected for ${documentType}: ${valErr.message}`,
        resultingStatus: 'rejected',
        metadata: {
          documentType,
          errorCode: valErr.code || 'INVALID_DOCUMENT',
          attemptedFilename: sanitizeOriginalFilename(documentName || 'unknown.pdf'),
        },
      }).catch(() => {});

      throw valErr;
    }

    // 2. Filename Security & Server-Generated UUID Storage Path
    const docId = crypto.randomUUID();
    const storagePath = `${hospitalId}/${validated.storageFilename}`;
    let documentUrl = storagePath;

    // 3. Storage Security: Upload to private Supabase Storage bucket
    if (isConfigured && supabaseAdmin && validated.buffer) {
      try {
        const { error: uploadErr } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(storagePath, validated.buffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadErr) {
          logger.warn('Supabase storage upload error:', uploadErr.message);
        }
      } catch (err) {
        logger.warn('Failed to upload to Supabase storage:', err.message);
      }
    } else if (validated.buffer) {
      // Local development fallback: store in private uploads directory (never in public frontend)
      const uploadDir = path.join(__dirname, '..', 'uploads', 'hospital-documents', hospitalId);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, validated.storageFilename), validated.buffer);
      documentUrl = storagePath;
    }

    // 4. Duplicate / Replacement Safety: Supersede existing document of same type if present
    let isReplacement = false;
    if (isConfigured && supabaseAdmin) {
      try {
        const { data: existingDoc } = await supabaseAdmin
          .from('hospital_documents')
          .select('id, storage_path')
          .eq('hospital_id', hospitalId)
          .eq('document_type', documentType)
          .eq('document_status', 'pending')
          .single();

        if (existingDoc) {
          isReplacement = true;
          // Supersede older record
          await supabaseAdmin
            .from('hospital_documents')
            .update({ document_status: 'rejected', rejection_reason: 'Superseded by newer submission' })
            .eq('id', existingDoc.id);
        }
      } catch (e) {
        // No existing record to supersede
      }
    } else {
      const existingIdx = devDocumentRegistry.findIndex(
        (d) => d.hospital_id === hospitalId && d.document_type === documentType
      );
      if (existingIdx !== -1) {
        isReplacement = true;
        devDocumentRegistry[existingIdx].document_status = 'superseded';
      }
    }

    // 5. Construct Document Record
    const documentRecord = {
      id: docId,
      hospital_id: hospitalId,
      document_type: documentType,
      original_filename: validated.originalFilename,
      document_name: validated.originalFilename,
      storage_path: storagePath,
      file_path: documentUrl,
      mime_type: 'application/pdf',
      file_size: validated.sizeDisplay,
      file_size_bytes: validated.sizeBytes,
      submission_status: 'submitted',
      document_status: 'pending',
      uploaded_by: uploadedBy,
      uploaded_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Persist metadata
    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('hospital_documents').insert([documentRecord]);
      } catch (err) {
        logger.warn('Failed to save document metadata in Supabase:', err.message);
      }
    }

    // Maintain in-memory store for dev / tests
    devDocumentRegistry.unshift(documentRecord);

    // 6. Security Audit Event
    const auditAction = isReplacement ? 'DOCUMENT_REPLACED' : 'DOCUMENT_UPLOADED';
    await auditService.logEvent({
      action: auditAction,
      entityType: 'DOCUMENT',
      entityId: docId,
      actorRole: reqUser?.role || 'hospital',
      hospitalId,
      summary: `${isReplacement ? 'Replaced' : 'Uploaded'} statutory filing "${documentType}" (${validated.originalFilename}). Size: ${validated.sizeDisplay}. Pending verification.`,
      resultingStatus: 'pending',
      metadata: {
        documentType,
        fileSize: validated.sizeDisplay,
        fileSizeBytes: validated.sizeBytes,
        storagePath,
        isReplacement,
      },
    });

    return documentRecord;
  },

  /**
   * Generates a time-limited signed URL for secure viewing.
   * Strictly enforces authorization:
   * - Hospital users can ONLY access documents belonging to their own hospital.
   * - Admin users can access any hospital's statutory documents.
   */
  async getSignedUrl({ hospitalId = null, documentId, reqUser, expiresInSeconds = 900 }) {
    if (!documentId) {
      const err = new Error('Document ID is required.');
      err.code = 'INVALID_DOCUMENT_ID';
      err.statusCode = 400;
      throw err;
    }

    // 1. Locate Authoritative Document Record
    let doc = null;

    if (isConfigured && supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('hospital_documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (!error && data) {
          doc = data;
        }
      } catch (err) {
        logger.warn('Failed to query document from Supabase:', err.message);
      }
    }

    // Check dev registry fallback
    if (!doc) {
      doc = devDocumentRegistry.find((d) => d.id === documentId || d.storage_path?.includes(documentId));
    }

    if (!doc) {
      const err = new Error('Statutory document not found.');
      err.code = 'DOCUMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 2. Strict Authorization Enforcement
    const isAdmin = reqUser?.role === 'admin';
    const isOwner = reqUser?.role === 'hospital' && reqUser?.hospitalId === doc.hospital_id;

    if (!isAdmin && !isOwner) {
      // Security Event: Cross-hospital access attempt detected
      await auditService.logEvent({
        action: 'DOCUMENT_ACCESS_DENIED',
        entityType: 'DOCUMENT',
        entityId: documentId,
        actorRole: reqUser?.role || 'unauthorized',
        hospitalId: reqUser?.hospitalId || null,
        partnerHospitalId: doc.hospital_id,
        summary: `Unauthorized document access attempt by ${reqUser?.name || 'user'} on document ${documentId} (Owner: ${doc.hospital_id}).`,
        resultingStatus: 'forbidden',
        metadata: {
          requestedDocumentId: documentId,
          targetHospitalId: doc.hospital_id,
          callerHospitalId: reqUser?.hospitalId,
        },
      }).catch(() => {});

      const err = new Error('Access restricted: You are not authorized to view this statutory document.');
      err.code = 'UNAUTHORIZED_DOCUMENT_ACCESS';
      err.statusCode = 403;
      throw err;
    }

    // 3. Generate Short-Lived Signed URL from private bucket
    const targetStoragePath = doc.storage_path || doc.file_path;
    let signedUrl = null;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    if (isConfigured && supabaseAdmin && targetStoragePath && !targetStoragePath.startsWith('/')) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .createSignedUrl(targetStoragePath, expiresInSeconds);

        if (!error && data?.signedUrl) {
          signedUrl = data.signedUrl;
        }
      } catch (err) {
        logger.warn('Failed to generate Supabase signed URL:', err.message);
      }
    }

    if (!signedUrl) {
      // Development safe tokenized signed URL simulation
      const token = crypto.randomBytes(16).toString('hex');
      signedUrl = `/api/documents/${documentId}/view?token=${token}&expires=${Date.now() + expiresInSeconds * 1000}`;
    }

    // 4. Audit Log Successful Authorized View
    await auditService.logEvent({
      action: 'DOCUMENT_VIEWED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      actorRole: reqUser?.role || 'hospital',
      hospitalId: doc.hospital_id,
      summary: `Secure signed viewing URL generated for "${doc.document_type}" (${doc.document_name}). Authorized by ${isAdmin ? 'Administrator' : 'Hospital User'}.`,
      resultingStatus: 'authorized',
      metadata: {
        documentType: doc.document_type,
        documentName: doc.document_name,
        expiresInSeconds,
      },
    }).catch(() => {});

    return {
      documentId: doc.id,
      hospitalId: doc.hospital_id,
      documentType: doc.document_type,
      documentName: doc.document_name,
      signedUrl,
      expiresAt,
    };
  },

  /**
   * Returns registered document by ID (internal utility)
   */
  async getDocumentById(documentId) {
    if (isConfigured && supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('hospital_documents')
        .select('*')
        .eq('id', documentId)
        .single();
      if (data) return data;
    }
    return devDocumentRegistry.find((d) => d.id === documentId) || null;
  },

  /**
   * Helper to clear in-memory document registry for test isolation
   */
  _clearDevRegistry() {
    devDocumentRegistry.length = 0;
  }
};

module.exports = documentService;
