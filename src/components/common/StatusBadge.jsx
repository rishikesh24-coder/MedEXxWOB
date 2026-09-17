import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, MinusCircle, Radio, Check, X, AlertCircle, Trash2, ShieldCheck } from 'lucide-react';

export const StatusBadge = ({ status, className = '', showIcon = true }) => {
  if (!status) return null;

  const normalized = status.toLowerCase().trim();

  // GREEN: available / verified / accepted / paid / delivered / success / certified / healthy / active / in stock / completed
  if (['available', 'verified', 'accepted', 'paid', 'delivered', 'success', 'incinerated & certified', 'certified', 'healthy', 'active stock', 'active', 'in stock', 'in_stock', 'completed'].includes(normalized)) {
    let displayLabel = status;
    if (normalized === 'healthy' || normalized === 'active') displayLabel = 'Available';
    if (normalized === 'in_stock' || normalized === 'in stock') displayLabel = 'In Stock';
    if (normalized === 'paid') displayLabel = 'Paid';
    if (normalized === 'completed') displayLabel = 'Completed';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${className}`}>
        {showIcon && <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />}
        <span className="capitalize">{displayLabel}</span>
      </span>
    );
  }

  // PURPLE/SLATE: disposed / incinerated / bio-destroyed / refunded
  if (['disposed', 'incinerated', 'bio-destroyed', 'destroyed', 'refunded'].includes(normalized)) {
    let displayLabel = status;
    if (normalized === 'refunded') displayLabel = 'Refunded';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/80 ${className}`}>
        {showIcon && <Trash2 className="w-3.5 h-3.5 text-purple-600 stroke-[2.2]" />}
        <span className="capitalize">{displayLabel}</span>
      </span>
    );
  }

  // BLUE/CYAN: in progress / ordered / pickup scheduled / under review / in transit / preparing / dispatched / shipped
  if (['ordered', 'in transit', 'in_transit', 'under_review', 'under review', 'pickup scheduled', 'pickup_scheduled', 'preparing', 'dispatched', 'shipped', 'processing'].includes(normalized)) {
    let displayLabel = status;
    if (normalized === 'preparing') displayLabel = 'Preparing';
    if (normalized === 'dispatched' || normalized === 'shipped') displayLabel = 'Dispatched';
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 ${className}`}>
        {showIcon && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
        <span className="capitalize">{displayLabel}</span>
      </span>
    );
  }

  // AMBER/ORANGE: disposal requested / pending disposal / near expiry / expiring soon / low stock / attention / payment pending / requested / pending approval
  if (['requested', 'disposal requested', 'disposal_requested', 'pending_disposal', 'pending disposal', 'expiring soon', 'expiring_soon', 'near expiry', 'near-expiry', 'low stock', 'low-stock', 'low_stock', 'pending', 'pending_approval', 'pending approval', 'pending admin approval', 'payment pending', 'payment_pending', 'reported', 'quarantine', 'in transit to bio-centre', 'documents_missing', 'documents missing'].includes(normalized)) {
    let displayLabel = status;
    if (normalized === 'pending' || normalized === 'pending_approval' || normalized === 'pending approval') displayLabel = 'Pending Approval';
    if (normalized === 'pending admin approval') displayLabel = 'Pending Admin Approval';
    if (normalized === 'requested') displayLabel = 'Requested';
    if (normalized === 'near-expiry' || normalized === 'near expiry') displayLabel = 'Expiring Soon';
    if (normalized === 'low-stock' || normalized === 'low_stock') displayLabel = 'Low Stock';
    if (normalized === 'pending_disposal') displayLabel = 'Disposal Requested';
    if (normalized === 'payment pending' || normalized === 'payment_pending') displayLabel = 'Payment Pending';

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/90 ${className}`}>
        {showIcon && <AlertCircle className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />}
        <span className="capitalize">{displayLabel}</span>
      </span>
    );
  }

  // RED: expired / critical / out of stock / rejected / failed / payment failed / cancelled / suspended / discrepancy / insufficient stock
  if (['expired', 'critical', 'critical expiry', 'out of stock', 'out_of_stock', 'rejected', 'failed', 'payment failed', 'payment_failed', 'cancelled', 'cancelled by buyer', 'suspended', 'discrepancy', 'insufficient stock', 'insufficient_stock'].includes(normalized)) {
    let displayLabel = status;
    if (normalized === 'critical') displayLabel = 'Critical Expiry';
    if (normalized === 'out_of_stock' || normalized === 'out of stock') displayLabel = 'Out of Stock';
    if (normalized === 'expired') displayLabel = 'Expired';
    if (normalized === 'payment failed' || normalized === 'payment_failed') displayLabel = 'Payment Failed';
    if (normalized === 'cancelled by buyer') displayLabel = 'Cancelled';
    if (normalized === 'discrepancy') displayLabel = 'Discrepancy';
    if (normalized === 'insufficient stock' || normalized === 'insufficient_stock') displayLabel = 'Insufficient Stock';

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80 ${className}`}>
        {showIcon && <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />}
        <span className="capitalize">{displayLabel}</span>
      </span>
    );
  }

  // GRAY: inactive / default
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
      {showIcon && <MinusCircle className="w-3 h-3 text-slate-400" />}
      <span className="capitalize">{status}</span>
    </span>
  );
};

export default StatusBadge;

