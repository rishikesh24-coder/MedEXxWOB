import React from 'react';
import { 
  Check, 
  Clock, 
  X, 
  AlertTriangle, 
  Ban, 
  Building2, 
  CreditCard,
  Truck,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

export const TRACKING_STAGES = [
  { key: 'requested', label: 'Requested', desc: 'Requisition submitted' },
  { key: 'accepted', label: 'Accepted', desc: 'Seller accepted & stock reserved' },
  { key: 'paid', label: 'Paid', desc: 'Settlement escrow secured' },
  { key: 'preparing', label: 'Preparing', desc: 'Cold-chain packaging' },
  { key: 'dispatched', label: 'Dispatched', desc: 'Consignment handed to carrier' },
  { key: 'in transit', label: 'In Transit', desc: 'Active IoT temperature telemetry' },
  { key: 'delivered', label: 'Delivered', desc: 'Dock intake verified' },
  { key: 'completed', label: 'Completed', desc: 'Ledger & inventory synchronized' },
];

export const getStageIndex = (status) => {
  const s = (status || '').toLowerCase().trim();
  if (s === 'pending' || s === 'requested' || s === 'reviewing') return 0;
  if (s === 'accepted' || s === 'approved') return 1;
  if (s === 'paid' || s === 'payment_completed') return 2;
  if (s === 'preparing' || s === 'processing' || s === 'packed') return 3;
  if (s === 'dispatched' || s === 'shipped') return 4;
  if (s === 'in transit' || s === 'in_transit' || s === 'transit') return 5;
  if (s === 'delivered' || s === 'received') return 6;
  if (s === 'completed' || s === 'fulfilled') return 7;
  return -1; // -1 for rejected, cancelled, insufficient_stock, etc.
};

export const OrderMilestoneTracker = ({
  status = '',
  paymentStatus = '',
  cancellation = null,
  rejectReason = '',
  rejectedBy = '',
  rejectedAt = '',
  discrepancy = null,
  hasDiscrepancy = false,
  className = '',
}) => {
  const normStatus = (status || '').toLowerCase().trim();
  const isRejected = normStatus === 'rejected';
  const isCancelled = normStatus === 'cancelled' || normStatus === 'cancelled by buyer' || !!cancellation;
  const isInsufficientStock = normStatus === 'insufficient_stock' || normStatus === 'insufficient stock';

  const stageIdx = getStageIndex(normStatus);
  const currentStageNum = Math.max(1, stageIdx + 1);
  const currentStageObj = TRACKING_STAGES[stageIdx] || TRACKING_STAGES[0];

  // 1. REJECTED STATE TRACKER (Section 22)
  if (isRejected) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between text-xs font-mono font-bold text-rose-800 pb-1 border-b border-rose-100">
          <span className="uppercase tracking-wider">Tracking Milestone Progress:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            Order Formally Declined
          </span>
        </div>

        {/* 2-node rejected visualization */}
        <div className="relative py-4 px-2 bg-rose-50/50 rounded-2xl border border-rose-100">
          <div className="flex items-center justify-around relative">
            <div className="absolute top-1/2 left-1/4 right-1/4 -translate-y-1/2 h-1 bg-rose-200 z-0" />

            {/* Node 1: Requested (Completed) */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-bold ring-4 ring-emerald-100 shadow-sm">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-bold text-slate-800 mt-2">Requested</span>
              <span className="text-[10px] text-slate-400 font-mono">Stage 1</span>
            </div>

            {/* Node 2: Rejected (Terminal) */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center font-mono font-bold ring-4 ring-rose-200 shadow-md">
                <X className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-bold text-rose-700 mt-2">Rejected</span>
              <span className="text-[10px] text-rose-500 font-mono">Terminal</span>
            </div>
          </div>
        </div>

        {/* Detailed Rejection Dossier Box */}
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-bold text-sm text-rose-900 flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-rose-600" />
              Requisition Declined by Providing Hospital
            </span>
            <span className="font-mono text-[11px] text-rose-600">
              {rejectedAt ? new Date(rejectedAt).toLocaleString() : 'Audited Milestone'}
            </span>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-rose-100 text-slate-700 space-y-1">
            <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Decline Justification:</div>
            <p className="font-medium text-slate-800">
              {rejectReason || 'Stock reserved for acute inpatient surgical unit priority.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[11px] text-slate-600 border-t border-rose-200/60">
            <span>Rejected by: <strong className="text-slate-800">{rejectedBy || 'Providing Hospital'}</strong></span>
            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
              Payment: Not Required
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. CANCELLED STATE TRACKER (Section 23, 24)
  if (isCancelled) {
    const cancelDetails = cancellation || {};
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-600 pb-1 border-b border-slate-100">
          <span className="uppercase tracking-wider">Tracking Milestone Progress:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
            Order Cancelled
          </span>
        </div>

        {/* Cancelled Alert & Refund Details */}
        <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-950 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900">
                  Cancelled by {cancelDetails.cancelledByHospitalName || 'Buyer'}
                </div>
                <div className="text-[11px] text-rose-700">
                  Reason: <strong className="text-slate-800">{cancelDetails.reason || 'Requirement revised'}</strong>
                </div>
              </div>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              {cancelDetails.cancelledAt ? new Date(cancelDetails.cancelledAt).toLocaleString() : ''}
            </span>
          </div>

          {cancelDetails.note && (
            <p className="text-[11px] text-slate-600 italic bg-white/80 p-2.5 rounded-xl border border-rose-100">
              "{cancelDetails.note}"
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-rose-200/60 font-mono text-[11px]">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Window / Stage</span>
              <span className="font-bold text-slate-800">{cancelDetails.stageLabel || 'Within 24h'}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Cancellation Fee</span>
              <span className="font-bold text-amber-800">
                ₹{(cancelDetails.penaltyAmount || cancelDetails.feeAmount || 0).toLocaleString()} ({cancelDetails.penaltyPercent || cancelDetails.feePercent || 0}%)
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Escrow Refund</span>
              <span className="font-bold text-emerald-700">
                ₹{(cancelDetails.refundAmount || 0).toLocaleString()} ({cancelDetails.refundPercent || 100}%)
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase">Refund Status</span>
              <span className="font-bold text-purple-700">{cancelDetails.refundStatus || 'Demo Escrow Processed'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. INSUFFICIENT STOCK EXCEPTION (Section 32)
  if (isInsufficientStock) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-800 pb-1 border-b border-amber-100">
          <span className="uppercase tracking-wider">Tracking Milestone Progress:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
            Stock Depleted Alert
          </span>
        </div>
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Insufficient Stock Available for Fulfillment</span>
          </div>
          <p className="text-amber-800">
            Stock balance depleted at providing hospital prior to fulfillment dispatch. Requisition cannot be completed. 
            Alert flagged to procurement supervision. No inventory deduction or funds transferred.
          </p>
        </div>
      </div>
    );
  }

  // 4. NORMAL 8-STAGE LIFECYCLE (Section 10, 18, 19, 20)
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with Stage X of 8: Label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs font-mono">
        <span className="font-bold uppercase tracking-wider text-slate-500">
          Tracking Milestone Progress:
        </span>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200/80 font-bold text-xs shadow-2xs">
            Stage {currentStageNum} of 8: {currentStageObj.label}
          </span>
        </div>
      </div>

      {/* Desktop Horizontal 8-Stage Tracker */}
      <div className="hidden md:block py-3 px-2">
        <div className="relative">
          {/* Background Gray Line */}
          <div className="absolute top-4 left-4 right-4 -translate-y-1/2 h-1 bg-slate-200 z-0 rounded-full" />

          {/* Active Filled Progress Line */}
          <div
            className="absolute top-4 left-4 -translate-y-1/2 h-1 bg-teal-600 transition-all duration-500 z-0 rounded-full"
            style={{
              width: `${(Math.max(0, stageIdx) / 7) * 100}%`,
              maxWidth: 'calc(100% - 32px)'
            }}
          />

          {/* 8 Horizontal Nodes */}
          <div className="flex items-start justify-between relative z-10">
            {TRACKING_STAGES.map((st, idx) => {
              const isCompleted = idx < stageIdx;
              const isCurrent = idx === stageIdx;
              const isUpcoming = idx > stageIdx;

              return (
                <div key={st.key} className="flex flex-col items-center text-center max-w-[84px]">
                  {/* Indicator Circle */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white shadow-sm ring-4 ring-emerald-100'
                        : isCurrent
                        ? 'bg-teal-700 text-white shadow-md ring-4 ring-teal-100 scale-110'
                        : 'bg-white border-2 border-slate-300 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-white stroke-[3]" />
                    ) : isCurrent ? (
                      <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Stage Label */}
                  <span
                    className={`text-xs font-mono mt-2 leading-tight ${
                      isCurrent
                        ? 'font-black text-teal-900'
                        : isCompleted
                        ? 'font-bold text-slate-800'
                        : 'text-slate-400 font-medium'
                    }`}
                  >
                    {st.label}
                  </span>

                  {/* Micro Description */}
                  <span className="text-[9px] text-slate-400 font-sans mt-0.5 leading-tight hidden lg:block">
                    {st.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Responsive Mobile / Tablet Grid View (Section 20) */}
      <div className="block md:hidden space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TRACKING_STAGES.map((st, idx) => {
            const isCompleted = idx < stageIdx;
            const isCurrent = idx === stageIdx;
            const isUpcoming = idx > stageIdx;

            return (
              <div
                key={st.key}
                className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                  isCurrent
                    ? 'bg-teal-50/80 border-teal-300 ring-2 ring-teal-200'
                    : isCompleted
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-teal-700 text-white'
                      : 'bg-white border border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : isCurrent ? (
                    <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className={`text-xs font-mono truncate ${
                    isCurrent ? 'font-black text-teal-900' : isCompleted ? 'font-bold text-slate-800' : 'text-slate-500'
                  }`}>
                    {st.label}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {isCurrent ? 'Current' : isCompleted ? 'Passed' : 'Upcoming'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Discrepancy Alert Banner if present (Section 31) */}
      {(hasDiscrepancy || discrepancy) && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block text-rose-950">
              ⚠ Quantity / Quality Discrepancy Logged
            </span>
            <p className="text-[11px] text-rose-800 leading-relaxed">
              {discrepancy || 'Consignment flagged with a quantity discrepancy or temperature violation upon receiving dock inspection. Available for Admin audit review.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderMilestoneTracker;
