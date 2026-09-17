import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Pill, Home, LayoutDashboard, ArrowLeft, ShieldAlert, Building2 } from 'lucide-react';

export const NotFoundPage = () => {
  const { isAuthenticated, role } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'MedEx | Page Not Found';
  }, []);

  // Intelligently route dashboard based on current role
  const getDashboardPath = () => {
    if (!isAuthenticated) return '/login';
    if (role === 'admin') return '/admin/dashboard';
    return '/hospital/dashboard';
  };

  const getDashboardLabel = () => {
    if (!isAuthenticated) return 'Sign In to Portal';
    if (role === 'admin') return 'Admin Dashboard';
    return 'Hospital Dashboard';
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-lg w-full text-center space-y-6">
        
        {/* MedEx Visual Identity */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-900 flex items-center justify-center text-white shadow-xl shadow-primary-600/20">
              <Pill className="w-8 h-8 rotate-45 text-cyan-300" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 ring-4 ring-white animate-pulse" />
          </div>
        </div>

        {/* 404 Visual Code */}
        <div className="space-y-2">
          <div className="text-7xl sm:text-8xl font-black font-mono tracking-tight text-slate-900">
            4<span className="text-primary-600">0</span>4
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Page not found
          </h1>
          <p className="text-sm text-slate-500 max-w-sm mx-auto font-medium">
            The page you're looking for doesn't exist, may have been moved, or the link may be outdated.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs shadow-sm transition-all"
          >
            <Home className="w-4 h-4 text-slate-500" />
            <span>Go to Home</span>
          </Link>

          <Link
            to={getDashboardPath()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-lg shadow-primary-600/20 transition-all"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{getDashboardLabel()}</span>
          </Link>
        </div>

        {/* Quick Back Action */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go back to previous page</span>
          </button>
        </div>

        {/* Context Information */}
        <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 text-[11px] text-slate-500 max-w-sm mx-auto font-mono">
          <span>MedEx Route Sentinel: URL not recognized by router.</span>
        </div>

      </div>
    </div>
  );
};

export default NotFoundPage;
