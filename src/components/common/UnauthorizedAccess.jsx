import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard, Lock } from 'lucide-react';

export const UnauthorizedAccess = ({ currentRole, requiredRole }) => {
  const navigate = useNavigate();
  const fallbackDashboard = currentRole === 'admin' ? '/admin/dashboard' : '/hospital/dashboard';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-3xl bg-white border border-slate-200 shadow-xl p-6 sm:p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-100 text-rose-800">
            <Lock className="w-3.5 h-3.5" />
            <span>ACCESS RESTRICTED</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Role Permission Required
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your current account role (<strong className="text-slate-800 uppercase font-mono">{currentRole || 'Guest'}</strong>) is not authorized to access this section, which is restricted to <strong className="text-slate-800 uppercase font-mono">{requiredRole}</strong> users.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500 text-left space-y-1">
          <p className="font-semibold text-slate-700">Security Guidance:</p>
          <p>Institutional boundaries ensure healthcare providers only manage clinical lot allocations, while supervisory authorities handle accreditation audits.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
          <Link
            to={fallbackDashboard}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Return to My Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedAccess;
