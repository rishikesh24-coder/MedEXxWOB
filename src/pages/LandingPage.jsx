import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Boxes,
  RefreshCw,
  BellRing,
  Truck,
  CreditCard,
  Building2,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Award,
  Zap,
  Lock,
  Activity,
  ThermometerSnowflake,
  ExternalLink,
  ChevronRight,
  FileCheck2
} from 'lucide-react';
import FloatingNetworkHero from '../components/spatial/FloatingNetworkHero';

export const LandingPage = () => {
  const features = [
    {
      icon: ShieldCheck,
      title: 'Institutional Verification',
      desc: 'Rigorous 4-tier statutory compliance audit verifying CDSCO registration, State Drug Controller permits (Form 20B/21B), and Medical Director authorization.',
      color: 'from-teal-600 to-emerald-600',
      tag: 'CDSCO Rule 65',
      stat: '100% Verified'
    },
    {
      icon: Boxes,
      title: 'Intelligent Inventory Ledger',
      desc: 'Live digital warehouse racks with dynamic shelf-life concession calculations automatically adjusting unit prices as expiration thresholds approach.',
      color: 'from-blue-600 to-cyan-600',
      tag: 'Dynamic Concession',
      stat: '₹4.8M Saved'
    },
    {
      icon: RefreshCw,
      title: 'Peer-to-Peer Exchange',
      desc: 'High-frequency bilateral hospital network enabling immediate transfer of near-expiry stocks to high-volume emergency trauma centers.',
      color: 'from-ocean-800 to-teal-700',
      tag: 'Zero Wastage',
      stat: '0.4s Matching'
    },
    {
      icon: BellRing,
      title: 'Predictive Expiry Triggers',
      desc: 'Automated 90/60/30-day early warnings flagging slow-moving batches for prioritized redistribution before regulatory quarantine thresholds.',
      color: 'from-amber-500 to-orange-600',
      tag: 'Proactive Alert',
      stat: '90D Warning'
    },
    {
      icon: Truck,
      title: 'IoT Cold-Chain Telemetry',
      desc: 'GPS highway route tracking with real-time temperature loggers (2°C - 8°C) guaranteeing complete clinical potency across the Mumbai-Pune cluster.',
      color: 'from-sky-600 to-teal-700',
      tag: '2°C - 8°C Strict',
      stat: '< 4.2h Transit'
    },
    {
      icon: CreditCard,
      title: 'Razorpay B2B Escrow',
      desc: 'Integrated nodal escrow locking requisition funds securely. Capital is automatically released only after physical pharmacy intake inspection.',
      color: 'from-emerald-600 to-teal-800',
      tag: 'Dispute-Free',
      stat: 'Instant Escrow'
    },
  ];

  const liveTickers = [
    { name: 'Meropenem 1g IV', hospital: 'Apollo Central', discount: '40% OFF', temp: '20°C - 25°C', stock: '240 Vials' },
    { name: 'Trastuzumab 440mg', hospital: 'Fortis Memorial', discount: '50% OFF', temp: '2°C - 8°C', stock: '45 Vials' },
    { name: 'Piperacillin-Tazo 4.5g', hospital: 'Kokilaben Dhirubhai', discount: '35% OFF', temp: 'Room Temp', stock: '410 Vials' },
    { name: 'Enoxaparin 40mg PFS', hospital: 'Nanavati Super Speciality', discount: '45% OFF', temp: '2°C - 8°C', stock: '320 Syringes' },
  ];

  const stats = [
    { value: '140+', label: 'Verified Hospitals', desc: 'Accredited B2B Health Network' },
    { value: '₹18.4M', label: 'Surplus Redistributed', desc: 'Saved from Incineration Disposal' },
    { value: '3,840+', label: 'Cold-Chain Transfers', desc: 'Zero Temperature Deviations' },
    { value: '99.2%', label: 'Transit SLA Delivery', desc: 'Average Turnaround: 3.8 Hours' },
  ];

  return (
    <div className="space-y-24 pb-20 overflow-hidden">
      
      {/* 1. HERO SECTION WITH 3D NETWORK HERO */}
      <section className="relative pt-8 pb-16 lg:pt-14 lg:pb-24 overflow-hidden border-b border-slate-200/70 bg-gradient-to-b from-slate-50 via-white to-teal-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-6">
            
            {/* Regulatory Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-bold tracking-wide shadow-sm">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>India's Inter-Hospital Medicine Redistribution Network</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
              Zero Medicine Expiry.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-ocean-800">
                Guaranteed Cold-Chain Logistics.
              </span>
            </h1>

            {/* Subtext */}
            <p className="text-base sm:text-lg font-medium text-slate-600 leading-relaxed max-w-2xl mx-auto">
              MedEx interconnects verified hospital pharmacies across urban clusters to exchange surplus, near-expiry life-saving drugs before they expire—protected by CDSCO compliance and Razorpay escrow.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <Link
                to="/hospital-signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-xl shadow-teal-600/20 transition-all hover:scale-[1.02]"
              >
                <span>Onboard Your Hospital</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-300 shadow-sm transition-all hover:border-slate-400"
              >
                <Activity className="w-4 h-4 text-teal-600" />
                <span>Launch Interactive Demo</span>
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>CDSCO Rule 65 Compliant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Razorpay B2B Escrow Nodal Account</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600" />
                <span>Active 2°C - 8°C IoT Telemetry</span>
              </div>
            </div>

          </div>

          {/* SPATIAL 3D NETWORK HERO EMBED */}
          <div className="max-w-5xl mx-auto pt-4">
            <FloatingNetworkHero />
          </div>

        </div>
      </section>

      {/* 2. STATS COUNTER STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-200/80 p-6 sm:p-8">
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center p-3 border-r last:border-r-0 border-slate-100">
              <p className="text-3xl sm:text-4xl font-black text-teal-700 tracking-tight font-mono">
                {stat.value}
              </p>
              <h4 className="text-sm font-bold text-slate-900 mt-1">{stat.label}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{stat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. LIVE REDISTRIBUTION TICKER (DEMO SHOWCASE) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Live Inter-Hospital Surplus Batches (Mumbai Metro Cluster)
            </h3>
          </div>
          <Link to="/login" className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1">
            View Marketplace <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {liveTickers.map((item, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-teal-300 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900 group-hover:text-teal-700 transition-colors">{item.name}</h4>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    <span>{item.hospital}</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {item.discount}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-[11px] font-mono">
                <span className="flex items-center gap-1 text-sky-700">
                  <ThermometerSnowflake className="w-3 h-3" /> {item.temp}
                </span>
                <span className="font-bold text-slate-700">{item.stock}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SIX PILLARS ARCHITECTURAL SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-widest text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            Enterprise Infrastructure
          </span>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            Six Architectural Pillars of Smart Healthcare Logistics
          </h2>
          <p className="text-sm text-slate-600">
            Engineered to eliminate pharmacy inventory imbalances, maintain therapeutic efficacy, and uphold strict CDSCO pharmaceutical standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="group relative bg-white rounded-3xl border border-slate-200/80 p-7 shadow-sm hover:shadow-xl hover:border-teal-400/80 transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${feature.color} flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 block">
                        {feature.tag}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-teal-700 block mt-1">
                        {feature.stat}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                    {feature.title}
                  </h3>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    {feature.desc}
                  </p>
                </div>

                <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-teal-700 group-hover:text-teal-800">
                  <span>Explore Protocol</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. WORKFLOW STEPPER BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-br from-ocean-950 via-ocean-900 to-teal-950 text-white p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.3),transparent_70%)] pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl space-y-6">
            <span className="text-xs font-black uppercase tracking-widest text-teal-300 bg-teal-500/20 px-3 py-1 rounded-full border border-teal-400/30">
              Zero Drug Wastage Protocol
            </span>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight text-white">
              How MedEx Executes Inter-Hospital Redistribution in 3 Fast Steps
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-2 text-xs">
              <div className="space-y-2.5 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="text-teal-400 font-mono font-black text-xs uppercase tracking-wider">Step 01</div>
                <h4 className="font-bold text-white text-sm">Surplus Ingestion</h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Hospital lists slow-moving batch. Concession calculator assigns dynamic pricing based on remaining shelf life.
                </p>
              </div>

              <div className="space-y-2.5 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="text-teal-400 font-mono font-black text-xs uppercase tracking-wider">Step 02</div>
                <h4 className="font-bold text-white text-sm">Requisition & Escrow</h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Peer trauma hospital claims batch. Settlement funds are locked in Razorpay B2B Escrow upon dispatch approval.
                </p>
              </div>

              <div className="space-y-2.5 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="text-teal-400 font-mono font-black text-xs uppercase tracking-wider">Step 03</div>
                <h4 className="font-bold text-white text-sm">Active Cold Chain</h4>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Insulated thermal box dispatched with IoT GPS and temperature probes. Funds released on intake signoff.
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <Link
                to="/hospital-signup"
                className="px-7 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-ocean-950 font-black text-xs shadow-lg transition-all"
              >
                Onboard Your Hospital Now
              </Link>
              <Link
                to="/login"
                className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all"
              >
                Open Pharmacy Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
