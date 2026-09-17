import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  ShieldCheck, 
  PlusCircle, 
  Search, 
  Send, 
  CheckCircle2, 
  XCircle, 
  CreditCard, 
  Truck, 
  PackageCheck, 
  Clock, 
  AlertTriangle, 
  ArrowRight,
  Sparkles,
  Info,
  Timer
} from 'lucide-react';

export const HowItWorksPage = () => {
  useEffect(() => {
    document.title = 'MedEx | How It Works';
  }, []);

  const steps = [
    {
      num: 1,
      title: 'Hospital Registers',
      icon: Building2,
      desc: 'The healthcare facility signs up by submitting basic hospital identity details, state health authority registration numbers, and official pharmacist contact information.',
      color: 'bg-teal-50 text-teal-700 border-teal-200'
    },
    {
      num: 2,
      title: 'Hospital Verification',
      icon: ShieldCheck,
      desc: 'Supervisory administrators audit uploaded statutory documents (such as Drug Controller licenses and establishment certificates) before granting full platform access.',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      num: 3,
      title: 'Hospital Lists Surplus Medicine',
      icon: PlusCircle,
      desc: 'The hospital pharmacy inputs excess batches specifying brand, generic formulation, batch number, manufacturer, expiry date, storage conditions, and concession discount.',
      color: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      num: 4,
      title: 'Another Hospital Searches',
      icon: Search,
      desc: 'Partner hospitals in need of medicines browse the live marketplace, filtering listings by therapeutic category, manufacturer, proximity, or expiry range.',
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200'
    },
    {
      num: 5,
      title: 'Medicine Request',
      icon: Send,
      desc: 'The purchasing hospital creates a digital transfer requisition for the required units, specifying their receiving intake gate and urgent clinical priority.',
      color: 'bg-violet-50 text-violet-700 border-violet-200'
    },
    {
      num: 6,
      title: 'Seller Accepts',
      icon: CheckCircle2,
      desc: 'The listing hospital reviews the requisition, inspects their physical pharmacy reserve, and confirms the allocation for dispatch.',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      num: 7,
      title: 'Competing Requests Automatically Declined',
      icon: XCircle,
      desc: 'To prevent stock double-allocation, once a seller accepts a requisition, any conflicting or overlapping pending requests for that batch are automatically closed.',
      color: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      num: 8,
      title: 'Payment Settlement',
      icon: CreditCard,
      desc: 'The purchasing hospital initiates the transaction settlement. Funds are held in escrow and released upon confirmed inspection and dock receipt.',
      color: 'bg-teal-50 text-teal-700 border-teal-200'
    },
    {
      num: 9,
      title: 'Transfer & Tracking',
      icon: Truck,
      desc: 'The consignment is packed in insulated containers and dispatched. Both facilities monitor simulated checkpoint corridor transit in real time.',
      color: 'bg-cyan-50 text-cyan-700 border-cyan-200'
    },
    {
      num: 10,
      title: 'Delivery & Intake Sign-Off',
      icon: PackageCheck,
      desc: 'The consignment arrives at the receiving hospital intake dock. Pharmacists conduct quality checks and complete digital handoff sign-off.',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      num: 11,
      title: 'Expiry Monitoring',
      icon: Clock,
      desc: 'Automated background monitors continuously track shelf life across all listed inventories, generating alerts 90, 60, and 30 days before critical expiry.',
      color: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    {
      num: 12,
      title: 'Safe Waste Disposal',
      icon: AlertTriangle,
      desc: 'When medicines reach terminal expiration without being transferred, the platform transitions them into authorized bio-medical waste manifests.',
      color: 'bg-rose-50 text-rose-700 border-rose-200'
    }
  ];

  return (
    <div className="space-y-16 pb-20">
      
      {/* Header */}
      <section className="bg-gradient-to-b from-primary-900 via-secondary-900 to-slate-950 text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-secondary-800">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-cyan-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Platform Lifecycle Guide</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            How MedEx Works
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            A comprehensive, 12-step overview of how hospitals register, list surplus pharmaceuticals, exchange essential medicines, track delivery, and safely manage disposal.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Important Business Rule Alert Callout */}
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-50 border border-amber-200/90 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0 font-bold">
            <Timer className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <h3 className="text-sm font-extrabold text-amber-950">
              Important Business Rule: 48-Hour Request Window
            </h3>
            <p className="text-amber-900 leading-relaxed">
              To prevent inventory lockups, <strong>transfer requests automatically expire after 48 hours</strong> if the seller hospital takes no action. This releases reserved units back into the active marketplace for other facilities.
            </p>
          </div>
        </div>

        {/* 12 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div 
                key={step.num}
                className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:border-primary-300 transition-all space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black text-slate-400 group-hover:text-primary-600 transition-colors">
                    STEP {step.num < 10 ? `0${step.num}` : step.num}
                  </span>
                  <div className={`w-9 h-9 rounded-2xl border flex items-center justify-center ${step.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  {step.title}
                </h3>

                <p className="text-xs text-slate-600 leading-relaxed font-normal">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Bottom Call to Action */}
        <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-xl border border-slate-800">
          <div className="space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Ready to reduce pharmaceutical waste?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Join verified healthcare institutions optimizing pharmacy inventories across India.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/hospital-signup"
              className="px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold text-xs shadow-md shadow-primary-500/20 transition-all inline-flex items-center gap-2"
            >
              <span>Register Hospital</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/hospital/marketplace"
              className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all inline-flex items-center gap-2"
            >
              <span>Explore Marketplace</span>
            </Link>
          </div>
        </section>

      </div>

    </div>
  );
};

export default HowItWorksPage;
