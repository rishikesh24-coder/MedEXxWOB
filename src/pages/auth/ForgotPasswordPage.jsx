import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, Loader2, Pill, CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export const ForgotPasswordPage = () => {
  useEffect(() => {
    document.title = 'MedEx | Forgot Password';
  }, []);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailError, setEmailError] = useState('');
  const navigate = useNavigate();

  const validateEmail = (val) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(val).toLowerCase());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setEmailError('');

    if (!email.trim()) {
      setEmailError('Please enter your registered institutional email');
      return;
    }

    if (!validateEmail(email.trim())) {
      setEmailError('Please enter a valid email address format');
      return;
    }

    setIsLoading(true);

    // Simulate backend password reset request processing
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
      toast.success('Password reset instructions generated');
    }, 700);
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
            Account Recovery & Security Verification
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-6 sm:p-8 space-y-5">
          
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Forgot Password?
            </h1>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Enter your registered email address and we'll help you reset your password.
            </p>
          </div>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {emailError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium animate-fadeIn">
                  {emailError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Registered Institutional Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError('');
                    }}
                    placeholder="pharmacy@hospital.org"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Must match the verified official contact address on file.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-lg shadow-teal-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Institutional Record...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Request Processed</span>
                </div>
                <p className="text-emerald-900 leading-relaxed font-medium">
                  If an account with this email exists, password reset instructions would be sent.
                </p>
              </div>

              {/* Explicit Demo Notification */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 font-mono uppercase text-[10px]">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  Frontend Simulation Notice
                </span>
                <p className="leading-relaxed">
                  Because this is a frontend prototype without an external mail delivery service, no actual email is transmitted. You can test the password reset flow directly using the demo link below.
                </p>
              </div>

              <Link
                to={`/reset-password?email=${encodeURIComponent(email)}`}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>Proceed to Reset Password</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

            </div>
          )}

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

export default ForgotPasswordPage;
