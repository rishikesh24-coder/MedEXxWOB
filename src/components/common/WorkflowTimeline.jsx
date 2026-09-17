import React from 'react';
import { CheckCircle2, Clock, XCircle, Circle, Ban, AlertTriangle, ShieldCheck } from 'lucide-react';

/**
 * WorkflowTimeline
 * 
 * Reusable visual timeline component for:
 * 1. Requisitions: PENDING -> ACCEPTED -> TRANSFERRED -> RECEIVED (or CANCELLED / REJECTED)
 * 2. Transfers: REQUEST APPROVED -> PREPARING -> DISPATCHED -> IN TRANSIT -> DELIVERED -> RECEIVED
 */
export const WorkflowTimeline = ({
  steps,
  currentStepIndex,
  type = 'request',
  currentStatus = '',
  timestamp = '',
  isRejected = false,
  rejectionReason = '',
  isCancelled = false,
  cancellationDetails = null,
  className = '',
}) => {
  // Determine default steps if not explicitly provided
  const activeSteps = React.useMemo(() => {
    if (steps && steps.length > 0) return steps;

    if (type === 'transfer') {
      return [
        { key: 'approved', label: 'Approved' },
        { key: 'preparing', label: 'Preparing' },
        { key: 'dispatched', label: 'Dispatched' },
        { key: 'in_transit', label: 'In Transit' },
        { key: 'received', label: 'Received' },
      ];
    }

    // Default: Requisition flow (Finalized 8-stage lifecycle)
    return [
      { key: 'requested', label: 'Requested' },
      { key: 'accepted', label: 'Accepted' },
      { key: 'paid', label: 'Paid' },
      { key: 'preparing', label: 'Preparing' },
      { key: 'dispatched', label: 'Dispatched' },
      { key: 'in_transit', label: 'In Transit' },
      { key: 'delivered', label: 'Delivered' },
      { key: 'completed', label: 'Completed' },
    ];
  }, [steps, type]);

  // Determine active step index from status if not explicitly given
  const activeIndex = React.useMemo(() => {
    if (typeof currentStepIndex === 'number') return currentStepIndex;

    const s = (currentStatus || '').toLowerCase().trim();
    if (s === 'pending' || s === 'requested' || s === 'reviewing') return 0;
    if (s === 'accepted' || s === 'approved') return 1;
    if (s === 'paid' || s === 'payment_completed') return 2;
    if (s === 'preparing' || s === 'processing' || s === 'packed') return 3;
    if (s === 'dispatched' || s === 'shipped') return 4;
    if (s === 'in transit' || s === 'in_transit' || s === 'transit') return 5;
    if (s === 'delivered' || s === 'received') return 6;
    if (s === 'completed' || s === 'fulfilled') return 7;
    if (s === 'cancelled' || s === 'rejected') return -1;
    return 0;
  }, [currentStepIndex, currentStatus]);

  const isOrderCancelled = isCancelled || (currentStatus || '').toLowerCase() === 'cancelled';
  const isOrderRejected = isRejected || (currentStatus || '').toLowerCase() === 'rejected';

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Horizontal Steps Strip */}
      <div className="flex items-center justify-between relative">
        {/* Background track bar */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-1 bg-slate-200 z-0" />
        
        {/* Filled active track */}
        {!isOrderRejected && !isOrderCancelled && (
          <div 
            className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-primary-600 transition-all duration-300 z-0"
            style={{ 
              width: activeSteps.length > 1 ? `${(activeIndex / (activeSteps.length - 1)) * 100}%` : '0%' 
            }}
          />
        )}

        {/* Cancelled track styling */}
        {isOrderCancelled && (
          <div 
            className="absolute top-1/2 left-0 -translate-y-1/2 h-1 bg-rose-400/80 dashed z-0"
            style={{ 
              width: activeSteps.length > 1 ? `${(Math.max(activeIndex, 0.5) / (activeSteps.length - 1)) * 100}%` : '25%' 
            }}
          />
        )}

        {/* Individual Step Nodes */}
        {activeSteps.map((step, idx) => {
          const isPassed = !isOrderRejected && !isOrderCancelled && idx < activeIndex;
          const isCurrent = !isOrderRejected && !isOrderCancelled && idx === activeIndex;
          const isCancelledNode = isOrderCancelled && idx === activeIndex;

          return (
            <div key={step.key || idx} className="relative z-10 flex flex-col items-center">
              {/* Circle / Icon */}
              <div 
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold transition-all ${
                  isCancelledNode
                    ? 'bg-rose-600 text-white shadow-md ring-2 sm:ring-4 ring-rose-100 scale-105'
                    : isPassed 
                    ? 'bg-emerald-600 text-white shadow-sm ring-1 sm:ring-2 ring-emerald-100'
                    : isCurrent
                    ? 'bg-primary-600 text-white shadow-md ring-2 sm:ring-4 ring-primary-100 scale-110'
                    : isOrderRejected && idx === activeIndex
                    ? 'bg-rose-600 text-white ring-2 sm:ring-4 ring-rose-100'
                    : 'bg-white border-2 border-slate-300 text-slate-400'
                }`}
              >
                {isCancelledNode ? (
                  <Ban className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" />
                ) : isPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                ) : isCurrent ? (
                  <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white animate-pulse" />
                ) : isOrderRejected && idx === activeIndex ? (
                  <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Label */}
              <span 
                className={`text-[8px] sm:text-[10px] font-mono tracking-tight mt-1 sm:mt-1.5 text-center leading-tight max-w-[44px] sm:max-w-none break-words sm:whitespace-nowrap ${
                  isCancelledNode
                    ? 'font-extrabold text-rose-700'
                    : isCurrent 
                    ? 'font-extrabold text-primary-800' 
                    : isPassed 
                    ? 'font-bold text-slate-700' 
                    : 'text-slate-400'
                }`}
              >
                {isCancelledNode ? 'Cancelled' : step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Cancellation Notice Banner */}
      {isOrderCancelled && (
        <div className="p-3 rounded-2xl bg-rose-50/80 border border-rose-200 text-xs text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Ban className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-rose-900 text-xs">
                  Requisition Cancelled by Buyer
                </span>
                {cancellationDetails?.tier && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-200/80 text-rose-900 uppercase">
                    Tier {cancellationDetails.tier}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Reason: <strong className="text-slate-900">{cancellationDetails?.reason || 'Buyer requirement changed'}</strong>
                {cancellationDetails?.note && ` • "${cancellationDetails.note}"`}
              </p>
            </div>
          </div>

          {cancellationDetails && (
            <div className="flex items-center gap-3 self-end sm:self-center font-mono text-[11px] bg-white/80 px-3 py-1.5 rounded-xl border border-rose-200/60 shadow-2xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Fee ({cancellationDetails.feePercent || 0}%)</span>
                <span className="font-bold text-rose-700">₹{Number(cancellationDetails.feeAmount || 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 text-[10px] block">Refund ({cancellationDetails.refundPercent || 100}%)</span>
                <span className="font-bold text-emerald-700">₹{Number(cancellationDetails.refundAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rejection Notice Banner if rejected */}
      {isOrderRejected && !isOrderCancelled && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Requisition Declined</span>
            <span className="text-[11px] text-rose-700">{rejectionReason || 'Declined by partner hospital.'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowTimeline;
