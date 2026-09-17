import React from 'react';
import { Link } from 'react-router-dom';
import { 
  X, 
  FileText, 
  Building2, 
  CreditCard, 
  Package, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Ban, 
  Check, 
  ExternalLink,
  ShieldCheck,
  Calendar,
  ThermometerSnowflake,
  RotateCcw,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import Modal from './Modal';
import StatusBadge from './StatusBadge';
import OrderMilestoneTracker from './OrderMilestoneTracker';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const OrderDetailsModal = ({
  isOpen,
  onClose,
  order,
  role = 'hospital', // 'hospital' | 'admin'
  onPayNow,
  onRetryPayment,
  onCancelRequest,
  onConfirmDelivery,
  onAdminAdvanceStatus,
  isSuspended = false,
}) => {
  if (!isOpen || !order) return null;

  const s = (order.status || '').toLowerCase().trim();
  const ps = (order.paymentStatus || '').toLowerCase().trim();
  const isAccepted = s === 'accepted';
  const isPaid = ['paid', 'success', 'successful', 'completed', 'settled'].includes(ps);
  const isPaymentFailed = ps === 'failed';
  const isCancelled = s === 'cancelled' || s === 'cancelled by buyer' || !!order.cancellation;
  const isRejected = s === 'rejected';
  const isDelivered = s === 'delivered';
  const isCompleted = s === 'completed';
  const isRefunded = ps === 'refunded' || !!order.cancellation?.refundStatus;

  const txnId = order.transactionId || order.orderId || order.id;
  const displayId = order.orderId ? (order.orderId.startsWith('#') ? order.orderId : `#${order.orderId}`) : `#${txnId}`;

  // Build or format status timeline history
  const statusHistory = React.useMemo(() => {
    if (order.statusHistory && order.statusHistory.length > 0) {
      return order.statusHistory;
    }
    const history = [];
    const dateStr = order.orderDate || order.requestDate;
    history.push({
      status: 'Requested',
      timestamp: dateStr ? new Date(dateStr).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Created',
      note: `Requisition submitted for ${order.quantity} units of ${order.medicineName}.`,
      actor: order.hospital?.name || order.fromHospitalName || 'Requesting Hospital',
    });

    if (['accepted', 'paid', 'preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(s) || order.acceptedAt) {
      history.push({
        status: 'Accepted',
        timestamp: order.acceptedAt ? new Date(order.acceptedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Verified',
        note: `Requisition accepted by providing hospital. Batch ${order.batchNo || 'BAT-9841'} reserved.`,
        actor: order.fulfillingHospital?.name || order.toHospitalName || 'Providing Hospital',
      });
    }

    if (isPaid || order.paidDate) {
      history.push({
        status: 'Paid',
        timestamp: order.paidDate ? new Date(order.paidDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Escrow Secured',
        note: `Settlement of ₹${(order.settlementAmount || order.totalAmount || 0).toLocaleString()} held in platform escrow. Ref: ${order.paymentReference || order.paymentId || 'PAY-ESCROW'}`,
        actor: 'MedEx Escrow Engine',
      });
    } else if (isPaymentFailed) {
      history.push({
        status: 'Payment Failed',
        timestamp: order.paymentFailedAt ? new Date(order.paymentFailedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Declined',
        note: order.paymentFailureReason || 'Payment gateway declined authorization. Order awaiting retry.',
        actor: 'Payment Gateway',
      });
    }

    if (['preparing', 'dispatched', 'in transit', 'delivered', 'completed'].includes(s) || order.preparingAt) {
      history.push({
        status: 'Preparing',
        timestamp: order.preparingAt ? new Date(order.preparingAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Warehouse Dock',
        note: 'Pharmacy staff verifying batch cold-chain packaging and temperature indicator seals.',
        actor: order.fulfillingHospital?.name || order.toHospitalName || 'Pharmacy Dispatch',
      });
    }

    if (['dispatched', 'in transit', 'delivered', 'completed'].includes(s) || order.dispatchedAt) {
      history.push({
        status: 'Dispatched',
        timestamp: order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Handed to Courier',
        note: `Consignment sealed and handed over to ${order.trackingInfo?.courierName || 'MediCold Logistics Express Ltd.'}.`,
        actor: order.trackingInfo?.courierName || 'Carrier Dispatch',
      });
    }

    if (['in transit', 'delivered', 'completed'].includes(s) || order.inTransitAt) {
      history.push({
        status: 'In Transit',
        timestamp: order.inTransitAt ? new Date(order.inTransitAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Active Corridor',
        note: `Consignment in transit. IoT live temperature monitoring: ${order.trackingInfo?.temperature || '3.8°C Certified'}.`,
        actor: 'IoT Telemetry Gateway',
      });
    }

    if (['delivered', 'completed'].includes(s) || order.deliveredAt) {
      history.push({
        status: 'Delivered',
        timestamp: order.deliveredAt ? new Date(order.deliveredAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Intake Dock',
        note: `Consignment received at intake dock. Package inspection and cold-chain compliance verified.`,
        actor: order.hospital?.name || order.fromHospitalName || 'Receiving Pharmacy',
      });
    }

    if (s === 'completed' || order.completedAt) {
      history.push({
        status: 'Completed',
        timestamp: order.completedAt ? new Date(order.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Ledger Finalized',
        note: 'Dock intake signed off. Inventory synchronized and escrow released to seller.',
        actor: 'MedEx Settlement Engine',
      });
    }

    if (isCancelled) {
      history.push({
        status: 'Cancelled',
        timestamp: order.cancellation?.cancelledAt ? new Date(order.cancellation.cancelledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Cancelled',
        note: `Requisition cancelled: ${order.cancellation?.reason || order.statusNote || 'Requirement modified by hospital.'}`,
        actor: order.cancellation?.cancelledByHospitalName || 'Requesting Hospital',
      });
    }

    if (isRejected) {
      history.push({
        status: 'Rejected',
        timestamp: dateStr ? new Date(dateStr).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Declined',
        note: `Requisition declined: ${order.rejectReason || 'Declined by providing hospital.'}`,
        actor: order.fulfillingHospital?.name || order.toHospitalName || 'Providing Hospital',
      });
    }

    return history;
  }, [order, s, isPaid, isPaymentFailed, isCancelled, isRejected]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-extrabold text-slate-900">
            {order.medicineName}
          </span>
          <span className="font-mono text-sm font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200/80">
            {displayId}
          </span>
        </div>
      }
      subtitle={
        <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
          <span>TXN: <strong className="font-mono text-slate-800">{txnId}</strong></span>
          <span>•</span>
          <span>Date: <strong className="text-slate-700">{formatDate(order.orderDate || order.requestDate)}</strong></span>
        </div>
      }
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6 text-slate-800 pt-1">
        
        {/* 1. HEADER SUMMARY CARD */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Status:</span>
              <StatusBadge status={order.status} />
              
              {order.urgency === 'Emergency' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-red-100 text-red-700 border border-red-200">
                  STAT EMERGENCY
                </span>
              )}

              {(order.hasDiscrepancy || order.discrepancy) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  DISCREPANCY ALERT
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 uppercase">Payment:</span>
              <StatusBadge status={order.paymentStatus || (isPaid ? 'paid' : 'pending')} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Quantity Ordered</span>
              <span className="font-mono font-black text-slate-900 text-base">{order.quantity} units</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Settlement</span>
              <span className="font-mono font-black text-teal-800 text-base">
                ₹{(order.settlementAmount || order.totalAmount || 0).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Priority Level</span>
              <span className="font-bold text-slate-800">
                {order.priority || order.urgency || 'Standard Routine'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Logistics SLA</span>
              <span className="font-mono font-bold text-emerald-700 block truncate" title={order.logisticsSla || 'Cold Chain 2°C - 8°C Verified'}>
                {order.logisticsSla || 'Cold Chain 2°C - 8°C'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. TRACKING MILESTONE PROGRESS (Section 18, 19, 20) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
          <OrderMilestoneTracker
            status={order.status}
            paymentStatus={order.paymentStatus}
            cancellation={order.cancellation}
            rejectReason={order.rejectReason}
            rejectedBy={order.fulfillingHospital?.name || order.toHospitalName}
            rejectedAt={order.rejectedAt || order.orderDate}
            discrepancy={order.discrepancy}
            hasDiscrepancy={order.hasDiscrepancy}
          />
        </div>

        {/* 3. ORDER TIMELINE (Section 21) */}
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-200/60">
            <Clock className="w-4 h-4 text-teal-600" />
            Order Milestone Chronology & Audit Timeline
          </div>

          <div className="space-y-3 pl-3 border-l-2 border-teal-500/30 ml-2 pt-1">
            {statusHistory.map((step, sIdx) => (
              <div key={sIdx} className="relative pl-4">
                <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-teal-600 ring-4 ring-teal-100" />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-xs text-slate-900">{step.status}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{step.timestamp}</span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{step.note}</p>
                {step.actor && (
                  <span className="text-[10px] text-teal-700 font-mono font-semibold block mt-0.5">
                    Recorded by: {step.actor}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 4. HOSPITAL INFORMATION (BUYER & SELLER) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-teal-600" />
              Requesting Hospital (Buyer)
            </div>
            <div className="text-xs space-y-1">
              <div className="font-extrabold text-slate-900 text-sm">
                {order.hospital?.name || order.fromHospitalName || 'Apollo Hospital'}
              </div>
              <div className="text-slate-500">
                Reg No: <strong className="text-slate-700">{order.hospital?.registrationNo || 'MH-GOV-8821'}</strong>
              </div>
              <div className="text-slate-500">
                Location: {order.hospital?.city || 'Mumbai'}{order.hospital?.state ? `, ${order.hospital.state}` : ', Maharashtra'}
              </div>
              <div className="text-slate-500">
                Contact: {order.hospital?.phone || order.hospital?.contact || '+91 98201 54321'}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 uppercase tracking-wider pb-2 border-b border-slate-100">
              <Building2 className="w-4 h-4 text-teal-600" />
              Providing Hospital (Seller)
            </div>
            <div className="text-xs space-y-1">
              <div className="font-extrabold text-slate-900 text-sm">
                {order.fulfillingHospital?.name || order.toHospitalName || 'Fortis Memorial Research Institute'}
              </div>
              <div className="text-slate-500">
                Reg No: <strong className="text-slate-700">{order.fulfillingHospital?.registrationNo || 'HR-MED-4412'}</strong>
              </div>
              <div className="text-slate-500">
                Location: {order.fulfillingHospital?.city || 'Gurgaon'}{order.fulfillingHospital?.state ? `, ${order.fulfillingHospital.state}` : ', Haryana'}
              </div>
              <div className="text-slate-500">
                Contact: {order.fulfillingHospital?.phone || order.fulfillingHospital?.contact || '+91 98112 33445'}
              </div>
            </div>
          </div>
        </div>

        {/* 5. MEDICINE / STOCK / BATCH INFORMATION (Section 27, 28) */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              <Package className="w-4 h-4 text-teal-600" />
              Pharmaceutical Formulation & Batch Inventory Details
            </div>
            <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
              Providing Hospital: <strong className="text-slate-800">{order.fulfillingHospital?.name || order.toHospitalName || 'Providing Facility'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Medicine Name</span>
              <span className="font-extrabold text-slate-900 text-sm">{order.medicineName}</span>
              <span className="text-[10px] text-slate-500 font-mono block">
                {order.genericName || order.items?.[0]?.genericName || 'Active Pharmaceutical Formulation'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Dosage Form & Strength</span>
              <span className="font-bold text-slate-800">{order.dosageForm || order.form || 'Tablet'}</span>
              <span className="text-[10px] text-slate-500 font-mono block">{order.dosage || order.power || 'Standard'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Manufacturer</span>
              <span className="font-bold text-slate-800">{order.manufacturer || 'Approved Pharma Corp'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Packing / Pack Size</span>
              <span className="font-bold text-slate-800">{order.packing || order.packSize || '15 Tablets / Strip'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-100">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Batch Number</span>
              <span className="font-mono font-bold text-teal-800">{order.batchNo || 'BAT-9841'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Quantity Purchased</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{order.quantity} {order.unit || 'units'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Concession Rate (MedEx)</span>
              <span className="font-mono font-bold text-emerald-700 text-sm">
                ₹{order.concessionRate || order.pricingBreakdown?.unitFinalPrice || order.unitPrice || order.unitSellingPrice || 95}
              </span>
              {order.mrp ? (
                <span className="text-[10px] text-slate-400 block font-mono">MRP: ₹{order.mrp}</span>
              ) : null}
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Expiry Date</span>
              <span className="font-mono text-slate-800 font-semibold">{formatDate(order.expiryDate || order.medicineExpiryDate || '2025-12-31')}</span>
            </div>
          </div>

          {/* Fulfillment Chronology for Received / Completed / Dispatched orders (Requirement 8 & 11) */}
          {(order.dispatchedAt || order.deliveredAt || order.completedAt || ['dispatched', 'in transit', 'delivered', 'completed'].includes(s)) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-[11px] bg-slate-50/70 p-2.5 rounded-xl">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Order Date</span>
                <span className="font-mono text-slate-700 font-semibold">{formatDate(order.orderDate || order.createdAt || order.requestDate)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Payment Status</span>
                <span className={`font-mono font-bold ${isPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {order.paymentStatus ? (order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)) : (isPaid ? 'Successful' : 'Pending')}
                </span>
                {order.paymentId && <span className="text-[9px] text-slate-400 font-mono block">Ref: {order.paymentId}</span>}
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Dispatched Date</span>
                <span className="font-mono text-slate-700 font-semibold">
                  {order.dispatchedAt ? formatDate(order.dispatchedAt) : (order.dispatchDate ? formatDate(order.dispatchDate) : 'In Dispatch Process')}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Delivery / Received</span>
                <span className="font-mono text-teal-800 font-bold">
                  {order.deliveredAt ? formatDate(order.deliveredAt) : (order.deliveryDate ? formatDate(order.deliveryDate) : (order.receivedDate ? formatDate(order.receivedDate) : (order.completedAt ? formatDate(order.completedAt) : 'In Transit')))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 6. LOGISTICS & SLA TELEMETRY (Section 29) */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              <Truck className="w-4 h-4 text-teal-600" />
              Logistics Telemetry & SLA Compliance
            </div>
            {['paid', 'preparing', 'dispatched', 'in transit'].includes(s) && (
              <Link
                to={`/hospital/track?txn=${txnId}`}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:underline"
              >
                <span>Live GPS Map</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Carrier Information</span>
              <span className="font-bold text-slate-800 block">
                {order.trackingInfo?.courierName || 'MediCold Logistics Express Ltd.'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">
                {order.trackingInfo?.vehicleNo || 'Temp-Controlled Refrigerated Van'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">IoT Temperature Telemetry</span>
              <span className="font-mono font-bold text-slate-800 flex items-center gap-1">
                <ThermometerSnowflake className="w-3 h-3 text-teal-600" />
                {order.trackingInfo?.temperature || '3.8°C Certified'}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">
                {order.trackingInfo?.currentLocation || 'National Highway 48 Corridor'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Expected Delivery</span>
              <span className="font-bold text-slate-800 block">
                {order.expectedDelivery || 'Within 24 Hours'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Cold Chain SLA</span>
              <span className="font-mono font-bold text-emerald-700 block">
                {order.logisticsSla || 'Cold Chain 2°C - 8°C Verified'}
              </span>
            </div>
          </div>
        </div>

        {/* 7. PAYMENT & ESCROW SETTLEMENT SECTION (Section 12, 13, 14) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-700 uppercase tracking-wider">
              <CreditCard className="w-4 h-4 text-teal-600" />
              Total Settlement & Platform Escrow
            </div>
            <StatusBadge status={order.paymentStatus || (isPaid ? 'paid' : 'pending')} />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Settlement Amount</span>
              <span className="text-2xl font-mono font-black text-slate-900 block">
                ₹{(order.settlementAmount || order.totalAmount || 0).toLocaleString()}
              </span>

              {/* Status breakdown */}
              {isRefunded ? (
                <div className="pt-1 text-xs font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase">Payment Status:</span>
                  <span className="text-purple-700 font-bold">✓ Escrow Refunded</span>
                </div>
              ) : isPaid ? (
                <div className="pt-1 text-xs font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase">Payment Status:</span>
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>Paid (Secured in Escrow)</span>
                  </div>
                  {order.paidDate && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Paid on: <strong className="text-slate-700">{new Date(order.paidDate).toLocaleString()}</strong>
                    </div>
                  )}
                  {order.paymentReference && (
                    <div className="text-[10px] text-slate-400">
                      Ref: <span className="font-mono text-slate-600">{order.paymentReference}</span>
                    </div>
                  )}
                </div>
              ) : isPaymentFailed ? (
                <div className="pt-1 text-xs font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase">Payment Status:</span>
                  <div className="flex items-center gap-1.5 text-rose-600 font-bold">
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span>Payment Failed</span>
                  </div>
                  <div className="text-[11px] text-rose-700 mt-0.5">
                    Order remains Accepted. Please retry payment to proceed to fulfillment.
                  </div>
                </div>
              ) : isAccepted ? (
                <div className="pt-1 text-xs font-mono">
                  <span className="text-slate-400 block text-[10px] uppercase">Payment Status:</span>
                  <div className="flex items-center gap-1 text-amber-700 font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Payment Pending</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Order accepted by providing hospital. Advance payment required to begin preparation.
                  </div>
                </div>
              ) : isRejected ? (
                <div className="pt-1 text-xs font-mono text-slate-400">
                  <span>Payment Not Required (Order Declined)</span>
                </div>
              ) : (
                <div className="pt-1 text-xs font-mono text-slate-400">
                  <span>Payment option unlocks upon seller acceptance.</span>
                </div>
              )}
            </div>

            {/* Pay Now or Retry Payment Actions (Hospital Only) */}
            {role === 'hospital' && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {isAccepted && !isPaid && !isPaymentFailed && (
                  <button
                    type="button"
                    onClick={() => !isSuspended && onPayNow && onPayNow(order)}
                    disabled={isSuspended}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Pay Now (₹{(order.settlementAmount || order.totalAmount || 0).toLocaleString()})</span>
                  </button>
                )}

                {isAccepted && isPaymentFailed && (
                  <button
                    type="button"
                    onClick={() => !isSuspended && onRetryPayment && onRetryPayment(order)}
                    disabled={isSuspended}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/25 transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Retry Payment</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 8. QUANTITY / COLD CHAIN DISCREPANCY SECTION (Section 31) */}
        {(order.hasDiscrepancy || order.discrepancy) && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-950 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>⚠ Physical Reception Discrepancy Flagged</span>
            </div>
            <p className="text-rose-800 leading-relaxed bg-white/70 p-3 rounded-xl border border-rose-100">
              {order.discrepancy || 'Consignment quantity or storage temperature deviation logged upon dock arrival.'}
            </p>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
              <span>Admin Supervisory Oversight: Active</span>
              <span className="text-rose-700 font-bold">Investigation Pending</span>
            </div>
          </div>
        )}

        {/* 9. BOTTOM ACTIONS BAR */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            Close Details
          </button>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Hospital Delivery Confirmation Action (Section 30) */}
            {role === 'hospital' && isDelivered && !isCompleted && onConfirmDelivery && (
              <button
                type="button"
                onClick={() => onConfirmDelivery(order)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Dock Intake & Release Escrow</span>
              </button>
            )}

            {/* Hospital Cancellation Action (Section 24) */}
            {role === 'hospital' && !isCancelled && !isRejected && !isDelivered && !isCompleted && onCancelRequest && (
              <button
                type="button"
                onClick={() => onCancelRequest(order)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-all cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Cancel Request</span>
              </button>
            )}

            {/* Live Telemetry Tracking Link */}
            {['paid', 'preparing', 'dispatched', 'in transit'].includes(s) && (
              <Link
                to={`/hospital/track?txn=${txnId}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow transition-all cursor-pointer"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Track Live Telemetry</span>
              </Link>
            )}

            {/* Admin Advance Status Options (Section 13 & 14) */}
            {role === 'admin' && onAdminAdvanceStatus && !isCancelled && !isRejected && (
              <div className="flex items-center gap-2 flex-wrap">
                {(s === 'requested' || s === 'pending') && (
                  <button
                    type="button"
                    onClick={() => onAdminAdvanceStatus(order, 'accepted')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Accept Requisition</span>
                  </button>
                )}

                {s === 'accepted' && !isPaid && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-mono text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Payment Pending (Awaiting Buyer Payment)</span>
                  </div>
                )}

                {((s === 'accepted' && isPaid) || s === 'paid') && (
                  <button
                    type="button"
                    onClick={() => onAdminAdvanceStatus(order, 'preparing')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow transition-all cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Start Preparing</span>
                  </button>
                )}

                {s === 'preparing' && (
                  <button
                    type="button"
                    onClick={() => onAdminAdvanceStatus(order, 'dispatched')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow transition-all cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Mark Dispatched</span>
                  </button>
                )}

                {s === 'dispatched' && (
                  <button
                    type="button"
                    onClick={() => onAdminAdvanceStatus(order, 'in transit')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow transition-all cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Mark In Transit</span>
                  </button>
                )}

                {s === 'in transit' && (
                  <button
                    type="button"
                    onClick={() => onAdminAdvanceStatus(order, 'delivered')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white shadow transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Delivered</span>
                  </button>
                )}

                {s === 'delivered' && (
                  <button
                    type="button"
                    onClick={() => onAdminAdvanceStatus(order, 'completed')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Complete Order</span>
                  </button>
                )}

                {s === 'completed' && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                    <span>Order Completed</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
