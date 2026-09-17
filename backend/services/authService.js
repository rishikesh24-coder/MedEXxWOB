const { supabaseAnon, supabaseAdmin, isConfigured } = require('../config/supabase');
const auditService = require('./auditService');
const logger = require('../utils/logger');

// In-memory mock hospital dataset for dev/testing when Supabase is in placeholder mode
const devHospitals = [
  {
    id: 'hosp-1',
    name: 'Apollo Hospital',
    registrationNo: 'MH-MUM-2023-8821',
    authorizedPerson: 'Dr. Ramesh Sharma (Chief Pharmacist)',
    email: 'apollo.mumbai@medex.org',
    phone: '+91 98201 54321',
    address: 'Plot 13, Off Western Express Highway',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400076',
    status: 'verified',
    registeredDate: '2024-01-15',
    verifiedDate: '2024-01-18',
    documents: [
      { id: 'doc-1-1', documentType: 'Registration Certificate', documentName: 'Apollo_Reg_Certificate.pdf', documentStatus: 'verified' },
      { id: 'doc-1-2', documentType: 'Drug License', documentName: 'Apollo_Form20B_License.pdf', documentStatus: 'verified' },
      { id: 'doc-1-3', documentType: 'GST Certificate', documentName: 'Apollo_GSTIN_Filing.pdf', documentStatus: 'verified' },
      { id: 'doc-1-4', documentType: 'Authorization Letter', documentName: 'Apollo_Board_Resolution.pdf', documentStatus: 'verified' },
    ]
  },
  {
    id: 'hosp-pending-demo',
    name: 'Metro Care Super Speciality Hospital',
    registrationNo: 'MH-PUN-2024-1102',
    authorizedPerson: 'Dr. Anita Joshi (Director of Pharmacy)',
    email: 'metro.care@medex.org',
    phone: '+91 98220 12345',
    address: 'FC Road, Shivajinagar',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411005',
    status: 'pending',
    registeredDate: new Date().toISOString().split('T')[0],
    verifiedDate: null,
    documents: [
      { id: 'doc-p-1', documentType: 'Registration Certificate', documentName: 'Metro_Reg_Certificate.pdf', documentStatus: 'pending' },
      { id: 'doc-p-2', documentType: 'Drug License', documentName: 'Metro_Drug_License.pdf', documentStatus: 'pending' },
      { id: 'doc-p-3', documentType: 'GST Certificate', documentName: 'Metro_GST_Certificate.pdf', documentStatus: 'pending' },
      { id: 'doc-p-4', documentType: 'Authorization Letter', documentName: 'Metro_Board_Authorization.pdf', documentStatus: 'pending' },
    ]
  },
  {
    id: 'hosp-rejected-demo',
    name: 'City Trauma & Research Centre',
    registrationNo: 'DL-DEL-2023-7744',
    authorizedPerson: 'Dr. Vikram Malhotra',
    email: 'city.trauma@medex.org',
    phone: '+91 98110 55443',
    address: 'Ring Road, Lajpat Nagar',
    city: 'New Delhi',
    state: 'Delhi',
    pincode: '110024',
    status: 'rejected',
    rejectionReason: 'Pharmacy drug license expired and clinical establishment act registration unverified.',
    registeredDate: '2024-06-10',
    verifiedDate: null,
    documents: [
      { id: 'doc-r-1', documentType: 'Registration Certificate', documentName: 'City_Reg_Certificate.pdf', documentStatus: 'rejected', rejectionReason: 'Registration expired' },
      { id: 'doc-r-2', documentType: 'Drug License', documentName: 'City_Drug_License.pdf', documentStatus: 'rejected', rejectionReason: 'Expired form 20B license' },
    ]
  }
];

const MANDATORY_DOCUMENT_TYPES = [
  'Registration Certificate',
  'Drug License',
  'GST Certificate',
  'Authorization Letter',
];

