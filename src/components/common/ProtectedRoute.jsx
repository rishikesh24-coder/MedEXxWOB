import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { hasRequiredRole, isValidRole } from '../../utils/rbac';
import { logoutUser } from '../../store/slices/authSlice';
import { getLiveHospitalRecord } from '../../services/storage';
import ErrorBoundary from './ErrorBoundary';
import { ShieldAlert, Clock, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Route-Level Authorization & Protection Sentinel
 * MedEx Platform
 * 
 * Enforces strict Role-Based Access Control (RBAC):
 * - Blocks unauthenticated guests, redirecting to /login with target state
 * - Detects and purges corrupted or invalid sessions
 * - Blocks cross-role access (e.g. Hospital user attempting direct /admin navigation)
 * - Blocks unapproved/pending hospitals from accessing operational hospital dashboard
 * - Wraps protected view tree in ErrorBoundary for fault isolation
 */
export const ProtectedRoute = ({ children, allowedRole }) => {
  const { isAuthenticated, user, role, token } = useSelector((state) => state.auth);
  const location = useLocation();
  const dispatch = useDispatch();
  const deniedNoticeShown = useRef(false);

  // 1. Session integrity check: Token, user, and role must all exist and be valid
  const isSessionCorrupted = isAuthenticated && (!user || !role || !isValidRole(role) || !token);

  useEffect(() => {
    if (isSessionCorrupted) {
      dispatch(logoutUser());
      toast.error('Session expired or invalid. Please sign in again.');
    }
  }, [isSessionCorrupted, dispatch]);

  if (isSessionCorrupted || !isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Role-Based Access Control check
  if (allowedRole && !hasRequiredRole(user, allowedRole)) {
    if (!deniedNoticeShown.current) {
      deniedNoticeShown.current = true;
      const targetArea = allowedRole === 'admin' ? 'Supervisory Administration' : 'Hospital Operations';
      toast.error(`Access Denied: Your account (${role.toUpperCase()}) cannot access the ${targetArea} portal.`);
    }

    if (role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else {
      return <Navigate to="/hospital/dashboard" replace />;
    }
  }

  // 3. Operational Approval Check: Block pending or rejected hospital from dashboard / operations
  if (role === 'hospital' || allowedRole === 'hospital') {
    const liveHospital = getLiveHospitalRecord(user.id || user.hospitalId || user.email);
    const effectiveStatus = (liveHospital?.status || user.status || '').toLowerCase();

    if (effectiveStatus === 'pending' || effectiveStatus === 'pending_approval' || effectiveStatus === 'under_review') {
      return (
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
          <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-3xl border border-amber-300 shadow-xl space-y-6 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
              <ShieldAlert className="w-9 h-9 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-950 border border-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                PENDING ADMIN APPROVAL
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Admin Approval Required
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Your hospital registration has been submitted and is currently awaiting administrator verification.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-left text-xs text-amber-950 space-y-2">
              <div className="flex justify-between items-center py-0.5 border-b border-amber-200/80">
                <span className="text-amber-800 font-bold uppercase tracking-wider text-[10px]">Hospital:</span>
                <span className="font-extrabold text-slate-900">{liveHospital?.name || user.name || 'Healthcare Institution'}</span>
              </div>
              {(liveHospital?.registrationNo || user.registrationNo) && (
                <div className="flex justify-between items-center py-0.5 border-b border-amber-200/80">
                  <span className="text-amber-800 font-bold uppercase tracking-wider text-[10px]">Registration ID:</span>
                  <span className="font-mono font-bold text-teal-800">{liveHospital?.registrationNo || user.registrationNo}</span>
                </div>
              )}
              <div className="pt-1 text-[11px] text-amber-900 leading-relaxed font-medium">
                Access to the hospital portal, inventory management, and medicine marketplace will become operational once statutory documents are audited and approved by central administration.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                dispatch(logoutUser());
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Login</span>
            </button>
          </div>
        </div>
      );
    }

    if (effectiveStatus === 'rejected') {
      const rejectionReason = liveHospital?.rejectionReason || user.rejectionReason || 'Statutory documentation incomplete or compliance requirements not met.';
      return (
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-slate-50">
          <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-3xl border border-rose-300 shadow-xl space-y-6 text-center animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-sm">
              <ShieldAlert className="w-9 h-9 stroke-[2.2]" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-950 border border-rose-300">
                REGISTRATION REJECTED
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Application Requires Attention
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                Your hospital registration was reviewed and could not be approved by platform administration.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 text-left text-xs text-rose-950 space-y-2">
              <div className="text-rose-900 font-bold text-[10px] uppercase tracking-wider">Reason for Rejection:</div>
              <div className="text-xs text-rose-950 font-medium leading-relaxed bg-white/70 p-2.5 rounded-xl border border-rose-200/80">
                {rejectionReason}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                dispatch(logoutUser());
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Login</span>
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

export default ProtectedRoute;
