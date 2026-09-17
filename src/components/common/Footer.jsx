import React from 'react';
import { Link } from 'react-router-dom';
import { Pill, ShieldCheck, Mail, Phone, MapPin, Heart, ExternalLink, Sparkles, MessageSquare } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-secondary-850 text-slate-300 border-t border-secondary-700/80 bg-[#0C1B26]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10">
          
          {/* Brand Col: MedEx */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-md shadow-primary-600/20 group-hover:scale-105 transition-transform">
                <Pill className="w-5 h-5 rotate-45 text-cyan-300" />
              </div>
              <span className="text-xl font-extrabold text-white tracking-tight">
                Med<span className="text-primary-400">Ex</span>
              </span>
            </Link>
            
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed font-normal">
              Smart medicine redistribution between verified hospitals. Eliminating pharmaceutical wastage, ensuring cold-chain telemetry visibility, and connecting regional healthcare facilities.
            </p>

            <div className="flex items-center gap-2 text-[11px] text-cyan-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800 w-fit">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Institutional B2B Healthcare Exchange Interface</span>
            </div>
          </div>

          {/* PRODUCT */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <Link to="/how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/hospital/marketplace" className="hover:text-white transition-colors">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link to="/hospital-signup" className="hover:text-white transition-colors">
                  Hospital Registration
                </Link>
              </li>
              <li>
                <Link to="/hospital/track" className="hover:text-white transition-colors">
                  Live Logistics Tracking
                </Link>
              </li>
            </ul>
          </div>

          {/* COMPANY & LEGAL */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white mb-4">
              Company & Legal
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-400">
              <li>
                <Link to="/about" className="hover:text-white transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link to="/cookie-preferences" className="hover:text-white transition-colors">
                  Cookie Preferences
                </Link>
              </li>
            </ul>
          </div>

          {/* SUPPORT */}
          <div>
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white mb-4">
              Support
            </h4>
            <ul className="space-y-3 text-xs text-slate-400">
              <li>
                <Link 
                  to="/hospital/feedback" 
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-primary-400" />
                  <span>Platform Feedback</span>
                </Link>
              </li>
              <li>
                <Link 
                  to="/login" 
                  className="hover:text-white transition-colors"
                >
                  Institutional Login
                </Link>
              </li>
              <li>
                <Link 
                  to="/forgot-password" 
                  className="hover:text-white transition-colors"
                >
                  Password Recovery
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 font-mono">
          <p>© {new Date().getFullYear()} MedEx. Frontend Prototype Edition.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/about" className="hover:text-slate-300 transition-colors">
              About
            </Link>
            <Link to="/how-it-works" className="hover:text-slate-300 transition-colors">
              How It Works
            </Link>
            <Link to="/privacy-policy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">
              Terms
            </Link>
            <Link to="/cookie-preferences" className="hover:text-slate-300 transition-colors">
              Cookies
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
