import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ShieldCheck, Check, RotateCcw, Save, Info, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'medex_storage_preferences';
const LEGACY_STORAGE_KEY = 'medistock_storage_preferences';

export const CookiePreferencesPage = () => {
  useEffect(() => {
    document.title = 'MedEx | Cookie Preferences';
  }, []);

  // Preferences state
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Fallback
    }
    return {
      necessary: true, // Always true
      functional: true,
      analytics: false,
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      setSavedSuccess(true);
      toast.success('Storage & cookie preferences saved');
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      toast.error('Failed to save preferences');
    }
  };

  const handleAcceptAll = () => {
    const updated = { necessary: true, functional: true, analytics: true };
    setPreferences(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedSuccess(true);
    toast.success('All preferences enabled');
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleRejectOptional = () => {
    const updated = { necessary: true, functional: false, analytics: false };
    setPreferences(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedSuccess(true);
    toast.success('Optional preferences disabled');
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleReset = () => {
    const defaultState = { necessary: true, functional: true, analytics: false };
    setPreferences(defaultState);
    localStorage.removeItem(STORAGE_KEY);
    toast.success('Preferences reset to platform defaults');
  };

  return (
    <div className="space-y-12 pb-20">
      
      {/* Header */}
      <section className="bg-gradient-to-b from-primary-900 via-secondary-900 to-slate-950 text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-secondary-800">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-cyan-300 text-xs font-bold uppercase tracking-wider">
            <Cookie className="w-3.5 h-3.5" />
            <span>Browser Privacy Settings</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Cookie & Storage Preferences
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto font-medium">
            Manage browser storage and session preferences for this device.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Transparent Technical Notice */}
        <div className="p-5 rounded-3xl bg-blue-50/80 border border-blue-200/90 shadow-sm flex items-start gap-4">
          <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 font-bold">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs">
            <h3 className="text-sm font-extrabold text-blue-950">
              Plain-Language Technical Disclosure
            </h3>
            <p className="text-blue-900 leading-relaxed">
              MedEx currently operates as a client-side web application and utilizes browser <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold">localStorage</code> for session persistence. We do not embed commercial advertising networks or third-party marketing trackers.
            </p>
          </div>
        </div>

        {/* Preference Center Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-6 sm:p-8 space-y-6">
          
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Data Storage Categories
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure which client-side storage permissions are granted.
              </p>
            </div>

            {savedSuccess && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </span>
            )}
          </div>

          <div className="space-y-6 divide-y divide-slate-100">
            
            {/* 1. Necessary */}
            <div className="pt-2 flex items-start justify-between gap-4">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900">Necessary Storage</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    Always Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Required for core application functionality, including hospital session tokens, active workspace routing, and security authentication state.
                </p>
              </div>

              <div className="flex items-center flex-shrink-0 pt-1">
                <div className="w-11 h-6 bg-emerald-500 rounded-full flex items-center justify-end px-1 cursor-not-allowed opacity-80" title="Always required for core app operation">
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </div>
              </div>
            </div>

            {/* 2. Functional */}
            <div className="pt-6 flex items-start justify-between gap-4">
              <div className="space-y-1 pr-4">
                <h3 className="text-sm font-extrabold text-slate-900">Functional Storage</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Used to remember interface preferences, such as active hospital switching during evaluation, filter parameters, and table display options.
                </p>
              </div>

              <div className="flex items-center flex-shrink-0 pt-1">
                <button
                  type="button"
                  onClick={() => setPreferences({ ...preferences, functional: !preferences.functional })}
                  className={`w-11 h-6 rounded-full flex items-center transition-colors px-1 ${
                    preferences.functional ? 'bg-primary-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>

            {/* 3. Analytics (Demo Simulation) */}
            <div className="pt-6 flex items-start justify-between gap-4">
              <div className="space-y-1 pr-4">
                <h3 className="text-sm font-extrabold text-slate-900">Analytics Simulation</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Used in demonstration mode to simulate anonymous aggregate usage telemetry and page transition diagnostics.
                </p>
              </div>

              <div className="flex items-center flex-shrink-0 pt-1">
                <button
                  type="button"
                  onClick={() => setPreferences({ ...preferences, analytics: !preferences.analytics })}
                  className={`w-11 h-6 rounded-full flex items-center transition-colors px-1 ${
                    preferences.analytics ? 'bg-primary-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            </div>

          </div>

          {/* Action Buttons Row */}
          <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-600/20 transition-all inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Preferences</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all"
              >
                Accept All
              </button>

              <button
                type="button"
                onClick={handleRejectOptional}
                className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all"
              >
                Reject Optional
              </button>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              title="Reset to default settings"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};

export default CookiePreferencesPage;
