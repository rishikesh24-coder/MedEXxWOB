import React from 'react';
import { Truck, ArrowDown, MapPin, ThermometerSnowflake, AlertCircle, ShieldCheck } from 'lucide-react';

/**
 * LogisticsEstimate Component
 * Displays itemized distance-based logistics estimation for an order/requisition
 * prior to payment checkout.
 */
export const LogisticsEstimate = ({ estimate, className = '' }) => {
  if (!estimate) return null;

  const {
    isAvailable,
    sellerName,
    sellerLocation,
    buyerName,
    buyerLocation,
    distanceKm,
    deliveryCharge,
    formattedDistance,
    formattedCharge,
    isColdChain,
    disclaimer,
    note
  } = estimate;

  return (
    <div className={`p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
            <Truck className="w-3.5 h-3.5 text-teal-700" />
          </div>
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-800 block">
              DELIVERY & LOGISTICS
            </span>
            <span className="text-[10px] text-slate-500 font-sans block">
              Estimated Logistics
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isColdChain && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-100 text-cyan-800 border border-cyan-200">
              <ThermometerSnowflake className="w-3 h-3 text-cyan-700" />
              <span>Cold-Chain Required</span>
            </span>
          )}
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-200/70 text-slate-700 border border-slate-300">
            Approximate distance-based estimate
          </span>
        </div>
      </div>

      {/* Origin -> Destination Route Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Origin / Seller (Pickup) */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-slate-400">
            <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
            <span>PICKUP (SELLER)</span>
          </div>
          <div className="text-xs font-bold text-slate-900 leading-snug">
            {sellerName || 'Supplying Hospital'}
          </div>
          {sellerLocation && (
            <div className="text-[11px] text-slate-500 leading-tight">
              {sellerLocation}
            </div>
          )}
        </div>

        {/* Destination / Buyer (Delivery) */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-slate-400">
            <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>DELIVERY (BUYER)</span>
          </div>
          <div className="text-xs font-bold text-slate-900 leading-snug">
            {buyerName || 'Procuring Hospital'}
          </div>
          {buyerLocation && (
            <div className="text-[11px] text-slate-500 leading-tight">
              {buyerLocation}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row: Distance & Estimated Delivery Charge */}
      <div className="p-3 bg-teal-50/40 rounded-lg border border-teal-100 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-mono text-slate-500 block">
            Estimated Distance
          </span>
          <span className="text-xs font-mono font-bold text-slate-800">
            {isAvailable ? formattedDistance : 'Distance unavailable'}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">
            Estimated Delivery Charge
          </span>
          <span className="text-sm font-mono font-extrabold text-teal-800">
            {isAvailable ? formattedCharge : 'Delivery charge unavailable'}
          </span>
        </div>
      </div>

      {/* Footnote / Disclaimer */}
      <div className="pt-0.5 space-y-0.5">
        <p className="text-[11px] text-slate-500 leading-tight">
          {disclaimer || 'Delivery charge is an estimated distance-based logistics cost.'}
        </p>
        <p className="text-[10px] text-slate-400 italic">
          {note || 'Distance-based estimate • Final logistics cost may vary'}
        </p>
      </div>
    </div>
  );
};

export default LogisticsEstimate;
