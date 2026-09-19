import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  Archive, 
  Thermometer, 
  Boxes, 
  HelpCircle,
  ChevronRight,
  X
} from 'lucide-react';

export const SpatialInventoryOverview = ({ onCategorySelect }) => {
  const [selectedCategory, setSelectedCategory] = useState('critical');
  const [activeTooltip, setActiveTooltip] = useState(null);
  const tooltipRef = useRef(null);

  // Close tooltip on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = [
    {
      id: 'critical',
      label: 'Low Stock',
      subtext: 'Some medicines may run out soon.',
      quantity: 18,
      quantityDisplay: '18',
      quantityUnit: 'units affected',
      percent: '1.9%',
      percentValue: 1.9,
      percentContext: '1.9% of total stock',
      timingExplanation: 'Below safe minimum level',
      statusBadge: 'Restock Needed',
      color: 'rose',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      iconBg: 'bg-rose-500/10 text-rose-600',
      barColor: 'bg-rose-500',
      icon: AlertOctagon,
      actionText: 'Action: Check stock and plan a refill',
      actionBtnLabel: 'Review Low Stock',
      actionUrl: '/hospital/inventory',
      tooltip: {
        title: 'What does this mean?',
        description: 'Some medicines may run out soon. Check your current quantity and consider restocking before supplies run out.'
      },
      policyNote: null,
      highlightItem: {
        headerBadge: 'NEEDS YOUR ATTENTION',
        name: 'Meropenem 1g IV',
        stock: '14 vials remaining',
        action: 'Check Stock / Restock',
        temp: 'Keep refrigerated: 2°C–8°C'
      }
    },
    {
      id: 'near-expiry',
      label: 'Medicines Expiring Soon',
      subtext: 'These medicines need attention before they expire.',
      quantity: 84,
      quantityDisplay: '84',
      quantityUnit: 'units',
      percent: '8.9%',
      percentValue: 8.9,
      percentContext: '8.9% of total stock',
      timingExplanation: 'Expiry within the next 2 months',
      statusBadge: 'Review Soon',
      color: 'amber',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-500/10 text-amber-600',
      barColor: 'bg-amber-500',
      icon: Clock,
      actionText: 'Action: Review Expiring Medicines',
      actionBtnLabel: 'Review Expiring Medicines',
      actionUrl: '/hospital/inventory',
      tooltip: {
        title: 'What does this mean?',
        description: 'These medicines are getting closer to their expiry date. Review them early so usable stock is not wasted. (Note: Under platform safety rules, medicines with ≤30 days remaining cannot be transferred or sold).'
      },
      policyNote: 'Some stock may no longer be eligible for transfer or sale.',
      concessionNote: 'Eligible stock may receive a concession',
      highlightItem: {
        headerBadge: 'NEEDS YOUR ATTENTION',
        name: 'Ceftriaxone 1g Injection',
        stock: '84 units (Expires in 21d)',
        action: 'Use In-House / Not Eligible for Sale (≤30d)',
        temp: 'Room Temperature: <25°C'
      }
    },
    {
      id: 'healthy',
      label: 'Healthy Stock',
      subtext: 'Most medicines have a comfortable amount of time before expiry.',
      quantity: 612,
      quantityDisplay: '612',
      quantityUnit: 'units',
      percent: '65.1%',
      percentValue: 65.1,
      percentContext: '65.1% of total stock',
      timingExplanation: '60+ days before expiry',
      statusBadge: 'Stock Looks Healthy',
      color: 'emerald',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-500/10 text-emerald-600',
      barColor: 'bg-emerald-500',
      icon: CheckCircle2,
      actionText: 'Action: Continue normal stock monitoring',
      actionBtnLabel: 'View Healthy Stock',
      actionUrl: '/hospital/inventory',
      tooltip: {
        title: 'What does this mean?',
        description: 'These medicines have a comfortable amount of time before expiry and normal stock reserves.'
      },
      policyNote: null,
      highlightItem: {
        headerBadge: 'STOCK STATUS: HEALTHY',
        name: 'Paracetamol 650mg Tabs',
        stock: '320 units available',
        action: 'Adequate Stock / Continue Normal Monitoring',
        temp: 'Standard Storage: 15°C–25°C'
      }
    },
    {
      id: 'overstocked',
      label: 'Extra Stock',
      subtext: 'You may have more stock than your hospital currently needs.',
      quantity: 226,
      quantityDisplay: '226',
      quantityUnit: 'units',
      percent: '24.0%',
      percentValue: 24.0,
      percentContext: '24.0% of total stock',
      timingExplanation: 'Stock held beyond your current needs',
      statusBadge: 'Review Extra Stock',
      color: 'cyan',
      badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      iconBg: 'bg-cyan-500/10 text-cyan-600',
      barColor: 'bg-primary-500',
      icon: Archive,
      actionText: 'Action: Review stock that could be shared or sold',
      actionBtnLabel: 'Review Extra Stock',
      actionUrl: '/hospital/inventory',
      tooltip: {
        title: 'What does this mean?',
        description: 'You may have more stock than you currently need. Review whether some eligible stock can be used, shared, or sold.'
      },
      valuationText: 'Approx. inventory value: ₹3.4L',
      policyNote: 'Only eligible stock (>30d shelf life) can be shared or sold.',
      highlightItem: {
        headerBadge: 'STOCK STATUS: EXTRA STOCK',
        name: 'Insulin Glargine (Lantus)',
        stock: '42 units surplus',
        action: 'Check Sharing or Marketplace Eligibility',
        temp: 'Cold Chain: 2°C–8°C'
      }
    }
  ];

  const currentCat = categories.find((c) => c.id === selectedCategory) || categories[0];

  const handleSelect = (id) => {
    setSelectedCategory(id);
    if (onCategorySelect) onCategorySelect(id);
  };

  const toggleTooltip = (e, id) => {
    e.stopPropagation();
    setActiveTooltip((prev) => (prev === id ? null : id));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Medicine Stock Overview
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-primary-700 bg-primary-50 rounded border border-primary-200">
              LIVE INVENTORY STATUS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Quickly see which medicines need restocking, which are near expiry, and which are healthy.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span>Active Units: <strong className="text-slate-900 font-bold">940 Total</strong></span>
        </div>
      </div>

      {/* 4 Plain-Language Inventory Intelligence Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" ref={tooltipRef}>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const isTooltipOpen = activeTooltip === cat.id;
          const Icon = cat.icon;

          return (
            <div
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-b from-white to-slate-50/90 border-primary-500 shadow-md ring-2 ring-primary-500/20'
                  : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-subtle'
              }`}
            >
              {/* Active Indicator Bar */}
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500 rounded-t-xl" />
              )}

              {/* Card Top Section: Icon, Badge, and Educational Tooltip Button */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${cat.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cat.badgeColor}`}>
                      {cat.statusBadge}
                    </span>

                    {/* Educational "What does this mean?" Trigger */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => toggleTooltip(e, cat.id)}
                        title="What does this mean?"
                        aria-label="What does this mean?"
                        className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </button>

                      {/* Educational Tooltip Popover */}
                      {isTooltipOpen && (
                        <div 
                          className="absolute right-0 top-6 z-30 w-64 p-3 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 text-xs animate-in fade-in zoom-in-95 duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-start justify-between gap-2 pb-1 border-b border-slate-800">
                            <span className="font-bold text-cyan-300 text-[11px] flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" />
                              {cat.tooltip.title}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => toggleTooltip(e, cat.id)}
                              className="text-slate-400 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="mt-1.5 text-slate-300 text-[11px] leading-relaxed">
                            {cat.tooltip.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Title & Plain-English Supporting Text */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">{cat.label}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{cat.subtext}</p>
                </div>
              </div>

              {/* Card Middle: Primary Quantity & Clear Explanation */}
              <div className="pt-4 mt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                    {cat.quantityDisplay}{' '}
                    <span className="text-xs font-semibold text-slate-600 font-sans">
                      {cat.quantityUnit}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-500">
                    {cat.percentContext}
                  </span>
                </div>

                {/* Visual Share Bar (Mathematically Accurate to 940 Total Units) */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${cat.barColor}`}
                    style={{ width: `${cat.percentValue}%`, minWidth: '4px' }}
                  />
                </div>

                {/* Plain-English Timing & Status Context */}
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-slate-500">Timeline:</span>
                    <span className="font-semibold text-slate-800">{cat.timingExplanation}</span>
                  </div>

                  {/* Optional Policy and Valuation Notes */}
                  {cat.policyNote && (
                    <p className="text-[10px] text-amber-700 bg-amber-50/80 rounded px-1.5 py-0.5 border border-amber-200/60 leading-tight">
                      {cat.policyNote}
                    </p>
                  )}

                  {cat.concessionNote && (
                    <p className="text-[10px] text-emerald-700 bg-emerald-50/80 rounded px-1.5 py-0.5 border border-emerald-200/60 leading-tight">
                      {cat.concessionNote}
                    </p>
                  )}

                  {cat.valuationText && (
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span className="text-slate-500">Estimated value:</span>
                      <span className="font-mono font-semibold text-slate-800">{cat.valuationText.replace('Approx. inventory value: ', '')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer: Action Recommendation & Direct Action Link */}
              <div className="pt-3 mt-3 border-t border-slate-100/90 flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-slate-700">
                  {cat.actionText}
                </span>

                <Link
                  to={cat.actionUrl}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-primary-50 hover:text-primary-800 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1 group/btn"
                >
                  <span>{cat.actionBtnLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                </Link>
              </div>

            </div>
          );
        })}
      </div>

      {/* Needs Your Attention / Focal Point Strip for Selected Category */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-secondary-900 to-primary-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 shadow-inner">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-400/30 text-primary-300 flex items-center justify-center font-bold shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-300 uppercase tracking-wider font-bold">
                {currentCat.highlightItem.headerBadge}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200 font-mono">
                {currentCat.label}
              </span>
            </div>
            <p className="text-sm font-bold text-white mt-0.5">
              {currentCat.highlightItem.name} • <span className="font-normal text-slate-300">{currentCat.highlightItem.stock}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right text-xs">
            <span className="text-slate-400 block text-[10px]">Storage Condition</span>
            <span className="font-mono text-emerald-400 font-bold flex items-center gap-1 justify-end">
              <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
              {currentCat.highlightItem.temp}
            </span>
          </div>

          <div className="h-8 w-px bg-white/15 hidden md:block" />

          <div className="text-right text-xs">
            <span className="text-slate-400 block text-[10px]">Recommended Action</span>
            <span className="font-bold text-amber-300">
              {currentCat.highlightItem.action}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SpatialInventoryOverview;
