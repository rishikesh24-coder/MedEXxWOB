const { randomUUID: uuidv4 } = require('crypto');
const { supabaseAdmin, supabaseAnon, isConfigured } = require('../config/supabase');
const authService = require('./authService');
const auditService = require('./auditService');
const logger = require('../utils/logger');

const verificationService = {
  /**
   * Returns only hospitals awaiting admin verification / approval
   * Strictly filters out APPROVED and REJECTED hospitals.
   */
  async getPendingHospitals() {
    let pendingList = [];

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client
          .from('hospitals')
          .select('*, hospital_documents(*)')
          .in('status', ['PENDING_APPROVAL', 'pending', 'under_review'])
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          pendingList = data;
        }
      } catch (err) {
        logger.warn('Supabase query in getPendingHospitals failed, using local store:', err.message);
      }
    }

    if (pendingList.length === 0) {
      const devHospitals = authService.getDevHospitals();
      pendingList = devHospitals.filter((h) => {
        const s = (h.status || '').toUpperCase();
        return ['PENDING_APPROVAL', 'PENDING', 'UNDER_REVIEW', 'DOCUMENTS_MISSING'].includes(s);
      });
    }

    return pendingList.map((h) => ({
      id: h.id,
      name: h.name,
      registrationNo: h.registrationNo || h.registration_no,
      authorizedPerson: h.authorizedPerson || h.authorized_person,
      email: h.email,
      phone: h.phone,
      address: h.address,
      city: h.city,
      state: h.state,
      pincode: h.pincode,
      status: h.status,
      registeredDate: h.registeredDate || h.registered_date || h.created_at,
      reviewNote: h.reviewNote || h.review_notes,
      documentsCount: (h.documents || h.hospital_documents || []).length,
      documents: (h.documents || h.hospital_documents || []).map((d) => ({
        id: d.id,
        documentType: d.documentType || d.document_type,
        documentName: d.documentName || d.document_name,
        submissionStatus: d.submissionStatus || d.submission_status || 'submitted',
        documentStatus: d.documentStatus || d.document_status || 'pending',
        fileSize: d.fileSize || d.file_size || '2.4 MB',
        storagePath: d.storagePath || d.storage_path,
        uploadedAt: d.uploadedAt || d.uploaded_at,
      })),
    }));
  },

  /**
   * Retrieves complete submitted registration information and exact submitted documents
   */
  async getHospitalVerificationDossier(hospitalId) {
    let hospital = null;

    if (isConfigured) {
      try {
        const client = supabaseAdmin || supabaseAnon;
        const { data, error } = await client
          .from('hospitals')
          .select('*, hospital_documents(*)')
          .eq('id', hospitalId)
          .single();

        if (!error && data) hospital = data;
      } catch (err) {
        logger.warn('Failed to query hospital dossier from Supabase:', err.message);
      }
    }

    if (!hospital) {
      const devHospitals = authService.getDevHospitals();
      hospital = devHospitals.find((h) => h.id === hospitalId) || null;
    }

    if (!hospital) {
      const err = new Error('Hospital registration application not found.');
      err.statusCode = 404;
      throw err;
    }

    const rawDocs = hospital.documents || hospital.hospital_documents || [];

    // Generate signed download URLs or safe access links for each submitted document
    const enrichedDocs = rawDocs.map((doc) => {
      const docType = doc.documentType || doc.document_type || 'Registration Certificate';
      const docName = doc.documentName || doc.document_name || 'Document.pdf';
      const storagePath = doc.storagePath || doc.storage_path || `${hospital.id}/${docName}`;

      return {
        id: doc.id,
        documentType: docType,
        document_type: docType,
        documentName: docName,
        document_name: docName,
        originalFilename: doc.originalFilename || doc.original_filename || docName,
        storagePath,
        storage_path: storagePath,
        documentUrl: `/uploads/documents/${docName}`,
        submissionStatus: doc.submissionStatus || doc.submission_status || 'submitted',
        documentStatus: doc.documentStatus || doc.document_status || 'pending',
        verificationStatus: doc.verificationStatus || doc.verification_status || 'pending',
        fileSize: doc.fileSize || doc.file_size || '2.4 MB',
        mimeType: doc.mimeType || doc.mime_type || 'application/pdf',
        uploadedBy: doc.uploadedBy || doc.uploaded_by || hospital.authorizedPerson || hospital.authorized_person,
        uploadedAt: doc.uploadedAt || doc.uploaded_at,
        reviewedAt: doc.reviewedAt || doc.reviewed_at,
        rejectionReason: doc.rejectionReason || doc.rejection_reason,
      };
    });

    return {
      id: hospital.id,
      name: hospital.name,
      registrationNo: hospital.registrationNo || hospital.registration_no,
      authorizedPerson: hospital.authorizedPerson || hospital.authorized_person,
      email: hospital.email,
      phone: hospital.phone,
      address: hospital.address,
      city: hospital.city,
      state: hospital.state,
      pincode: hospital.pincode,
      status: hospital.status,
      registeredDate: hospital.registeredDate || hospital.registered_date || hospital.created_at,
      verifiedDate: hospital.verifiedDate || hospital.verified_date || hospital.approved_at,
      rejectionReason: hospital.rejectionReason || hospital.rejection_reason,
      reviewNotes: hospital.reviewNote || hospital.review_notes,
      documentsCount: enrichedDocs.length,
      documents: enrichedDocs,
    };
  },

  /**
   * Approves a pending hospital, granting operational access to the MedEx network
   */
  async approveHospital(hospitalId, adminUser = { name: 'Super Administrator', id: null }) {
    const devHospitals = authService.getDevHospitals();
    const idx = devHospitals.findIndex((h) => h.id === hospitalId);

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    let targetHosp = null;

    if (idx !== -1) {
      devHospitals[idx].status = 'APPROVED';
      devHospitals[idx].verifiedDate = todayStr;
      devHospitals[idx].approved_at = nowIso;
      devHospitals[idx].approved_by = adminUser.id || 'admin-01';
      devHospitals[idx].rejectionReason = null;

      if (devHospitals[idx].documents) {
        devHospitals[idx].documents = devHospitals[idx].documents.map((d) => ({
          ...d,
          documentStatus: 'approved',
          document_status: 'approved',
          reviewedAt: todayStr,
        }));
      }
      targetHosp = devHospitals[idx];
    }

    if (isConfigured && supabaseAdmin) {
      try {
        const updatePayload = {
          status: 'APPROVED',
          verified_date: todayStr,
          approved_at: nowIso,
          rejection_reason: null,
        };
        if (adminUser.id) updatePayload.approved_by = adminUser.id;

        const { data: updatedHosp, error: hospErr } = await supabaseAdmin
          .from('hospitals')
          .update(updatePayload)
          .eq('id', hospitalId)
          .select()
          .single();

        if (!hospErr && updatedHosp) targetHosp = updatedHosp;

        await supabaseAdmin
          .from('hospital_documents')
          .update({
            document_status: 'approved',
            verification_status: 'verified',
            verified_at: nowIso,
          })
          .eq('hospital_id', hospitalId);

        // Notification record for the hospital
        await supabaseAdmin.from('notifications').insert([{
          id: uuidv4(),
          hospital_id: hospitalId,
          notification_type: 'APPROVAL',
          type: 'success',
          title: 'Hospital Registration Approved',
          message: `Your hospital registration application for ${targetHosp?.name || 'your institution'} has been approved by platform administration. You now have full operational access to the MedEx network.`,
          link: '/hospital/dashboard',
          is_read: false,
        }]);
      } catch (err) {
        logger.warn('Supabase update failed during approveHospital:', err.message);
      }
    }

    if (!targetHosp) {
      const err = new Error('Hospital application not found.');
      err.statusCode = 404;
      throw err;
    }

    // Statutory Audit Log
    await auditService.logEvent({
      action: 'HOSPITAL_APPROVED',
      entityType: 'HOSPITAL',
      entityId: hospitalId,
      actorRole: 'admin',
      hospitalId,
      hospitalName: targetHosp.name,
      summary: `Administrator ${adminUser.name} approved institutional registration for ${targetHosp.name} (${targetHosp.registrationNo || targetHosp.registration_no}). Full operational access granted.`,
      resultingStatus: 'APPROVED',
      metadata: {
        approvedAt: nowIso,
        approvedBy: adminUser.name,
      },
    });

    return {
      hospital: targetHosp,
      status: 'APPROVED',
      message: `Hospital ${targetHosp.name} successfully approved. Operational privileges activated.`,
    };
  },

  /**
   * Rejects a hospital registration with mandatory statutory justification
   */
  async rejectHospital(hospitalId, reason, adminUser = { name: 'Super Administrator', id: null }) {
    if (!reason || !reason.trim()) {
      const err = new Error('Validation Error: A specific rejection reason is mandatory.');
      err.statusCode = 422;
      throw err;
    }

    const cleanReason = reason.trim();
    const devHospitals = authService.getDevHospitals();
    const idx = devHospitals.findIndex((h) => h.id === hospitalId);

    const nowIso = new Date().toISOString();
    let targetHosp = null;

    if (idx !== -1) {
      devHospitals[idx].status = 'REJECTED';
      devHospitals[idx].rejectionReason = cleanReason;
      devHospitals[idx].rejected_at = nowIso;
      devHospitals[idx].rejected_by = adminUser.id || 'admin-01';

      if (devHospitals[idx].documents) {
        devHospitals[idx].documents = devHospitals[idx].documents.map((d) => ({
          ...d,
          documentStatus: 'rejected',
          document_status: 'rejected',
          rejectionReason: cleanReason,
        }));
      }
      targetHosp = devHospitals[idx];
    }

    if (isConfigured && supabaseAdmin) {
      try {
        const updatePayload = {
          status: 'REJECTED',
          rejection_reason: cleanReason,
          rejected_at: nowIso,
        };
        if (adminUser.id) updatePayload.rejected_by = adminUser.id;

        const { data: updatedHosp, error: hospErr } = await supabaseAdmin
          .from('hospitals')
          .update(updatePayload)
          .eq('id', hospitalId)
          .select()
          .single();

        if (!hospErr && updatedHosp) targetHosp = updatedHosp;

        await supabaseAdmin
          .from('hospital_documents')
          .update({
            document_status: 'rejected',
            rejection_reason: cleanReason,
          })
          .eq('hospital_id', hospitalId);

        // Notification record for the hospital
        await supabaseAdmin.from('notifications').insert([{
          id: uuidv4(),
          hospital_id: hospitalId,
          notification_type: 'REJECTION',
          type: 'error',
          title: 'Hospital Registration Rejected',
          message: `Your hospital registration was rejected by platform administration. Reason: ${cleanReason}`,
          link: '/login',
          is_read: false,
        }]);
      } catch (err) {
        logger.warn('Supabase update failed during rejectHospital:', err.message);
      }
    }

    if (!targetHosp) {
      const err = new Error('Hospital application not found.');
      err.statusCode = 404;
      throw err;
    }

    // Statutory Audit Log
    await auditService.logEvent({
      action: 'HOSPITAL_REJECTED',
      entityType: 'HOSPITAL',
      entityId: hospitalId,
      actorRole: 'admin',
      hospitalId,
      hospitalName: targetHosp.name,
      summary: `Administrator ${adminUser.name} rejected registration application for ${targetHosp.name}. Reason: ${cleanReason}`,
      resultingStatus: 'REJECTED',
      metadata: {
        reason: cleanReason,
        rejectedAt: nowIso,
        rejectedBy: adminUser.name,
      },
    });

    return {
      hospital: targetHosp,
      status: 'REJECTED',
      rejectionReason: cleanReason,
      message: `Hospital ${targetHosp.name} registration application rejected.`,
    };
  },

  /**
   * Sets intermediate review status and administrative internal review note
   */
  async setReviewStatus(hospitalId, status, note = '', adminUser = { name: 'Super Administrator' }) {
    const devHospitals = authService.getDevHospitals();
    const idx = devHospitals.findIndex((h) => h.id === hospitalId);

    if (idx !== -1) {
      devHospitals[idx].status = status;
      devHospitals[idx].reviewNote = note;
    }

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('hospitals').update({
          status,
          review_notes: note,
        }).eq('id', hospitalId);
      } catch (err) {
        logger.warn('Supabase update failed during setReviewStatus:', err.message);
      }
    }

    await auditService.logEvent({
      action: 'VERIFICATION_STATUS_CHANGED',
      entityType: 'VERIFICATION',
      entityId: hospitalId,
      hospitalId,
      hospitalName: devHospitals[idx]?.name || 'Hospital',
      summary: `Verification status updated to "${status}".`,
      resultingStatus: status,
      metadata: { note },
    });

    return devHospitals[idx] || { id: hospitalId, status, reviewNote: note };
  },

  /**
   * Verifies an individual statutory document
   */
  async verifyHospitalDocument(hospitalId, documentId, adminUser = { name: 'Super Administrator' }) {
    const devHospitals = authService.getDevHospitals();
    const hosp = devHospitals.find((h) => h.id === hospitalId);
    let updatedDoc = null;

    if (hosp && hosp.documents) {
      const doc = hosp.documents.find((d) => d.id === documentId || d.documentName === documentId);
      if (doc) {
        doc.documentStatus = 'verified';
        doc.verified = true;
        doc.reviewedAt = new Date().toISOString().split('T')[0];
        doc.rejectionReason = null;
        updatedDoc = doc;
      }
    }

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('hospital_documents').update({
          document_status: 'approved',
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        }).eq('id', documentId);
      } catch (err) {
        logger.warn('Supabase document verification update failed:', err.message);
      }
    }

    return { documentId, status: 'verified', document: updatedDoc };
  },

  /**
   * Rejects an individual statutory document with specific reason
   */
  async rejectHospitalDocument(hospitalId, documentId, reason, adminUser = { name: 'Super Administrator' }) {
    const devHospitals = authService.getDevHospitals();
    const hosp = devHospitals.find((h) => h.id === hospitalId);
    let updatedDoc = null;

    if (hosp && hosp.documents) {
      const doc = hosp.documents.find((d) => d.id === documentId || d.documentName === documentId);
      if (doc) {
        doc.documentStatus = 'rejected';
        doc.verified = false;
        doc.reviewedAt = new Date().toISOString().split('T')[0];
        doc.rejectionReason = reason || 'Document incomplete or invalid';
        updatedDoc = doc;
      }
    }

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('hospital_documents').update({
          document_status: 'rejected',
          verification_status: 'rejected',
          rejection_reason: reason,
        }).eq('id', documentId);
      } catch (err) {
        logger.warn('Supabase document rejection update failed:', err.message);
      }
    }

    return { documentId, status: 'rejected', reason, document: updatedDoc };
  },

  async verifyHospital(hospitalId, adminUser) {
    return this.approveHospital(hospitalId, adminUser);
  }
};

module.exports = verificationService;
