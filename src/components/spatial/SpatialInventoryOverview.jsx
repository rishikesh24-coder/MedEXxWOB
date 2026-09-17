import React, { useState } from 'react';
import { 
  AlertOctagon, 
  Clock, 
  CheckCircle2, 
  Archive, 
  Thermometer, 
  ArrowUpRight, 
  ArrowDownRight, 
  Boxes, 
  TrendingDown, 
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

export const SpatialInventoryOverview = ({ onCategorySelect }) => {
  const [selectedCategory, setSelectedCategory] = useState('near-expiry');

  const categories = [
    {
      id: 'critical',
      label: 'Critical Stock',
      subtext: 'Below minimum buffer (<15 days)',
      quantity: 18,
      percent: '9.8%',
      trend: '-14% buffer',
      trendType: 'down',
      expiryRisk: 'High Shortage Risk',
      color: 'rose',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
      iconBg: 'bg-rose-500/10 text-rose-600',
      icon: AlertOctagon,
      highlightItem: {
        name: 'Meropenem 1g IV',
        stock: '14 vials left',
        action: 'Immediate Restock Needed',
        temp: 'Cold 2°C - 8°C'
      }
    },
    {
      id: 'near-expiry',
      label: 'Near Expiry Opportunities',
      subtext: 'Expiring in 21 - 60 days',
      quantity: 84,
      percent: '45.6%',
      trend: '35% avg concession',
      trendType: 'up',
      expiryRisk: 'Redistribute Now',
      color: 'amber',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-500/10 text-amber-600',
      icon: Clock,
      highlightItem: {
        name: 'Ceftriaxone 1g Injection',
        stock: '84 units (Expires in 21d)',
        action: '40% Concession Live on Market',
        temp: 'Room Temp <25°C'
      }
    },
    {
      id: 'healthy',
      label: 'Healthy Stock Reserve',
      subtext: '60 - 365 days shelf-life',
      quantity: 612,
      percent: '65.1%',
      trend: '+8.2% stable turnover',
      trendType: 'up',
      expiryRisk: 'Zero Expiry Risk',
      color: 'emerald',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBg: 'bg-emerald-500/10 text-emerald-600',
      icon: CheckCircle2,
      highlightItem: {
        name: 'Paracetamol 650mg Tabs',
        stock: '320 units available',
        action: 'Optimal Hospital Demand',
        temp: 'Standard Store'
      }
    },
    {
      id: 'overstocked',
      label: 'Overstocked Surplus',
      subtext: 'Excess buffer beyond 90 days',
      quantity: 226,
      percent: '24.0%',
      trend: 'Capital locked ₹3.4L',
      trendType: 'neutral',
      expiryRisk: 'Monetize on B2B Exchange',
      color: 'cyan',
      badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      iconBg: 'bg-cyan-500/10 text-cyan-600',
      icon: Archive,
      highlightItem: {
        name: 'Insulin Glargine (Lantus)',
        stock: '42 units surplus',
        action: 'Listed for Peer Exchange',
        temp: 'Cold Chain 4.2°C'
      }
    }
  ];

  const currentCat = categories.find((c) => c.id === selectedCategory) || categories[1];

  const handleSelect = (id) => {
    setSelectedCategory(id);
    if (onCategorySelect) onCategorySelect(id);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-5">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
              Spatial Medicine Warehouse Intelligence
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-primary-700 bg-primary-50 rounded border border-primary-200">
              PHYSICAL DIGITAL LEDGER
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-category partition monitoring shelf-life velocity, cold-chain telemetry, and automated concession yield.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <span>Active Units: <strong className="text-slate-900 font-bold">940 Total</strong></span>
        </div>
      </div>

      {/* 4 Spatial Category Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const Icon = cat.icon;

          return (
            <div
              key={cat.id}
              onClick={() => handleSelect(cat.id)}
              className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-b from-white to-slate-50/90 border-primary-500 shadow-md ring-2 ring-primary-500/20'
                  : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-subtle'
              }`}
            >
              {/* Category Top Row */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${cat.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cat.badgeColor}`}>
                    {cat.expiryRisk}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800">{cat.label}</h4>
                  <p className="text-[11px] text-slate-400">{cat.subtext}</p>
                </div>
              </div>

              {/* Quantity and Share Bar */}
              <div className="pt-4 mt-2 border-t border-slate-100">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                    {cat.quantity} <span className="text-xs font-normal text-slate-400">units</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-600">
                    {cat.percent}
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      cat.color === 'rose'
                        ? 'bg-rose-500'
                        : cat.color === 'amber'
                        ? 'bg-amber-500'
                        : cat.color === 'emerald'
                        ? 'bg-emerald-500'
                        : 'bg-primary-500'
                    }`}
                    style={{ width: cat.percent }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-medium">
                  <span>Trend:</span>
                  <span className={`font-mono font-semibold ${
                    cat.trendType === 'down' ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {cat.trend}
                  </span>
                </div>
              </div>

              {/* Active Indicator bar */}
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500" />
              )}
            </div>
          );
        })}
      </div>

      {/* Deep-Dive Inspection Strip for Selected Category */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-secondary-900 to-primary-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 shadow-inner">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-400/30 text-primary-300 flex items-center justify-center font-bold">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-cyan-300 uppercase tracking-wider font-bold">
                Category Focal Point: {currentCat.label}
              </span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-white/10 text-white font-mono">
                {currentCat.quantity} Total Consignments
              </span>
            </div>
            <p className="text-sm font-bold text-white mt-0.5">
              {currentCat.highlightItem.name} • <span className="font-normal text-slate-300">{currentCat.highlightItem.stock}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right text-xs">
            <span className="text-slate-400 block text-[10px]">Storage Condition</span>
            <span className="font-mono text-emerald-400 font-bold flex items-center gap-1 justify-end">
              <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
              {currentCat.highlightItem.temp}
            </span>
          </div>

          <div className="h-8 w-px bg-white/15 hidden md:block" />

          <div className="text-right text-xs">
            <span className="text-slate-400 block text-[10px]">Action Recommended</span>
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
