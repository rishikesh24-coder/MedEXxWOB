const { supabaseAnon, supabaseAdmin, isConfigured } = require('../config/supabase');
const { errorResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Authenticates user from Bearer JWT token using Supabase Auth
 * Maps authenticated user to MedEx user and hospital profiles.
 */
const authenticateUser = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query?.token) {
      token = req.query.token;
    }

    if (!token || token.trim() === '') {
      return errorResponse(res, 'Authentication token is required.', 401, 'UNAUTHORIZED');
    }

    // 1. Supabase Auth Verification (Production / Connected mode)
    if (isConfigured && supabaseAnon) {
      // First attempt Supabase getUser token verification
      const { data: authData, error: authError } = await supabaseAnon.auth.getUser(token);

      if (!authError && authData?.user) {
        const client = supabaseAdmin || supabaseAnon;
        
        // Fetch authoritative user profile
        const { data: dbUser } = await client
          .from('users')
          .select('id, email, name, role, hospital_id, is_active')
          .eq('id', authData.user.id)
          .single();

        const role = dbUser?.role || authData.user.user_metadata?.role || 'hospital';
        const hospitalId = dbUser?.hospital_id || authData.user.user_metadata?.hospital_id || null;
        const name = dbUser?.name || authData.user.user_metadata?.name || 'Authorized User';

        if (dbUser && !dbUser.is_active) {
          return errorResponse(res, 'User account is deactivated.', 403, 'ACCOUNT_DEACTIVATED');
        }

        req.user = {
          id: authData.user.id,
          email: authData.user.email,
          role,
          hospitalId,
          name,
        };

        // If user belongs to a hospital, load authoritative hospital record
        if (role === 'hospital' && hospitalId) {
          const { data: dbHospital } = await client
            .from('hospitals')
            .select('id, name, registration_no, status, city, state, email, rejection_reason')
            .eq('id', hospitalId)
            .single();

          if (dbHospital) {
            req.hospital = {
              id: dbHospital.id,
              name: dbHospital.name,
              registrationNo: dbHospital.registration_no,
              status: dbHospital.status,
              city: dbHospital.city,
              state: dbHospital.state,
              email: dbHospital.email,
              rejectionReason: dbHospital.rejection_reason,
            };
          } else if (process.env.NODE_ENV !== 'production') {
            const devHosp = require('../services/authService').getDevHospitals().find((h) => h.id === hospitalId);
            if (devHosp) {
              req.hospital = {
                id: devHosp.id,
                name: devHosp.name,
                registrationNo: devHosp.registrationNo || devHosp.registration_no,
                status: devHosp.status,
                city: devHosp.city,
                state: devHosp.state,
                email: devHosp.email,
                rejectionReason: devHosp.rejectionReason || devHosp.rejection_reason,
              };
            }
          }
        }

        if (req.hospital) {
          req.user.hospital = req.hospital;
        }

        return next();
      }
    }

    // 2. Development / Demo Token Verification (Fallback for offline/dev simulations ONLY)
    // CRITICAL SECURITY GATING: In production, mock/demo tokens are strictly forbidden and must fail closed.
    if (process.env.NODE_ENV !== 'production') {
      // Check if token references a dynamically registered hospital
      const devHospitals = require('../services/authService').getDevHospitals();
      const matchedHosp = devHospitals.find((h) => token.includes(h.id) || h.id === token);
      if (matchedHosp) {
        req.user = {
          id: `user-${matchedHosp.id}`,
          email: matchedHosp.email,
          role: 'hospital',
          hospitalId: matchedHosp.id,
          name: matchedHosp.authorizedPerson || matchedHosp.name,
        };
        req.hospital = {
          id: matchedHosp.id,
          name: matchedHosp.name,
          registrationNo: matchedHosp.registrationNo || matchedHosp.registration_no,
          status: matchedHosp.status,
          city: matchedHosp.city,
          state: matchedHosp.state,
          email: matchedHosp.email,
          rejectionReason: matchedHosp.rejectionReason || matchedHosp.rejection_reason,
        };
        req.user.hospital = req.hospital;
        return next();
      }

      if (token.includes('admin')) {
        req.user = {
          id: 'admin-01',
          email: 'admin@medex.org',
          role: 'admin',
          hospitalId: null,
          name: 'Super Administrator',
        };
        return next();
      }

      if (token.includes('pending')) {
        req.user = {
          id: 'hosp-pending-demo',
          email: 'metro.care@medex.org',
          role: 'hospital',
          hospitalId: '33333333-3333-3333-3333-333333333333',
          name: 'Metro Care Daycare & Community Clinic',
        };
        req.hospital = {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'Metro Care Daycare & Community Clinic',
          registrationNo: 'REG-UP-2024-5512',
          status: 'PENDING_APPROVAL',
          city: 'Noida',
          state: 'Uttar Pradesh',
          email: 'admin@metrocare-demo.org',
        };
        req.user.hospital = req.hospital;
        return next();
      }

      if (token.includes('rejected')) {
        req.user = {
          id: 'hosp-rejected-demo',
          email: 'city.trauma@medex.org',
          role: 'hospital',
          hospitalId: '44444444-4444-4444-4444-444444444444',
          name: 'City Trauma & Emergency Centre',
        };
        req.hospital = {
          id: '44444444-4444-4444-4444-444444444444',
          name: 'City Trauma & Emergency Centre',
          registrationNo: 'REG-RJ-2024-9901',
          status: 'REJECTED',
          city: 'Jaipur',
          state: 'Rajasthan',
          email: 'liaison@citytrauma-demo.org',
          rejectionReason: 'Drug License Form 20B/21B expired and NABH compliance document unverified.',
        };
        req.user.hospital = req.hospital;
        return next();
      }

      if (token.includes('fortis') || token.includes('22222222-2222-2222-2222-222222222222')) {
        req.user = {
          id: '22222222-2222-2222-2222-222222222222',
          email: 'fortis.gurugram@medex.org',
          role: 'hospital',
          hospitalId: '22222222-2222-2222-2222-222222222222',
          name: 'Fortis Memorial Research Institute',
        };
        req.hospital = {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Fortis Memorial Research Institute',
          registrationNo: 'REG-HR-2023-4412',
          status: 'APPROVED',
          city: 'Gurugram',
          state: 'Haryana',
          email: 'supply@fortis-demo.org',
        };
        req.user.hospital = req.hospital;
        return next();
      }

      if (token.includes('hosp') || token.includes('hospital') || token.includes('apollo') || token.includes('11111111')) {
        req.user = {
          id: '11111111-1111-1111-1111-111111111111',
          email: 'apollo.mumbai@medex.org',
          role: 'hospital',
          hospitalId: '11111111-1111-1111-1111-111111111111',
          name: 'Apollo Hospital & Multi-Specialty Centre',
        };
        req.hospital = {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Apollo Hospital & Multi-Specialty Centre',
          registrationNo: 'REG-DL-2023-0891',
          status: 'APPROVED',
          city: 'New Delhi',
          state: 'Delhi',
          email: 'procurement@apollo-demo.org',
        };
        req.user.hospital = req.hospital;
        return next();
      }
    }

    // Token was provided but neither Supabase nor dev rules could validate it
    return errorResponse(res, 'Invalid or expired session token.', 401, 'INVALID_TOKEN');
  } catch (err) {
    logger.error('Authentication middleware error:', err.message);
    return errorResponse(res, 'Failed to authenticate user.', 401, 'AUTH_ERROR');
  }
};

