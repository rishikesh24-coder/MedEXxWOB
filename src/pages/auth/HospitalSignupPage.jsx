import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useDropzone } from 'react-dropzone';
import {
  Building2,
  FileText,
  Lock,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Pill,
  Sparkles,
  X,
  Upload,
  Plus,
  Clock,
  Check
} from 'lucide-react';
import { signupHospitalUser } from '../../store/slices/authSlice';
import { getHospitalDocumentChecklist, MANDATORY_DOCUMENTS } from '../../services/storage';
import toast from 'react-hot-toast';

export const HospitalSignupPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading } = useSelector((state) => state.auth);

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedHospital, setSubmittedHospital] = useState(() => {
    try {
      const stored = sessionStorage.getItem('sms_last_registered_hospital');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [registrationSuccess, setRegistrationSuccess] = useState(() => {
    try {
      const stored = sessionStorage.getItem('sms_last_registered_hospital');
      return !!stored;
    } catch (e) {
      return false;
    }
  });

  const [formData, setFormData] = useState({
    // Step 1
    name: 'Max Healthcare Institute Ltd',
    registrationNo: 'MH-MUM-2023-9081',
    authorizedPerson: 'Dr. Sunil Kashyap (Chief Pharmacist)',
    email: 'max.pharmacy@medex.org',
    phone: '+91 98200 44556',
    // Step 2
    address: 'Sector 19, Palm Beach Galleria Road',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pincode: '400703',
    // Step 3 (Documents)
    documents: [
      { name: 'Hospital_Establishment_Reg.pdf', size: '3.4 MB', type: 'Registration Certificate', verified: false },
      { name: 'Pharmacy_Drug_License_Form20.pdf', size: '2.8 MB', type: 'Drug License Form 20B/21B', verified: false },
      { name: 'GSTIN_Registration_Doc.pdf', size: '1.5 MB', type: 'GSTIN Certificate', verified: false },
      { name: 'Board_Authorization_Letter.pdf', size: '1.1 MB', type: 'Board Resolution Letter', verified: false },
    ],
    // Step 4
    password: '',
    confirmPassword: '',
  });

  const docChecklist = getHospitalDocumentChecklist(formData.documents || []);

  const handleRemoveDoc = (docTypeOrName) => {
    setFormData((prev) => {
      const filtered = (prev.documents || []).filter((d) => {
        const typeMatch = (d.type || d.documentType || '').toLowerCase().includes(docTypeOrName.toLowerCase());
        const nameMatch = (d.name || d.documentName || '').toLowerCase().includes(docTypeOrName.toLowerCase());
        return !typeMatch && !nameMatch;
      });
      return {
        ...prev,
        documents: filtered,
      };
    });
    toast.success('Document removed from registration dossier');
  };

  const handleAttachMandatoryDoc = (reqDoc) => {
    const sampleFilename = `${reqDoc.type.replace(/\s+/g, '_')}_Official_Filing.pdf`;
    const newDoc = {
      name: sampleFilename,
      documentName: sampleFilename,
      size: '2.4 MB',
      type: reqDoc.type,
      documentType: reqDoc.type,
      verified: false,
    };
    setFormData((prev) => ({
      ...prev,
      documents: [...(prev.documents || []).filter((d) => {
        const t = (d.type || d.documentType || '').toLowerCase();
        return !t.includes(reqDoc.type.toLowerCase());
      }), newDoc],
    }));
    toast.success(`Uploaded ${reqDoc.label}`);
  };

  // Dropzone hook for uploading additional PDFs
  const onDrop = (acceptedFiles) => {
    const newDocs = acceptedFiles.map((file) => {
      const lower = file.name.toLowerCase();
      let matchedType = 'Supporting Document';
      if (lower.includes('reg') || lower.includes('establishment')) matchedType = 'Registration Certificate';
      else if (lower.includes('drug') || lower.includes('license') || lower.includes('form20') || lower.includes('form21')) matchedType = 'Drug License';
      else if (lower.includes('gst')) matchedType = 'GST Certificate';
      else if (lower.includes('authoriz') || lower.includes('board') || lower.includes('resolution')) matchedType = 'Authorization Letter';

      return {
        name: file.name,
        documentName: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        type: matchedType,
        documentType: matchedType,
        verified: false,
      };
    });
    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, ...newDocs],
    }));
    toast.success(`Attached ${acceptedFiles.length} file(s) for compliance review`);
  };

  const onDropRejected = (fileRejections) => {
    fileRejections.forEach((rejection) => {
      const { file, errors } = rejection;
      errors.forEach((err) => {
        if (err.code === 'file-too-large') {
          toast.error(`"${file.name}" exceeds the maximum allowed size of 5MB.`);
        } else if (err.code === 'file-invalid-type') {
          toast.error(`"${file.name}" is not a PDF. Only PDF files (.pdf) are permitted.`);
        } else {
          toast.error(`Upload error: ${err.message}`);
        }
      });
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 5 * 1024 * 1024, // 5MB max PDF size
  });

  const handleNext = (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!formData?.name?.trim() || !formData?.registrationNo?.trim() || !formData?.email?.trim() || !formData?.phone?.trim()) {
        toast.error('Please complete all hospital identity fields');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        toast.error('Please enter a valid official email address');
        return;
      }
    } else if (step === 2) {
      if (!formData?.address?.trim() || !formData?.city?.trim() || !formData?.state?.trim() || !formData?.pincode?.trim()) {
        toast.error('Please complete all physical campus location details');
        return;
      }
    } else if (step === 3) {
      const checklist = getHospitalDocumentChecklist(formData?.documents || []);
      if (!checklist.isComplete) {
        const missingLabels = (checklist.missingItems || []).map((m) => m.label).join(', ');
        toast.error(`Please upload all required documents before proceeding. Missing: ${missingLabels}`);
        return;
      }
    }
    setStep(step + 1);
  };

  const handlePrevious = () => {
    setStep(Math.max(1, step - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || isLoading || registrationSuccess) return;

    // Validation: All required documents are strictly compulsory
    const checklist = getHospitalDocumentChecklist(formData?.documents || []);
    if (!checklist.isComplete) {
      const missingLabels = (checklist.missingItems || []).map((m) => m.label).join(', ');
      toast.error(`Cannot submit application: Please upload all required documents (${missingLabels})`);
      setStep(3);
      return;
    }

    if (!formData?.password || formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const resultAction = await dispatch(signupHospitalUser(formData));
      if (signupHospitalUser.fulfilled.match(resultAction)) {
        const hospitalPayload = resultAction.payload?.hospital || {
          name: formData.name,
          registrationNo: formData.registrationNo || 'HOSP-2026-PENDING',
          authorizedPerson: formData.authorizedPerson,
          email: formData.email,
          city: formData.city,
          state: formData.state,
          status: 'pending',
        };
        setSubmittedHospital(hospitalPayload);
        setRegistrationSuccess(true);
        try {
          sessionStorage.setItem('sms_last_registered_hospital', JSON.stringify(hospitalPayload));
        } catch (e) {}
        toast.success('Registration submitted for admin approval');
        // CRITICAL: DO NOT redirect to hospital dashboard!
        // Hospital enters PENDING ADMIN APPROVAL state and sees the dedicated confirmation screen.
      } else {
        const errPayload = resultAction.payload;
        const msg = typeof errPayload === 'string'
          ? errPayload
          : 'Registration could not be completed. Please review the highlighted information and try again.';
        toast.error(msg);
      }
    } catch (err) {
      console.error('[Hospital Registration Error]:', err);
      toast.error('Registration could not be completed. Please review the highlighted information and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToLogin = () => {
    try {
      sessionStorage.removeItem('sms_last_registered_hospital');
    } catch (e) {}
    setRegistrationSuccess(false);
    setSubmittedHospital(null);
    navigate('/login', {
      state: {
        email: submittedHospital?.email,
        fromRegistration: true,
      },
    });
  };

  // Dedicated Pending Approval Success Screen
  if (registrationSuccess && submittedHospital) {
    return (
      <div className="min-h-[calc(100vh-4rem)] py-3 px-4 sm:px-6 flex items-center justify-center">
        <div className="max-w-xl w-full max-h-[calc(100vh-32px)] flex flex-col bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden animate-fadeIn">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-teal-900 via-ocean-900 to-slate-900 px-5 py-4 sm:px-6 sm:py-4 text-white text-center relative shrink-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto mb-2 shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 stroke-[2.5]" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
              Hospital Registered Successfully
            </h1>
            <p className="text-xs text-slate-300 max-w-md mx-auto mt-0.5 font-medium">
              Your hospital registration has been submitted successfully.
            </p>
          </div>

          <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1">
            {/* Prominent Admin Approval Required Notice */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 space-y-1 shadow-sm">
              <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-[10px] uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Admin Approval Required</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-amber-950 leading-snug">
                Kindly wait for admin approval before accessing the hospital portal.
              </div>
              <p className="text-[11px] text-amber-900/90 leading-normal">
                Our administrators will review your hospital details and approve your account before you can access the hospital portal. Please wait for approval.
              </p>
            </div>

            {/* Registration Summary Details */}
            <div className="bg-slate-50 rounded-xl border border-slate-200/80 p-3 sm:p-3.5 space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Hospital</div>
                  <div className="text-slate-900 font-extrabold text-xs truncate mt-0.5">{submittedHospital.name}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Registration ID</div>
                  <div className="text-teal-700 font-mono font-bold text-xs truncate mt-0.5">{submittedHospital.registrationNo || submittedHospital.id}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Official Email</div>
                  <div className="text-slate-800 font-medium text-[11px] truncate mt-0.5">{submittedHospital.email}</div>
                </div>
                <div>
                  <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Campus Location</div>
                  <div className="text-slate-800 font-medium text-[11px] truncate mt-0.5">{submittedHospital.city}, {submittedHospital.state}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Status:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-950 border border-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  PENDING ADMIN APPROVAL
                </span>
              </div>
            </div>

            {/* Status Timeline */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-600">Verification Lifecycle</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-[11px] truncate">1. Registration</div>
                    <div className="text-[10px] text-emerald-700 font-medium truncate">Submitted</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/80 border border-amber-300">
                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-[11px] truncate">2. Verification</div>
                    <div className="text-[10px] text-amber-800 font-bold truncate">Pending Review</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-500 text-[11px] truncate">3. Portal Access</div>
                    <div className="text-[10px] text-slate-400 font-medium truncate">After Approval</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Explanatory Message */}
            <p className="text-[11px] text-slate-500 text-center leading-normal">
              Your hospital details are now waiting for administrator verification. You will be able to access the hospital portal after your registration is approved.
            </p>

            {/* Action */}
            <div className="pt-1 shrink-0">
              <button
                type="button"
                onClick={handleReturnToLogin}
                className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Login</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] py-8 px-4 sm:px-6 lg:px-8 flex justify-center">
      <div className="max-w-2xl w-full space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-1.5">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-teal-600/20">
              <Pill className="w-5 h-5 rotate-45" />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              Med<span className="text-teal-600">Ex</span>
            </span>
          </Link>
          <h2 className="text-xl font-black text-slate-900">Hospital Institutional Onboarding</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            4-step statutory compliance registration for inter-hospital medicine exchange & cold-chain access.
          </p>
        </div>

        {/* 4-Step Progress Indicator */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="grid grid-cols-4 text-center text-xs font-bold gap-2">
            <div className={`flex items-center justify-center gap-1.5 pb-2 border-b-2 transition-all ${
              step >= 1 ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step >= 1 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>1</span>
              <span className="hidden sm:inline">Identity</span>
            </div>

            <div className={`flex items-center justify-center gap-1.5 pb-2 border-b-2 transition-all ${
              step >= 2 ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step >= 2 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>2</span>
              <span className="hidden sm:inline">Campus</span>
            </div>

            <div className={`flex items-center justify-center gap-1.5 pb-2 border-b-2 transition-all ${
              step >= 3 ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step >= 3 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>3</span>
              <span className="hidden sm:inline">Statutory Audit</span>
            </div>

            <div className={`flex items-center justify-center gap-1.5 pb-2 border-b-2 transition-all ${
              step >= 4 ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step >= 4 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'
              }`}>4</span>
              <span className="hidden sm:inline">Security</span>
            </div>
          </div>
        </div>

        {/* Card Form */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-6 sm:p-8">
          
          {/* STEP 1: Hospital Identity */}
          {step === 1 && (
            <form onSubmit={handleNext} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Step 1: Hospital & Authority Registration</h3>
                    <p className="text-[10px] text-slate-400">Institutional entity verification</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400">1 of 4</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Registered Hospital / Healthcare Institution <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apollo Hospital, Max Super Speciality"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    State Health Authority Reg No. <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MH-MUM-2023-8812"
                    value={formData.registrationNo}
                    onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chief Pharmacist / Medical Director <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Dr. Full Name & Designation"
                    value={formData.authorizedPerson}
                    onChange={(e) => setFormData({ ...formData, authorizedPerson: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Official Work Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="pharmacy@hospital.org"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone (+91) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98200 12345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition-all"
                >
                  <span>Next: Campus Location</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Address & Location */}
          {step === 2 && (
            <form onSubmit={handleNext} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Step 2: Hospital Physical Campus & Intake Gate</h3>
                    <p className="text-[10px] text-slate-400">Used for courier cold-box dispatched pickups</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400">2 of 4</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pharmacy Gate / Campus Street Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="2"
                  required
                  placeholder="Plot number, Sector, Central Pharmacy Intake Gate"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pincode <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    maxLength="6"
                    required
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition-all"
                >
                  <span>Next: Upload Documents</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Document Uploads */}
          {step === 3 && (
            <form onSubmit={handleNext} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Step 3: Statutory CDSCO & Drug Controller Audit</h3>
                    <p className="text-[10px] text-slate-400">All 4 statutory compliance documents are compulsory for application submission</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400">3 of 4</span>
              </div>

              {/* Validation Status Notification Banner */}
              {!docChecklist.isComplete ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Mandatory Documents Incomplete ({docChecklist.submittedCount} of {docChecklist.totalRequired} Attached)</span>
                  </div>
                  <p className="text-[11px] text-rose-700 leading-relaxed">
                    Please upload all required documents before submitting your application.
                  </p>
                  <div className="text-[11px] font-semibold text-rose-800 pt-0.5">
                    Missing required document(s): {docChecklist.missingItems.map((m) => m.label).join(', ')}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All Required Documents Uploaded ({docChecklist.submittedCount} of {docChecklist.totalRequired})</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Your statutory compliance dossier is complete and ready for institutional verification.
                  </p>
                </div>
              )}

              {/* Drag & Drop Zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  isDragActive ? 'border-teal-500 bg-teal-50/60' : 'border-slate-300 hover:border-teal-400 bg-slate-50/50'
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="w-8 h-8 text-teal-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  Drag & drop compliance PDFs, or <span className="text-teal-700 underline">browse workstation</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Accepts PDF files up to 5MB per statutory document</p>
              </div>

              {/* Compulsory Statutory Document Checklist */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">Compulsory Statutory Documents ({docChecklist.submittedCount} / {docChecklist.totalRequired}):</p>
                  <span className="text-[10px] font-mono text-slate-400">All 4 Required</span>
                </div>

                <div className="space-y-2">
                  {docChecklist.checklist.map((item) => (
                    <div
                      key={item.documentType}
                      className={`p-3 rounded-2xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.isSubmitted ? 'bg-slate-50 border-slate-200/90' : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          item.isSubmitted ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-rose-100 text-rose-600'
                        }`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">{item.label}</span>
                            <span className="text-[10px] font-bold text-rose-600 font-mono shrink-0">*Compulsory</span>
                          </div>
                          {item.isSubmitted ? (
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              <span className="font-mono text-slate-700 font-semibold">{item.documentName}</span> • {item.size}
                            </div>
                          ) : (
                            <div className="text-[11px] text-rose-600 font-medium mt-0.5">
                              Document missing — Please upload before submitting application
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        {item.isSubmitted ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Submitted
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDoc(item.documentType)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Remove document to test missing status or re-upload"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-3 h-3" />
                              Missing
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAttachMandatoryDoc(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold shadow-sm transition-all"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Upload</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Additional Documents if any */}
                  {docChecklist.additionalDocs.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Additional Supporting Filings:</p>
                      {docChecklist.additionalDocs.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCheck className="w-4 h-4 text-teal-600 shrink-0" />
                            <div className="truncate">
                              <span className="font-bold text-slate-800">{doc.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-2">{doc.size}</span>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Submitted
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition-all"
                >
                  <span>Next: Security Credentials</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Password & Confirmation */}
          {step === 4 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Step 4: Final Security Check & Master Password</h3>
                    <p className="text-[10px] text-slate-400">Institutional verification layer & portal credentials</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400">4 of 4</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Master Portal Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={formData?.password || ''}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm Master Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={formData?.confirmPassword || ''}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all font-mono"
                />
              </div>

              {/* FINAL SECURITY CHECK VERIFICATION CARD */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Final Security Check</h4>
                      <p className="text-[10px] text-slate-500">Prototype credential & statutory validation layer</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    Validated
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* 1. Registration information complete */}
                  <div className="flex items-start gap-2 text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800">Registration information complete</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Passed</span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate mt-0.5">
                        {formData?.name || 'Not provided'}
                      </p>
                    </div>
                  </div>

                  {/* 2. Required fields validated */}
                  <div className="flex items-start gap-2 text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800">Required fields validated</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Passed</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 space-y-0.5">
                        <div className="truncate">
                          <span className="text-slate-400">Reg No:</span>{' '}
                          <span className="font-mono text-slate-700 font-semibold">{formData?.registrationNo || formData?.registrationNumber || 'Not provided'}</span>
                        </div>
                        <div className="truncate">
                          <span className="text-slate-400">Location:</span>{' '}
                          <span>{formData?.address || 'Not provided'}, {formData?.city || 'Not provided'}, {formData?.state || 'Not provided'} ({formData?.pincode || 'Not provided'})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Hospital role confirmed */}
                  <div className="flex items-start gap-2 text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800">Hospital role confirmed</span>
                        <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">HOSPITAL</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Authorized for hospital medicine sharing, inventory management, and cold-chain transfers.
                      </p>
                    </div>
                  </div>

                  {/* 4. Account information ready */}
                  <div className="flex items-start gap-2 text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800">Account information ready</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Ready</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span><span className="text-slate-400">Contact:</span> {formData?.authorizedPerson || formData?.contactPerson || 'Not provided'}</span>
                        <span>•</span>
                        <span className="font-mono">{formData?.email || 'Not provided'}</span>
                        <span>•</span>
                        <span className="font-mono">{formData?.phone || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Ready to create hospital account */}
                  <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-xs">Ready to create hospital account</span>
                  </div>
                </div>
              </div>

              {/* Supporting Documents Recap */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <FileCheck className="w-4 h-4 text-teal-600" />
                    <span>Supporting Regulatory Dossier</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {docChecklist?.submittedCount || 0} of {docChecklist?.totalRequired || 4} Submitted
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  {(docChecklist?.checklist || []).map((item) => (
                    <div key={item.documentType} className="p-2 rounded-xl bg-white border border-slate-200/70 flex items-center justify-between">
                      <span className="font-medium text-slate-700 truncate mr-2">{item.label}</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                        Submitted
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <ShieldCheck className="w-4 h-4 text-teal-600" />
                  <span>Statutory Compliance Declaration</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  By registering, the hospital affirms all pharmaceutical listings adhere to CDSCO storage guidelines (Drugs & Cosmetics Act 1940) and Schedule H/H1 safety protocols.
                </p>
              </div>

              <div className="pt-4 flex justify-between items-center">
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isLoading || !docChecklist?.isComplete || registrationSuccess}
                  className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-lg shadow-teal-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registrationSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>Registration Submitted</span>
                    </>
                  ) : (isSubmitting || isLoading) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Registration...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Submit Registration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        <div className="text-center text-xs text-slate-500">
          Already registered institution?{' '}
          <Link to="/login" className="font-bold text-teal-700 hover:underline">
            Sign In to Portal
          </Link>
        </div>

      </div>
    </div>
  );
};

export default HospitalSignupPage;
