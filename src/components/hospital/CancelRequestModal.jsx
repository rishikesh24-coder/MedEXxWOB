import React, { useState, useMemo } from 'react';
import Modal from '../common/Modal';
import { 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  Clock, 
  ShieldAlert, 
  ArrowRight, 
  Info,
  DollarSign
} from 'lucide-react';
import { getCancellationPolicy, calculateRefundAmounts } from '../../utils/cancellationPolicy';
import { hospitalService } from '../../services/hospitalService';

const REASON_OPTIONS = [
  { value: 'No longer required', label: 'No longer required for active inpatient care' },
  { value: 'Received stock from another supplier', label: 'Received stock from alternative vendor/supplier' },
  { value: 'Received stock from own pharmacy', label: 'Received stock from own internal pharmacy stores' },
  { value: 'Duplicate request', label: 'Accidental duplicate requisition' },
  { value: 'Quantity no longer required', label: 'Clinical dosage requirements reduced' },
  { value: 'Other', label: 'Other operational reason (specify below)' },
];

export const CancelRequestModal = ({ isOpen, onClose, request, onConfirmCancel }) => {
  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0].value);
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverPolicy, setServerPolicy] = useState(null);

  React.useEffect(() => {
    let isMounted = true;
    if (request?.id) {
      hospitalService.getRequestCancellationPolicy(request.id)
        .then((res) => {
          if (isMounted && res) {
            setServerPolicy(res);
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [request?.id]);

  const policy = useMemo(() => {
    if (serverPolicy) return serverPolicy;
    return getCancellationPolicy(request);
  }, [request, serverPolicy]);

  const amounts = useMemo(() => {
    return calculateRefundAmounts(request, policy);
  }, [request, policy]);

  if (!request) return null;

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const finalReason = selectedReason === 'Other' && customNote.trim() 
        ? `Other: ${customNote.trim()}` 
        : selectedReason;

      await onConfirmCancel({
        requestId: request.id,
        reason: finalReason,
        note: customNote.trim(),
        policy,
        amounts,
      });
      onClose();
    } catch (err) {
      console.error('Cancellation failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && onClose()}
      title="Cancel Medicine Requisition?"
      subtitle={`Review applicable refund terms for TXN: ${request.transactionId || request.id}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5 pt-1 text-slate-800">

        {/* 1. Request Summary Strip */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                Target Compound
              </span>
              <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                {request.medicineName}
              </h4>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Providing Facility: <strong className="text-primary-700">{request.toHospitalName}</strong>
              </p>
            </div>

            <div className="text-right flex-shrink-0">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                Requisition Quantity
              </span>
              <span className="text-base font-black font-mono text-slate-900">
                {request.quantity} units
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Gross Requisition Value:</span>
            <span className="font-extrabold text-slate-900">₹{(amounts.totalAmount || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* 2. Refund & Deduction Breakdown Card */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-600 animate-pulse" />
              <span className="text-xs font-extrabold text-slate-900">
                Cancellation Window: {policy.stageLabel}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
              Demo Policy
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Cancellation Fee */}
            <div className={`p-3 rounded-xl border text-center space-y-0.5 ${
              policy.penaltyPercent > 0 
                ? 'bg-amber-50/70 border-amber-200 text-amber-900' 
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            }`}>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block opacity-75">
                Cancellation Fee ({policy.penaltyPercent}%)
              </span>
              <div className="text-lg font-mono font-black">
                ₹{(amounts.penaltyAmount || 0).toLocaleString()}
              </div>
              <span className="text-[10px] block opacity-80">
                {policy.penaltyPercent === 0 ? '✓ Zero Penalty' : 'Restocking & Logistics'}
              </span>
            </div>

            {/* Estimated Refund */}
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 text-center space-y-0.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider block opacity-75">
                Estimated Refund ({policy.refundPercent}%)
              </span>
              <div className="text-lg font-mono font-black text-emerald-800">
                ₹{(amounts.refundAmount || 0).toLocaleString()}
              </div>
              <span className="text-[10px] block text-emerald-700 font-semibold">
                Simulated Escrow Credit
              </span>
            </div>
          </div>
        </div>

        {/* 3. Reason Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 font-mono block">
            Reason for Cancellation (Optional)
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all cursor-pointer"
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {selectedReason === 'Other' && (
            <textarea
              rows={2}
              placeholder="Provide a brief explanation for clinical records..."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              disabled={isSubmitting}
              className="w-full mt-2 rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-800 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          )}
        </div>

        {/* 4. Compact Policy Explanation Matrix */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-[11px] text-slate-600">
          <span className="font-extrabold uppercase font-mono text-[10px] text-slate-400 block tracking-wider">
            Standard Cancellation Policy Matrix
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 text-center font-mono text-[10px]">
            <div className={`p-1.5 rounded-lg border ${policy.stage === 'WITHIN_24H' ? 'bg-emerald-100/70 border-emerald-300 font-bold text-emerald-900' : 'bg-white border-slate-200'}`}>
              <div>Within 24h</div>
              <div className="text-emerald-700">0% fee • 100% refund</div>
            </div>
            <div className={`p-1.5 rounded-lg border ${policy.stage === 'AFTER_24H_BEFORE_DISPATCH' ? 'bg-amber-100/70 border-amber-300 font-bold text-amber-900' : 'bg-white border-slate-200'}`}>
              <div>&gt; 24h Pre-Dispatch</div>
              <div className="text-amber-700">5% fee • 95% refund</div>
            </div>
            <div className={`p-1.5 rounded-lg border ${policy.stage === 'DISPATCHED' ? 'bg-rose-100/70 border-rose-300 font-bold text-rose-900' : 'bg-white border-slate-200'}`}>
              <div>Dispatched</div>
              <div className="text-rose-700">15% fee • 85% refund</div>
            </div>
            <div className="p-1.5 rounded-lg border bg-slate-100 border-slate-200 text-slate-400">
              <div>Delivered</div>
              <div>Non-cancellable</div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-sans italic pt-1">
            * Cancellation and refund rules shown here are demo policy rules for this technical prototype.
          </p>
        </div>

        {/* 5. Modal Footer Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            Keep Requisition
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !policy.canCancel}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Confirm Cancellation</span>
              </>
            )}
          </button>
        </div>

      </div>
    </Modal>
  );
};

export default CancelRequestModal;
