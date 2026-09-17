import { getStoredItem, setStoredItem, KEYS, getHospitalDocumentChecklist } from './storage.js';
import { auditService } from './auditService.js';
import { API_BASE, notifySessionExpired } from '../config/api.js';

export const authService = {
  // Login method for Hospital or Admin (Supports MedEx Express/Supabase API with offline fallback)
  async login({ email, password, role }) {
    // 1. Attempt authentication via MedEx Express / Supabase API
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success && data?.data) {
        const { user, token } = data.data;
        setStoredItem(KEYS.AUTH, { user, token });
        return { user, token };
      }

      // If backend returned a structured business rejection
      if (data?.error) {
        if (data.error.code === 'PENDING_ADMIN_APPROVAL') {
          const err = new Error(data.error.message || 'Your hospital registration is pending admin approval.');
          err.code = 'PENDING_ADMIN_APPROVAL';
          err.hospital = data.error.hospital;
          throw err;
        }
        if (data.error.code === 'REGISTRATION_REJECTED') {
          const err = new Error(data.error.message || 'Hospital registration was rejected.');
          err.code = 'REGISTRATION_REJECTED';
          err.rejectionReason = data.error.rejectionReason;
          err.hospital = data.error.hospital;
          throw err;
        }
        if (data.error.code === 'HOSPITAL_SUSPENDED') {
          const err = new Error(data.error.message || 'Hospital privileges are suspended.');
          err.code = 'HOSPITAL_SUSPENDED';
          throw err;
        }
        throw new Error(data.error.message || 'Login failed');
      }
    } catch (networkOrApiErr) {
      if (['PENDING_ADMIN_APPROVAL', 'REGISTRATION_REJECTED', 'HOSPITAL_SUSPENDED'].includes(networkOrApiErr.code)) {
        throw networkOrApiErr;
      }
      if (networkOrApiErr.message && !networkOrApiErr.message.includes('fetch') && !networkOrApiErr.message.includes('NetworkError') && !networkOrApiErr.message.includes('Failed to fetch')) {
        throw networkOrApiErr;
      }
      // Otherwise proceed to development storage verification
    }

    await new Promise((r) => setTimeout(r, 450)); // Realistic API delay

    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    let authResult = null;

    if (role === 'admin') {
      const emailLower = (email || '').toLowerCase().trim();
      if ((emailLower === 'admin@medex.org' || emailLower === 'admin@smartmedishare.org') && password === 'Admin@123') {
        const user = {
          id: 'admin-01',
          name: 'Super Administrator',
          email: 'admin@medex.org',
          role: 'admin',
          department: 'National Healthcare Logistics Oversight',
          phone: '+91 11 2345 6789',
        };
        const token = 'mock_jwt_token_admin_' + Date.now();
        setStoredItem(KEYS.AUTH, { user, token });
        authResult = { user, token };
      } else if (emailLower.includes('admin') || (password && password.length >= 6)) {
        const user = {
          id: 'admin-demo',
          name: 'Platform Ops Admin',
          email: email,
          role: 'admin',
          department: 'Compliance & Verification',
          phone: '+91 99887 76655',
        };
        const token = 'mock_jwt_token_admin_' + Date.now();
        setStoredItem(KEYS.AUTH, { user, token });
        authResult = { user, token };
      } else {
        throw new Error('Invalid Admin credentials. Use admin@medex.org / Admin@123');
      }
    } else {
      // Hospital role
      const emailLower = (email || '').toLowerCase().trim();
      const matched = hospitals.find((h) => {
        const hEmail = (h.email || '').toLowerCase().trim();
        return hEmail === emailLower ||
               hEmail.replace('@smartmedishare.org', '@medex.org') === emailLower ||
               hEmail.replace('@medex.org', '@smartmedishare.org') === emailLower;
      });
      if (matched) {
        // Enforce approval status check
        if (matched.status === 'pending' || matched.status === 'pending_approval') {
          const err = new Error('Your hospital registration is pending admin approval.');
          err.code = 'PENDING_ADMIN_APPROVAL';
          err.hospital = {
            id: matched.id,
            name: matched.name,
            registrationNo: matched.registrationNo,
            email: matched.email,
            status: matched.status,
            city: matched.city,
            state: matched.state,
          };
          throw err;
        }

        if (matched.status === 'rejected') {
          const err = new Error(matched.rejectionReason || 'Hospital registration requires attention.');
          err.code = 'REGISTRATION_REJECTED';
          err.rejectionReason = matched.rejectionReason || 'Statutory documentation incomplete or failed compliance verification.';
          err.hospital = {
            id: matched.id,
            name: matched.name,
            registrationNo: matched.registrationNo,
            email: matched.email,
            status: matched.status,
          };
          throw err;
        }

        if (matched.status === 'suspended') {
          const err = new Error('Hospital operational privileges have been suspended by central logistics oversight.');
          err.code = 'HOSPITAL_SUSPENDED';
          throw err;
        }

        // Only approved / verified hospital gets active session
        const user = {
          id: matched.id,
          name: matched.name,
          email: matched.email,
          role: 'hospital',
          status: matched.status,
          registrationNo: matched.registrationNo,
          authorizedPerson: matched.authorizedPerson,
          city: matched.city,
          state: matched.state,
          phone: matched.phone,
        };
        const token = 'mock_jwt_token_hospital_' + Date.now();
        setStoredItem(KEYS.AUTH, { user, token });
        authResult = { user, token };
      } else if (emailLower === 'apollo.mumbai@medex.org' || emailLower === 'apollo.mumbai@smartmedishare.org' || emailLower.includes('apollo')) {
        // Default quick login fallback (Apollo Hospital - verified)
        const defaultHosp = hospitals.find((h) => h.id === 'hosp-1' || h.name?.includes('Apollo')) || hospitals[0] || {
          id: 'hosp-1',
          name: 'Apollo Hospital',
          email: 'apollo.mumbai@medex.org',
          city: 'Mumbai',
          status: 'verified',
        };
        const user = {
          id: defaultHosp.id,
          name: defaultHosp.name,
          email: defaultHosp.email,
          role: 'hospital',
          status: defaultHosp.status,
          registrationNo: defaultHosp.registrationNo,
          authorizedPerson: defaultHosp.authorizedPerson,
          city: defaultHosp.city,
          state: defaultHosp.state,
          phone: defaultHosp.phone,
        };
        const token = 'mock_jwt_token_hospital_' + Date.now();
        setStoredItem(KEYS.AUTH, { user, token });
        authResult = { user, token };
      } else if (emailLower.includes('fortis') || emailLower === 'fortis.gurgaon@medex.org' || emailLower === 'fortis.gurgaon@smartmedishare.org') {
        const fortisHosp = hospitals.find((h) => h.id === 'hosp-2' || h.name?.includes('Fortis')) || {
          id: 'hosp-2',
          name: 'Fortis Memorial Research Institute',
          email: 'fortis.gurgaon@medex.org',
          city: 'Gurgaon',
          status: 'verified',
        };
        const user = {
          id: fortisHosp.id,
          name: fortisHosp.name,
          email: fortisHosp.email,
          role: 'hospital',
          status: fortisHosp.status,
          registrationNo: fortisHosp.registrationNo,
          authorizedPerson: fortisHosp.authorizedPerson,
          city: fortisHosp.city,
          state: fortisHosp.state,
          phone: fortisHosp.phone,
        };
        const token = 'mock_jwt_token_hospital_' + Date.now();
        setStoredItem(KEYS.AUTH, { user, token });
        authResult = { user, token };
      } else {
        throw new Error('Hospital account not found. Please check your credentials or complete institutional registration.');
      }
    }

    if (authResult?.user) {
      auditService.logEvent({
        action: 'AUTH_LOGIN',
        entityType: 'AUTH',
        entityId: authResult.user.id,
        actorRole: authResult.user.role,
        hospitalId: authResult.user.role === 'hospital' ? authResult.user.id : null,
        hospitalName: authResult.user.name,
        summary: `Authenticated user session created for ${authResult.user.name} (${authResult.user.role.toUpperCase()}).`,
        resultingStatus: 'authenticated',
        metadata: { role: authResult.user.role, department: authResult.user.department || 'Clinical Operations' },
      });
    }

    return authResult;
  },

  async signupHospital(formData) {
    // 1. Attempt registration via real MedEx Express backend API
    try {
      const response = await fetch(`${API_BASE}/hospitals/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.success && data?.data) {
        const hospitalPayload = data.data.hospital;
        // Keep in local storage cache for offline components
        const hospitals = getStoredItem(KEYS.HOSPITALS, []);
        const existingIdx = hospitals.findIndex((h) => h.id === hospitalPayload.id || h.email === hospitalPayload.email);
        if (existingIdx !== -1) {
          hospitals[existingIdx] = hospitalPayload;
        } else {
          hospitals.unshift(hospitalPayload);
        }
        setStoredItem(KEYS.HOSPITALS, hospitals);

        return {
          hospital: hospitalPayload,
          status: data.data.status || 'PENDING_APPROVAL',
          message: data.data.message || 'Hospital Registered Successfully. Your registration is pending admin approval.',
        };
      }

      if (data?.error) {
        throw new Error(data.error.message || 'Registration failed');
      }
    } catch (apiErr) {
      if (apiErr.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('NetworkError') && !apiErr.message.includes('Failed to fetch')) {
        throw apiErr;
      }
      // Otherwise proceed to development storage verification
    }

    await new Promise((r) => setTimeout(r, 400));
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);

    // Strict validation: every mandatory statutory document must be submitted
    const docChecklist = getHospitalDocumentChecklist(formData?.documents || []);
    if (!docChecklist.isComplete) {
      const missingLabels = (docChecklist.missingItems || []).map((m) => m.label).join(', ');
      throw new Error(`Application submission blocked: All required documents must be submitted before registration. Missing: ${missingLabels}`);
    }

    // Prevent duplicate hospital records on repeated clicks or duplicate registration
    const existingIndex = hospitals.findIndex(
      (h) => (formData?.email && h.email?.toLowerCase() === formData.email.toLowerCase()) ||
             (formData?.registrationNo && h.registrationNo?.toLowerCase() === formData.registrationNo.toLowerCase())
    );

    const hospitalId = existingIndex !== -1 ? hospitals[existingIndex].id : ('hosp-' + Date.now());
    const normalizedDocs = (docChecklist.items || []).filter((d) => d.isSubmitted).map((doc, idx) => ({
      id: doc.id || `doc-${hospitalId}-${idx + 1}`,
      hospitalId: hospitalId,
      documentType: doc.documentType || doc.type || 'Registration Certificate',
      documentName: doc.documentName || doc.name || `${(doc.documentType || 'Document').replace(/\s+/g, '_')}.pdf`,
      name: doc.name || doc.documentName || `${(doc.documentType || 'Document').replace(/\s+/g, '_')}.pdf`,
      type: doc.type || doc.documentType || 'Registration Certificate',
      required: true,
      submissionStatus: 'submitted',
      status: 'Submitted',
      size: doc.size || '2.4 MB',
      uploadedAt: new Date().toISOString().split('T')[0],
      documentUrl: doc.documentUrl || `/documents/${doc.documentName || doc.name || 'document.pdf'}`,
      uploadedBy: formData?.authorizedPerson || formData?.contactPerson || 'Hospital Administrator',
    }));

    const stableRegNo = formData?.registrationNo?.trim() || 
      (existingIndex !== -1 && hospitals[existingIndex].registrationNo ? hospitals[existingIndex].registrationNo : ('HOSP-2026-' + (hospitalId.replace('hosp-', '').slice(-4) || '9012')));

    const hospitalData = {
      id: hospitalId,
      name: formData?.name || 'Healthcare Institution',
      registrationNo: stableRegNo,
      authorizedPerson: formData?.authorizedPerson || formData?.contactPerson || 'Chief Pharmacist',
      email: formData?.email || '',
      phone: formData?.phone || '',
      address: formData?.address || '',
      city: formData?.city || '',
      state: formData?.state || '',
      pincode: formData?.pincode || '',
      status: 'pending', // PENDING ADMIN APPROVAL (Operational trading access blocked until verified)
      registeredDate: existingIndex !== -1 ? (hospitals[existingIndex].registeredDate || new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
      verifiedDate: null,
      documents: normalizedDocs,
    };

    if (existingIndex !== -1) {
      hospitals[existingIndex] = { ...hospitals[existingIndex], ...hospitalData };
    } else {
      hospitals.unshift(hospitalData);
    }
    setStoredItem(KEYS.HOSPITALS, hospitals);

    // Record application-level audit event
    auditService.logEvent({
      action: 'HOSPITAL_APPLICATION_SUBMITTED',
      entityType: 'Hospitals',
      entityId: hospitalData.id,
      hospitalId: hospitalData.id,
      hospitalName: hospitalData.name,
      actor: hospitalData.authorizedPerson,
      adminUser: hospitalData.authorizedPerson,
      summary: `Hospital registration application submitted for ${hospitalData.name} (${hospitalData.registrationNo}) with all ${normalizedDocs.length} required statutory documents. Account status set to Pending Admin Approval.`,
      resultingStatus: 'pending',
      metadata: {
        registrationNo: hospitalData.registrationNo,
        submittedDocuments: normalizedDocs.length,
        documents: normalizedDocs.map((d) => d.documentType),
      },
    });

    // CRITICAL: DO NOT create an active authenticated session in KEYS.AUTH!
    // Hospital remains in PENDING_APPROVAL state until administrator reviews and approves.
    return {
      hospital: hospitalData,
      status: 'pending',
      message: 'Your hospital registration has been submitted successfully. Kindly wait for admin approval before accessing the hospital portal.',
    };
  },

  async signupAdmin(formData) {
    await new Promise((r) => setTimeout(r, 500));
    const user = {
      id: 'admin-' + Date.now(),
      name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      department: formData.department,
      role: 'admin',
    };
    const token = 'mock_jwt_token_admin_' + Date.now();
    setStoredItem(KEYS.AUTH, { user, token });
    return { user, token };
  },

  async switchHospital(hospitalId) {
    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const matched = hospitals.find((h) => h.id === hospitalId) || hospitals[0];
    if (!matched) throw new Error('Hospital not found');

    const user = {
      id: matched.id,
      name: matched.name,
      email: matched.email,
      role: 'hospital',
      status: matched.status || 'verified',
      registrationNo: matched.registrationNo,
      authorizedPerson: matched.authorizedPerson,
      city: matched.city,
      state: matched.state,
      phone: matched.phone,
    };
    const token = 'mock_jwt_token_hosp_' + matched.id;
    setStoredItem(KEYS.AUTH, { user, token });
    return { user, token };
  },

  async getCurrentSession() {
    const session = this.validateSession();
    if (session?.token) {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.data?.user) {
            const updated = { ...session, user: { ...session.user, ...data.data.user } };
            setStoredItem(KEYS.AUTH, updated);
            return updated;
          }
        } else if (response.status === 401) {
          notifySessionExpired();
          await this.logout();
          return null;
        }
      } catch (e) {
        // Fallback to local session
      }
    }
    return session;
  },

  validateSession() {
    const session = getStoredItem(KEYS.AUTH, null);
    if (!session || !session.user || !session.token) {
      return null;
    }
    if (!['admin', 'hospital'].includes(session.user.role)) {
      this.logout();
      return null;
    }
    return session;
  },

  async logout() {
    const session = getStoredItem(KEYS.AUTH, null);
    if (session?.token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
        });
      } catch (e) {
        // Ignore network failure during logout
      }
    }
    if (session?.user) {
      auditService.logEvent({
        action: 'AUTH_LOGOUT',
        entityType: 'AUTH',
        entityId: session.user.id,
        actorRole: session.user.role,
        hospitalId: session.user.role === 'hospital' ? session.user.id : null,
        hospitalName: session.user.name,
        summary: `User session safely terminated for ${session.user.name}.`,
        resultingStatus: 'logged_out',
      });
    }
    localStorage.removeItem(KEYS.AUTH);
    return true;
  }
};