/**
 * Enforces admin-only access
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return errorResponse(
      res,
      'Access restricted: Administrator privileges required.',
      403,
      'FORBIDDEN_ADMIN_ONLY'
    );
  }
  next();
};

/**
 * Enforces verified/approved hospital role access for operational endpoints
 * Blocks pending, rejected, and suspended hospitals with specific codes.
 */
const requireHospital = (req, res, next) => {
  if (!req.user || req.user.role !== 'hospital') {
    return errorResponse(
      res,
      'Access restricted: Hospital institutional account required.',
      403,
      'FORBIDDEN_HOSPITAL_ONLY'
    );
  }

  const rawStatus = (req.hospital?.status || '').toUpperCase();

  if (rawStatus === 'PENDING_APPROVAL' || rawStatus === 'PENDING' || rawStatus === 'UNDER_REVIEW') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'PENDING_ADMIN_APPROVAL',
        status: 'PENDING_APPROVAL',
        message: 'Your hospital registration is pending administrator approval. Operational access is restricted until verified.',
        hospital: req.hospital,
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (rawStatus === 'REJECTED') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'REGISTRATION_REJECTED',
        status: 'REJECTED',
        message: req.hospital?.rejectionReason || 'Hospital registration was rejected by administrative oversight.',
        rejectionReason: req.hospital?.rejectionReason,
        hospital: req.hospital,
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (rawStatus === 'SUSPENDED') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'HOSPITAL_SUSPENDED',
        status: 'SUSPENDED',
        message: 'Hospital operational privileges have been suspended by central logistics oversight.',
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (rawStatus === 'APPROVED' || rawStatus === 'VERIFIED') {
    return next();
  }

  // Unknown or unconfigured status defaults to forbidden
  return errorResponse(
    res,
    'Hospital registration status does not permit operational transactions.',
    403,
    'UNVERIFIED_HOSPITAL_STATUS'
  );
};

/**
 * Allows both approved and pending hospitals (e.g. for registration status and document upload)
 * Blocks non-hospitals, rejected, and suspended hospitals.
 */
const allowPendingHospital = (req, res, next) => {
  if (!req.user || req.user.role !== 'hospital') {
    return errorResponse(
      res,
      'Access restricted: Hospital institutional account required.',
      403,
      'FORBIDDEN_HOSPITAL_ONLY'
    );
  }

  const rawStatus = (req.hospital?.status || '').toUpperCase();

  if (rawStatus === 'REJECTED') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'REGISTRATION_REJECTED',
        status: 'REJECTED',
        message: req.hospital?.rejectionReason || 'Hospital registration was rejected.',
        hospital: req.hospital,
      },
      timestamp: new Date().toISOString(),
    });
  }

  if (rawStatus === 'SUSPENDED') {
    return errorResponse(res, 'Hospital account is suspended.', 403, 'HOSPITAL_SUSPENDED');
  }

  next();
};

/**
 * Prevents hospital tenants from accessing another hospital's resources
 */
const authorizeHospitalAccess = (paramKey = 'hospitalId') => (req, res, next) => {
  if (req.user.role === 'admin') return next();

  const targetId = req.params[paramKey] || req.body[paramKey] || req.query[paramKey];
  if (targetId && targetId !== req.user.hospitalId) {
    return errorResponse(
      res,
      'Cross-institution access denied. You may only manage your own hospital facility.',
      403,
      'UNAUTHORIZED_TENANT_ACCESS'
    );
  }
  next();
};

module.exports = {
  authenticateUser,
  requireAdmin,
  requireHospital,
  allowPendingHospital,
  authorizeHospitalAccess,
};
