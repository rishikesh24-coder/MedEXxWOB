import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Mail, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  ArrowRight, 
  ArrowLeft, 
  Pill, 
  ShieldCheck, 
  Sparkles, 
  Building2,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export const EmailVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'MedEx | Verify Email';
  }, []);

  const emailParam = searchParams.get('email') || 'pharmacy@hospital.org';
  const roleParam = searchParams.get('role') || 'hospital';

  // Demo verification state: 'pending' | 'verified' | 'expired' | 'failed'
  const [status, setStatus] = useState('pending');
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSimulateVerification = () => {
    setStatus('verified');
    toast.success('Simulated email verification completed!');
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    setIsResending(true);
    setTimeout(() => {
      setIsResending(false);
      setResendCooldown(30);
      setStatus('pending');
      toast.success(`Demo verification link refreshed for ${emailParam}`);
    }, 600);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-md shadow-teal-600/20">
              <Pill className="w-5 h-5 rotate-45" />
            </div>
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              Med<span className="text-teal-600">Ex</span>
            </span>
          </Link>
          <p className="text-xs text-slate-500 font-medium">
            Contact Verification & Security Onboarding
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-6 sm:p-8 space-y-6">
          
          {/* Status 1: PENDING */}
          {status === 'pending' && (
            <div className="space-y-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center mx-auto shadow-sm">
                <Mail className="w-7 h-7 animate-bounce" />
              </div>

              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Verify your email
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Check your inbox for a verification link sent to:
                </p>
                <div className="mt-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 font-mono break-all">
                  {emailParam}
                </div>
              </div>

              {/* Demo Notice */}
              <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 text-[11px] text-left space-y-1">
                <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] uppercase text-blue-800">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Demo Mode Verification</span>
                </div>
                <p className="leading-relaxed">
                  In this prototype demonstration, external SMTP servers are simulated. Click the button below to immediately verify your email and continue.
                </p>
              </div>

              {/* Primary Action */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleSimulateVerification}
                  className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I've Verified My Email</span>
                </button>

                <button
                  type="button"
                  disabled={isResending || resendCooldown > 0}
                  onClick={handleResend}
                  className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0 
                      ? `Resend Link (${resendCooldown}s)` 
                      : 'Resend Verification Email'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Status 2: VERIFIED */}
          {status === 'verified' && (
            <div className="space-y-5 text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Email verified successfully!
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Your institutional address <strong className="text-slate-800 font-mono">{emailParam}</strong> is verified.
                </p>
              </div>

              {/* Hospital vs Email Verification Distinction (Requirement 10) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <Building2 className="w-4 h-4 text-teal-600" />
                  <span>Next Step: Statutory Hospital Verification</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Email verification confirms your contact channel. For hospital accounts, statutory regulatory audit (CDSCO licenses & Form 20B) is processed by supervisory administrators before full exchange authorization.
                </p>
              </div>

              <Link
                to="/login"
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Proceed to Login</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Status 3: EXPIRED */}
          {status === 'expired' && (
            <div className="space-y-5 text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
                <Clock className="w-7 h-7" />
              </div>

              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Verification link expired
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Security links expire after 24 hours. Request a new verification token to proceed.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResend}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Request New Link</span>
              </button>
            </div>
          )}

          {/* Status 4: FAILED */}
          {status === 'failed' && (
            <div className="space-y-5 text-center animate-fadeIn">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Verification failed
                </h1>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  The verification token was invalid or malformed.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStatus('pending')}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Interactive State Switcher for Reviewers */}
          <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase">
              <span>Test Simulated States</span>
              <span>Active: {status}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setStatus('pending')}
                className={`py-1 rounded border transition-all ${
                  status === 'pending' ? 'bg-white border-teal-500 text-teal-800 shadow-xs' : 'text-slate-600 hover:bg-white'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setStatus('verified')}
                className={`py-1 rounded border transition-all ${
                  status === 'verified' ? 'bg-white border-emerald-500 text-emerald-800 shadow-xs' : 'text-slate-600 hover:bg-white'
                }`}
              >
                Verified
              </button>
              <button
                type="button"
                onClick={() => setStatus('expired')}
                className={`py-1 rounded border transition-all ${
                  status === 'expired' ? 'bg-white border-amber-500 text-amber-800 shadow-xs' : 'text-slate-600 hover:bg-white'
                }`}
              >
                Expired
              </button>
              <button
                type="button"
                onClick={() => setStatus('failed')}
                className={`py-1 rounded border transition-all ${
                  status === 'failed' ? 'bg-white border-rose-500 text-rose-800 shadow-xs' : 'text-slate-600 hover:bg-white'
                }`}
              >
                Failed
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
};

export default EmailVerificationPage;
