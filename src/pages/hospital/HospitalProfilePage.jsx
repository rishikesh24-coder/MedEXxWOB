import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit3,
  FileText,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  ShieldAlert,
  Bell,
  Lock,
  Settings,
  Key,
  X,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { logoutUser, setUserSession } from '../../store/slices/authSlice';
import { getStoredItem, setStoredItem, KEYS } from '../../services/storage';
import StatusBadge from '../../components/common/StatusBadge';

const profileFields = [
  ['name', 'Hospital Name'],
  ['registrationNo', 'Registration Number / NABH'],
  ['authorizedPerson', 'Nodal Officer / Contact Person'],
  ['email', 'Official Institutional Email'],
  ['phone', 'Direct Helpline / Phone'],
  ['address', 'Physical Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['pincode', 'Postal Code / Pincode'],
];

export const HospitalProfilePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, token } = useSelector((state) => state.auth);
  const storedHospital = getStoredItem(KEYS.HOSPITALS, []).find((hospital) => hospital.id === user?.id);
  const hospital = { ...user, ...storedHospital };
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(() =>
    Object.fromEntries(profileFields.map(([field]) => [field, hospital[field] || '']))
  );

  // Verification state: VERIFIED | PENDING VERIFICATION | REQUIRES ATTENTION
  const [verificationStatus, setVerificationStatus] = useState(
    hospital.verificationStatus || (hospital.verified ? 'VERIFIED' : 'VERIFIED')
  );

  // Demo Account Settings State
  const [demoSettings, setDemoSettings] = useState({
    emailAlerts: true,
    smsTransferAlerts: true,
    autoEarmarkStock: true,
    twoFactorAuth: false,
    sessionTimeout: '30m'
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    const updatedUser = { ...user, ...formData, verificationStatus };
    dispatch(setUserSession({ user: updatedUser, token: token || 'mock-jwt-token' }));

    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    setStoredItem(KEYS.HOSPITALS, hospitals.map((item) => (
      item.id === user?.id ? { ...item, ...formData, verificationStatus } : item
    )));
    setIsEditing(false);
    toast.success('Hospital institutional profile updated');
  };

  const handleLogout = async () => {
    await dispatch(logoutUser());
    toast.success('Logged out successfully');
    navigate('/');
  };

  const documents = hospital.documents || [
    { type: 'NABH Accreditation Certificate', name: 'nabh_accreditation_2024.pdf', size: '2.4 MB', verified: true },
    { type: 'Drug Controller State License (Form 20B/21B)', name: 'drug_license_valid_2027.pdf', size: '1.8 MB', verified: true },
    { type: 'Clinical Establishment Act Certificate', name: 'cea_registration_mh.pdf', size: '3.1 MB', verified: true },
  ];

  const getVerificationBadge = () => {
    switch (verificationStatus) {
      case 'PENDING VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            PENDING VERIFICATION
          </span>
        );
      case 'REQUIRES ATTENTION':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            REQUIRES ATTENTION
          </span>
        );
      case 'VERIFIED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            VERIFIED INSTITUTION
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Workspace
        </button>
        <span className="text-[11px] font-mono text-slate-400">
          Hospital Node ID: <strong className="text-slate-700">{hospital.id || 'HOSP-7021'}</strong>
        </span>
      </div>

      {/* Main Profile Card */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary-600/10 border border-primary-500/20 text-primary-600 flex items-center justify-center flex-shrink-0 shadow-inner">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {hospital.name || 'Metropolitan Multi-Specialty Hospital'}
                </h1>
                {getVerificationBadge()}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {hospital.city ? `${hospital.city}, ${hospital.state || 'India'}` : 'Mumbai, Maharashtra'}
                </span>
                <span>•</span>
                <span className="font-mono font-medium">Role: Hospital Administrator</span>
                <span>•</span>
                <span className="font-mono text-slate-400">Reg: {hospital.registrationNo || 'MH-MC-2021-9981'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing((current) => !current)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>
        </div>

        {/* Identity & Fields */}
        {isEditing ? (
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {profileFields.map(([field, label]) => (
                <label key={field} className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{label}</span>
                  <input
                    name={field}
                    value={formData[field]}
                    onChange={handleChange}
                    required={field === 'name' || field === 'email'}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                </label>
              ))}

              {/* Verification Status Selector (Demo Configuration) */}
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">Verification State (Mock)</span>
                <select
                  value={verificationStatus}
                  onChange={(e) => setVerificationStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-100"
                >
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="PENDING VERIFICATION">PENDING VERIFICATION</option>
                  <option value="REQUIRES ATTENTION">REQUIRES ATTENTION</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary-600 text-xs font-bold text-white hover:bg-primary-700 shadow-md shadow-primary-600/20"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {profileFields.map(([field, label]) => (
                <div key={field} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">{label}</p>
                  <p className="mt-1 text-xs font-extrabold text-slate-900 break-words">
                    {hospital[field] || <span className="text-slate-400 font-normal italic">Not specified</span>}
                  </p>
                </div>
              ))}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Verification Status</p>
                <div className="mt-1">
                  {getVerificationBadge()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Uploaded Institutional Documents */}
        <div className="border-t border-slate-100 px-6 py-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-600" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 font-mono">
                Statutory Regulatory Documents
              </h2>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Statutory Supporting Filings
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {documents.map((doc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-200/60 text-slate-600 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{doc.type || doc.documentType}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{doc.name || doc.documentName} • {doc.size || 'PDF'}</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  Submitted
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Demo Account Settings (Explicitly Marked Frontend-Only) */}
        <div className="border-t border-slate-100 px-6 py-6 bg-slate-50/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 font-mono">
                Workspace Preferences (Frontend Prototype Demo)
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200/60 text-slate-600">
              Mock Local State Only
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Email Alerts for Incoming Requests</span>
                <input
                  type="checkbox"
                  checked={demoSettings.emailAlerts}
                  onChange={(e) => setDemoSettings({ ...demoSettings, emailAlerts: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Receive instant notifications when other hospitals request stock.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Automatic Stock Reservation</span>
                <input
                  type="checkbox"
                  checked={demoSettings.autoEarmarkStock}
                  onChange={(e) => setDemoSettings({ ...demoSettings, autoEarmarkStock: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Prevent double-allocation once an incoming request is approved.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Simulated 2FA Authentication</span>
                <input
                  type="checkbox"
                  checked={demoSettings.twoFactorAuth}
                  onChange={(e) => {
                    setDemoSettings({ ...demoSettings, twoFactorAuth: e.target.checked });
                    toast.success(`2FA preference toggled (${e.target.checked ? 'Enabled' : 'Disabled'}) [Demo]`);
                  }}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Require OTP challenge for high-value orders and inventory transfers.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Healthcare institutional profile is stored locally in demo session.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-700 transition-colors shadow-sm shadow-rose-600/20"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HospitalProfilePage;
