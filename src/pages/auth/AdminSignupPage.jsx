import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ShieldAlert, User, Mail, Phone, Briefcase, Lock, ArrowRight, Loader2, Pill, ShieldCheck } from 'lucide-react';
import { signupAdminUser } from '../../store/slices/authSlice';
import toast from 'react-hot-toast';

export const AdminSignupPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: 'Verification & Compliance Authority',
    password: '',
    confirmPassword: '',
  });

  const { isLoading } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      const resultAction = await dispatch(signupAdminUser(formData));
      if (signupAdminUser.fulfilled.match(resultAction)) {
        toast.success('Supervisory Admin Account created! Please verify your official email.');
        navigate(`/verify-email?email=${encodeURIComponent(formData.email)}&role=admin`, { replace: true });
      } else {
        toast.error(resultAction.payload || 'Admin registration failed');
      }
    } catch (err) {
      toast.error(err.message || 'Unexpected error occurred');
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] py-8 px-4 sm:px-6 lg:px-8 flex justify-center items-center">
      <div className="max-w-md w-full space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-ocean-900 text-white flex items-center justify-center font-bold shadow-md">
              <ShieldAlert className="w-5 h-5 text-teal-400" />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              Med<span className="text-teal-600">Ex</span>
            </span>
          </Link>
          <h2 className="text-xl font-black text-slate-900">Regulatory Administrator Registration</h2>
          <p className="text-xs text-slate-500">Create supervisory credentials for platform logistics oversight</p>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-6 sm:p-8 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supervisory Officer Legal Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Officer Rajesh Verma"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ocean-900 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Government / Regulatory Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="officer@fda.gov.in"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ocean-900 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98110 00000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none font-semibold text-slate-700 truncate"
                >
                  <option value="Verification & Compliance Authority">Compliance Authority</option>
                  <option value="Logistics & Cold-Chain Oversight">Logistics Telemetry</option>
                  <option value="Inventory & Quality Assurance">Quality Assurance</option>
                  <option value="Escrow Settlement & Audit">Escrow Audit</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Create Supervisory Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ocean-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ocean-900 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-ocean-900 hover:bg-ocean-950 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-75"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authorizing Regulatory Account...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-teal-400" />
                  <span>Create Supervisory Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
            Already authorized administrator?{' '}
            <Link to="/login" className="font-bold text-teal-700 hover:underline">
              Sign In to Command Center
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminSignupPage;
