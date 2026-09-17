import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Pill, 
  ShieldCheck, 
  AlertTriangle, 
  Boxes, 
  Truck, 
  CreditCard, 
  RefreshCw, 
  HeartHandshake, 
  CheckCircle2, 
  ArrowRight,
  TrendingDown,
  Building2,
  Lock,
  Layers,
  Sparkles
} from 'lucide-react';

export const AboutPage = () => {
  useEffect(() => {
    document.title = 'MedEx | About Us';
  }, []);

  return (
    <div className="space-y-16 pb-20">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary-900 via-secondary-900 to-slate-950 text-white py-20 px-4 sm:px-6 lg:px-8 border-b border-secondary-800">
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-cyan-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Healthcare Resource Efficiency</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
            Making unused medicines useful.
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            MedEx is a digital platform that enables verified hospitals to exchange surplus and near-expiry medicines directly with other healthcare institutions before they go to waste.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <Link
              to="/hospital/marketplace"
              className="px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold text-xs shadow-lg shadow-primary-500/20 transition-all inline-flex items-center gap-2"
            >
              <span>Explore Medicine Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/how-it-works"
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/20 transition-all inline-flex items-center gap-2 backdrop-blur-md"
            >
              <span>See How It Works</span>
            </Link>
          </div>

        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Section: The Problem */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-bold font-mono text-primary-600 uppercase tracking-wider">
              The Reality
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              The Medicine Wastage Problem
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Unused Shelf Expiry</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hospitals routinely order surplus stocks of critical treatments that go unused due to shifting patient caseloads. Without a direct redistribution channel, these essential drugs expire in storerooms.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <TrendingDown className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Unnecessary Losses</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Writing off expired pharmaceutical batches represents significant financial drain for healthcare facilities, while simultaneously putting strains on raw material availability.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Boxes className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Uneven Regional Demand</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                One facility may face an acute shortage of a specialized oncology or ICU drug, while another institution just a short highway transit away holds surplus units approaching expiry.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Our Solution */}
        <section className="space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <span className="text-xs font-bold font-mono text-primary-600 uppercase tracking-wider">
              The Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Our Solution: Inter-Hospital Exchange
            </h2>
          </div>

          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
            MedEx connects hospital pharmacies directly into a collaborative network. Instead of letting usable medicine expire, hospitals list batches at transparent concession rates so neighboring facilities can acquire needed units quickly and affordably.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              <h4 className="text-sm font-extrabold text-slate-900">Institutional Verification</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Only verified hospitals and licensed healthcare institutions can access the exchange, ensuring safety and compliance.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
              <Layers className="w-6 h-6 text-primary-600" />
              <h4 className="text-sm font-extrabold text-slate-900">Live Inventory Management</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Digital stock registers track batch numbers, manufacturer, expiry dates, and real-time inventory allocation.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
              <RefreshCw className="w-6 h-6 text-cyan-600" />
              <h4 className="text-sm font-extrabold text-slate-900">Concession Pricing</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Automated concession schedules incentivize rapid redistribution before medicines enter their critical expiry window.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
              <Truck className="w-6 h-6 text-indigo-600" />
              <h4 className="text-sm font-extrabold text-slate-900">Corridor Logistics Tracking</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Checkpoint visibility from seller dispatch dock to receiving intake bay with simulated telemetry.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
              <CreditCard className="w-6 h-6 text-teal-600" />
              <h4 className="text-sm font-extrabold text-slate-900">Structured Settlement Flow</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Transparent transaction records with automated invoices, escrow holding, and receipt sign-offs.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
              <h4 className="text-sm font-extrabold text-slate-900">Quarantine & Expiry Safeguards</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                When medicines reach terminal expiry, the platform automatically quarantines them to protect supply-chain integrity and patient safety.
              </p>
            </div>
          </div>
        </section>

        {/* Section: How MedEx Helps Hospitals */}
        <section className="bg-slate-50 p-8 sm:p-10 rounded-3xl border border-slate-200/90 space-y-6">
          <div className="max-w-2xl">
            <span className="text-xs font-bold font-mono text-primary-600 uppercase tracking-wider">
              Operational Impact
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              How MedEx Helps Hospitals
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-slate-600">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Recover Value on Surplus Stock</span>
              </div>
              <p className="leading-relaxed pl-6">
                Hospitals can recoup significant capital on items that would otherwise end up as complete write-offs, freeing up pharmacy operational budgets.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Access Medicines at Concession</span>
              </div>
              <p className="leading-relaxed pl-6">
                Receiving institutions procure high-cost specialty pharmaceuticals, injections, and vaccines at reduced price points for immediate clinical administration.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Automated Expiry Alerts</span>
              </div>
              <p className="leading-relaxed pl-6">
                Digital monitors track inventory age and notify hospital teams 90, 60, and 30 days before critical dates, prompting timely redistribution.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Complete Audit Trail</span>
              </div>
              <p className="leading-relaxed pl-6">
                Every batch exchange, transfer acknowledgment, and disposal manifest generates a verifiable digital record for internal hospital compliance.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Our Vision */}
        <section className="text-center space-y-5 max-w-3xl mx-auto py-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center mx-auto">
            <HeartHandshake className="w-6 h-6" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Our Vision
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed font-normal">
            We envision a zero-waste healthcare ecosystem where no viable medicine expires unutilized while patients in need wait for treatment. By turning surplus pharmaceutical inventories into shared community resources, MedEx bridges supply gaps between hospitals and supports clinical care across India.
          </p>

          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <Link
              to="/hospital-signup"
              className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-600/20 transition-all"
            >
              Join Platform
            </Link>
            <Link
              to="/terms"
              className="px-6 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all"
            >
              Read Terms & Conditions
            </Link>
          </div>
        </section>

      </div>

    </div>
  );
};

export default AboutPage;