const authService = {
  /**
   * Authenticates Hospital or Admin with full verification status gate
   */
  async login({ email, password, role }) {
    const emailClean = (email || '').toLowerCase().trim();
    const roleClean = (role || 'hospital').toLowerCase().trim();

    // 1. Supabase Auth (Configured Mode)
    if (isConfigured && supabaseAnon) {
      const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
        email: emailClean,
        password,
      });

      if (!authError && authData?.user) {
        const client = supabaseAdmin || supabaseAnon;
        const { data: userProfile } = await client
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        const userRole = userProfile?.role || authData.user.user_metadata?.role || roleClean;
        const hospitalId = userProfile?.hospital_id || authData.user.user_metadata?.hospital_id;

        if (userRole === 'hospital' && hospitalId) {
          const { data: hospital } = await client
            .from('hospitals')
            .select('*')
            .eq('id', hospitalId)
            .single();

          if (hospital) {
            this.enforceHospitalStatus(hospital);
          }
        }

        const sessionUser = {
          id: authData.user.id,
          email: authData.user.email,
          name: userProfile?.name || authData.user.user_metadata?.name || 'Authorized User',
          role: userRole,
          hospitalId: hospitalId || null,
        };

        await auditService.logEvent({
          action: 'AUTH_LOGIN',
          entityType: 'AUTH',
          entityId: sessionUser.id,
          actorRole: sessionUser.role,
          hospitalId: sessionUser.hospitalId,
          hospitalName: sessionUser.name,
          summary: `Authenticated user session created for ${sessionUser.name} (${sessionUser.role.toUpperCase()}).`,
          resultingStatus: 'authenticated',
        });

        if (process.env.NODE_ENV === 'production' && !authData.session?.access_token) {
          const err = new Error('Failed to obtain authenticated session token.');
          err.statusCode = 401;
          throw err;
        }

        return {
          user: sessionUser,
          token: authData.session?.access_token || `jwt_${Date.now()}`,
        };
      }

      if (process.env.NODE_ENV === 'production') {
        const err = new Error(authError?.message || 'Invalid credentials.');
        err.statusCode = 401;
        throw err;
      }

      const isDevAdmin = emailClean === 'admin@medex.org' || emailClean.includes('admin') || roleClean === 'admin';
      const isDevHospital = devHospitals.some(
        (h) => h.email.toLowerCase() === emailClean || emailClean.includes(h.name.toLowerCase().split(' ')[0])
      ) || emailClean.includes('apollo') || emailClean.includes('fortis') || emailClean.includes('metro');

      if (!isDevAdmin && !isDevHospital) {
        const err = new Error(authError?.message || 'Invalid credentials.');
        err.statusCode = 401;
        throw err;
      }

      logger.info(`Supabase Auth did not find user for ${emailClean}. Verifying against local development credential profile.`);
    }

    // 2. Development / Sandbox Fallback Mode
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('Invalid credentials.');
      err.statusCode = 401;
      throw err;
    }

    if (roleClean === 'admin') {
      if ((emailClean === 'admin@medex.org' || emailClean.includes('admin')) && (!password || password.length >= 6)) {
        const user = {
          id: 'admin-01',
          name: 'Super Administrator',
          email: 'admin@medex.org',
          role: 'admin',
          department: 'National Healthcare Logistics Oversight',
          phone: '+91 11 2345 6789',
        };
        const token = `mock_jwt_token_admin_${Date.now()}`;
        return { user, token };
      }
      const err = new Error('Invalid Admin credentials. Use admin@medex.org / Admin@123');
      err.statusCode = 401;
      throw err;
    }

    // Hospital Role Fallback
    const matchedHospital = devHospitals.find(
      (h) => h.email.toLowerCase() === emailClean ||
             h.email.replace('@smartmedishare.org', '@medex.org') === emailClean ||
             emailClean.includes(h.name.toLowerCase().split(' ')[0])
    ) || (emailClean.includes('apollo') ? devHospitals[0] : null);

    if (!matchedHospital) {
      const err = new Error('Hospital account not found. Please check your credentials or complete institutional registration.');
      err.statusCode = 404;
      throw err;
    }

    // Enforce Approval Status Gate
    this.enforceHospitalStatus(matchedHospital);

    const user = {
      id: matchedHospital.id,
      name: matchedHospital.name,
      email: matchedHospital.email,
      role: 'hospital',
      status: matchedHospital.status,
      registrationNo: matchedHospital.registrationNo,
      authorizedPerson: matchedHospital.authorizedPerson,
      city: matchedHospital.city,
      state: matchedHospital.state,
      phone: matchedHospital.phone,
      hospitalId: matchedHospital.id,
    };
    const token = `mock_jwt_token_hospital_${matchedHospital.id}_${Date.now()}`;

    await auditService.logEvent({
      action: 'AUTH_LOGIN',
      entityType: 'AUTH',
      entityId: user.id,
      actorRole: 'hospital',
      hospitalId: user.hospitalId,
      hospitalName: user.name,
      summary: `Hospital user session created for ${user.name}.`,
      resultingStatus: 'authenticated',
    });

    return { user, token };
  },

  /**
   * Enforces status gate checks
   */
  enforceHospitalStatus(hospital) {
    const status = (hospital.status || '').toLowerCase();
    if (status === 'pending' || status === 'under_review' || status === 'pending_approval') {
      const err = new Error('Your hospital registration is pending admin approval.');
      err.statusCode = 403;
      err.code = 'PENDING_ADMIN_APPROVAL';
      err.hospital = {
        id: hospital.id,
        name: hospital.name,
        registrationNo: hospital.registrationNo || hospital.registration_no,
        email: hospital.email,
        status: hospital.status,
        city: hospital.city,
        state: hospital.state,
      };
      throw err;
    }

    if (status === 'rejected') {
      const reason = hospital.rejectionReason || hospital.rejection_reason || 'Statutory documentation incomplete or failed compliance verification.';
      const err = new Error(`Hospital registration was rejected. Reason: ${reason}`);
      err.statusCode = 403;
      err.code = 'REGISTRATION_REJECTED';
      err.rejectionReason = reason;
      err.hospital = {
        id: hospital.id,
        name: hospital.name,
        registrationNo: hospital.registrationNo || hospital.registration_no,
        email: hospital.email,
        status: hospital.status,
      };
      throw err;
    }

    if (status === 'suspended') {
      const err = new Error('Hospital operational privileges have been suspended by central logistics oversight.');
      err.statusCode = 403;
      err.code = 'HOSPITAL_SUSPENDED';
      throw err;
    }
  },

  /**
   * Registers new hospital application with statutory document checklist validation
   */
  async signupHospital(formData) {
    const documents = formData?.documents || [];

    // 1. Strict Statutory Document Validation
    const submittedTypes = new Set(
      documents.map((d) => (d.documentType || d.type || '').toLowerCase())
    );

    const missingDocuments = MANDATORY_DOCUMENT_TYPES.filter((reqType) => {
      const target = reqType.toLowerCase();
      let found = false;
      for (const submitted of submittedTypes) {
        if (
          submitted.includes(target) ||
          (target.includes('registration') && (submitted.includes('establishment') || submitted.includes('reg'))) ||
          (target.includes('drug') && (submitted.includes('drug') || submitted.includes('license') || submitted.includes('form20'))) ||
          (target.includes('gst') && submitted.includes('gst')) ||
          (target.includes('authorization') && (submitted.includes('authoriz') || submitted.includes('resolution')))
        ) {
          found = true;
          break;
        }
      }
      return !found;
    });

    if (missingDocuments.length > 0) {
      const err = new Error(
        `Application submission blocked: All mandatory statutory documents must be submitted. Missing: ${missingDocuments.join(', ')}`
      );
      err.statusCode = 400;
      err.code = 'MANDATORY_DOCUMENTS_MISSING';
      err.missingDocuments = missingDocuments;
      throw err;
    }

    const hospitalId = 'hosp-' + Date.now();
    const normalizedDocs = documents.map((doc, idx) => ({
      id: doc.id || `doc-${hospitalId}-${idx + 1}`,
      hospitalId,
      documentType: doc.documentType || doc.type || 'Statutory Filing',
      documentName: doc.documentName || doc.name || 'Document.pdf',
      submissionStatus: 'submitted',
      documentStatus: 'pending',
      fileSize: doc.size || '2.4 MB',
      uploadedAt: new Date().toISOString(),
    }));

    const hospitalRecord = {
      id: hospitalId,
      name: formData.name,
      registrationNo: formData.registrationNo,
      authorizedPerson: formData.authorizedPerson || formData.contactPerson,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      status: 'pending', // PENDING_APPROVAL
      registeredDate: new Date().toISOString().split('T')[0],
      verifiedDate: null,
      documents: normalizedDocs,
    };

    if (isConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('hospitals').insert([{
          id: hospitalRecord.id,
          name: hospitalRecord.name,
          registration_no: hospitalRecord.registrationNo,
          authorized_person: hospitalRecord.authorizedPerson,
          email: hospitalRecord.email,
          phone: hospitalRecord.phone,
          address: hospitalRecord.address,
          city: hospitalRecord.city,
          state: hospitalRecord.state,
          pincode: hospitalRecord.pincode,
          status: 'pending',
        }]);

        const docInserts = normalizedDocs.map((d) => ({
          id: d.id,
          hospital_id: hospitalRecord.id,
          document_type: d.documentType,
          document_name: d.documentName,
          file_path: `/documents/${d.documentName}`,
          file_size: d.fileSize,
          submission_status: 'submitted',
          document_status: 'pending',
        }));
        await supabaseAdmin.from('hospital_documents').insert(docInserts);
      } catch (err) {
        logger.warn('Supabase insertion failed during hospital signup. Storing in local state:', err.message);
      }
    }

    devHospitals.unshift(hospitalRecord);

    await auditService.logEvent({
      action: 'HOSPITAL_APPLICATION_SUBMITTED',
      entityType: 'HOSPITAL',
      entityId: hospitalRecord.id,
      hospitalId: hospitalRecord.id,
      hospitalName: hospitalRecord.name,
      summary: `Hospital application submitted for ${hospitalRecord.name} (${hospitalRecord.registrationNo}) with ${normalizedDocs.length} statutory documents. Status set to Pending Admin Approval.`,
      resultingStatus: 'pending',
      metadata: {
        registrationNo: hospitalRecord.registrationNo,
        submittedDocuments: normalizedDocs.length,
      },
    });

    // CRITICAL: Return pending status WITHOUT an active auth session!
    return {
      hospital: hospitalRecord,
      status: 'pending',
      message: 'Your hospital registration has been submitted successfully. Kindly wait for admin approval before accessing the hospital portal.',
    };
  },

  /**
   * Registers a new platform administrator
   */
  async signupAdmin(formData) {
    const adminUser = {
      id: 'admin-' + Date.now(),
      name: formData.fullName || formData.name,
      email: formData.email,
      phone: formData.phone,
      department: formData.department || 'National Healthcare Logistics Oversight',
      role: 'admin',
    };

    if (isConfigured && supabaseAdmin) {
      try {
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: adminUser.email,
          password: formData.password || 'Admin@123',
          email_confirm: true,
          user_metadata: { name: adminUser.name, role: 'admin' },
        });

        if (!authErr && authUser.user) {
          adminUser.id = authUser.user.id;
          await supabaseAdmin.from('users').insert([{
            id: authUser.user.id,
            email: adminUser.email,
            name: adminUser.name,
            role: 'admin',
            department: adminUser.department,
            phone: adminUser.phone,
          }]);
        }
      } catch (err) {
        logger.warn('Supabase admin signup fallback:', err.message);
      }
    }

    if (process.env.NODE_ENV === 'production') {
      return { user: adminUser, message: 'Administrator account registered successfully. Please proceed to login.' };
    }

    const token = `mock_jwt_token_admin_${Date.now()}`;
    return { user: adminUser, token };
  },

  async logout(user) {
    if (user) {
      await auditService.logEvent({
        action: 'AUTH_LOGOUT',
        entityType: 'AUTH',
        entityId: user.id,
        actorRole: user.role,
        hospitalId: user.hospitalId,
        hospitalName: user.name,
        summary: `User session safely logged out for ${user.name || user.email}.`,
        resultingStatus: 'logged_out',
      });
    }
    return true;
  },

  getDevHospitals() {
    return devHospitals;
  }
};

module.exports = authService;
