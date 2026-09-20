import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  CreditCard, 
  Download, 
  Search, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Copy, 
  Check, 
  Filter, 
  X, 
  Receipt, 
  Truck, 
  ExternalLink, 
  ShieldCheck, 
  Building2, 
  Calendar, 
  AlertCircle 
} from 'lucide-react';
import { fetchPaymentHistory } from '../../store/slices/hospitalSlice';
import StatusBadge from '../../components/common/StatusBadge';
import ReceiptModal from '../../components/common/ReceiptModal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import toast from 'react-hot-toast';

export const PaymentHistory = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { payments = [], isLoading } = useSelector((state) => state.hospital);
  const { user } = useSelector((state) => state.auth);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPaymentForDrawer, setSelectedPaymentForDrawer] = useState(null);
  const [receiptModalPayment, setReceiptModalPayment] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Alert Deep-Link & Pulse Highlighting
  const [highlightedId, setHighlightedId] = useState(null);
  const processedTargetRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchPaymentHistory(user.id));
    } else {
      dispatch(fetchPaymentHistory());
    }
  }, [dispatch, user?.id]);

  // Alert Deep-Link Target Resolution Effect
  useEffect(() => {
    if (isLoading || !payments || payments.length === 0) return;

    const targetPaymentId = searchParams.get('paymentId') || searchParams.get('id') || searchParams.get('transactionId') || location.state?.alertTarget?.paymentId;
    const targetReqId = searchParams.get('requestId') || searchParams.get('orderId') || location.state?.alertTarget?.requestId;

    if (!targetPaymentId && !targetReqId) return;

    const targetSig = `${targetPaymentId || ''}__${targetReqId || ''}`;
    if (processedTargetRef.current === targetSig) return;
    processedTargetRef.current = targetSig;

    const cleanParams = () => {
      try {
        const next = new URLSearchParams(searchParams);
        next.delete('paymentId');
        next.delete('id');
        next.delete('transactionId');
        next.delete('requestId');
        next.delete('orderId');
        setSearchParams(next, { replace: true });
        if (location.state?.alertTarget) {
          navigate(location.pathname + (next.toString() ? `?${next.toString()}` : ''), {
            replace: true,
            state: {},
          });
        }
      } catch (e) {
        console.warn('Failed to clean target search params', e);
      }
    };

    let matched = null;
    if (targetPaymentId) {
      matched = payments.find((p) => p.id === targetPaymentId || p.transactionId === targetPaymentId || p.razorpayPaymentId === targetPaymentId);
    }
    if (!matched && targetReqId) {
      matched = payments.find((p) => p.requestId === targetReqId || p.orderId === targetReqId || p.transactionId === targetReqId);
    }

    if (matched) {
      setStatusFilter('ALL');
      setSearchTerm('');
      const pId = matched.id || matched.transactionId;
      setHighlightedId(pId);
      setSelectedPaymentForDrawer(matched);
      toast.success(`Focused on payment ${matched.transactionId || matched.id}`, { icon: '💳', id: 'pay-inspect-toast' });

      let attempts = 0;
      const scrollTimer = setInterval(() => {
        attempts++;
        const targetEl = document.getElementById(`payment-row-${pId}`) || document.getElementById(`payment-card-${pId}`);
        if (targetEl) {
          clearInterval(scrollTimer);
          targetEl.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        } else if (attempts > 30) {
          clearInterval(scrollTimer);
        }
      }, 75);

      const fadeTimer = setTimeout(() => {
        setHighlightedId(null);
      }, 4200);

      cleanParams();
      return () => {
        clearInterval(scrollTimer);
        clearTimeout(fadeTimer);
      };
    }

    toast.error('Original payment record is no longer available.', {
      icon: '⚠️',
      duration: 4000,
      id: 'pay-missing-toast',
    });
    cleanParams();
  }, [payments, isLoading, searchParams, location.state]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Transaction ID copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Summary Metrics (Beginner-Friendly: No complex charts)
  const metrics = useMemo(() => {
    let totalPaid = 0;
    let successfulCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    payments.forEach((p) => {
      const amt = Number(p.totalPaid) || Number(p.amount) || 0;
      const s = (p.paymentStatus || '').toUpperCase();
      if (s === 'SUCCESS' || s === 'PAID' || s === 'SETTLED') {
        totalPaid += amt;
        successfulCount++;
      } else if (s === 'PENDING' || s === 'INITIATED') {
        pendingCount++;
      } else if (s === 'FAILED' || s === 'DECLINED' || s === 'REFUNDED') {
        failedCount++;
      } else {
        successfulCount++;
        totalPaid += amt;
      }
    });

    return { totalPaid, successfulCount, pendingCount, failedCount };
  }, [payments]);

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (p.transactionId || '').toLowerCase().includes(q) ||
        (p.medicineName || '').toLowerCase().includes(q) ||
        (p.buyerHospital && p.buyerHospital.toLowerCase().includes(q)) ||
        (p.sellerHospital && p.sellerHospital.toLowerCase().includes(q)) ||
        (p.razorpayPaymentId && p.razorpayPaymentId.toLowerCase().includes(q));

      const s = (p.paymentStatus || '').toUpperCase();
      let matchesStatus = true;
      if (statusFilter === 'SUCCESS') {
        matchesStatus = s === 'SUCCESS' || s === 'PAID' || s === 'SETTLED';
      } else if (statusFilter === 'PENDING') {
        matchesStatus = s === 'PENDING' || s === 'INITIATED';
      } else if (statusFilter === 'FAILED') {
        matchesStatus = s === 'FAILED' || s === 'DECLINED';
      }

      return matchesSearch && matchesStatus;
    });
  }, [payments, searchTerm, statusFilter]);

  const handleExportCsv = () => {
    if (filteredPayments.length === 0) {
      toast.error('No payments to export');
      return;
    }
    const headers = ['Transaction ID', 'Medicine', 'Quantity', 'Amount (INR)', 'GST', 'Total Paid', 'Status', 'Date', 'Seller Hospital', 'Buyer Hospital'];
    const rows = filteredPayments.map((p) => [
      `"${p.transactionId}"`,
      `"${p.medicineName}"`,
      p.quantity,
      p.amount || 0,
      p.gstAmount || 0,
      p.totalPaid || p.amount || 0,
      `"${p.paymentStatus}"`,
      `"${p.date}"`,
      `"${p.sellerHospital || 'N/A'}"`,
      `"${p.buyerHospital || 'N/A'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MedEx_Payments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredPayments.length} payment records`);
  };

  return (
    <div className="space-y-7 pb-10">
      
      {/* 1. Header (WHERE AM I? + WHAT CAN I DO NEXT?) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Payment History
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            View medicine purchases, payment status and transaction details.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* 2. PAYMENT SUMMARY (4 Cards - No Complicated Analytics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total Paid */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Paid
          </span>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{metrics.totalPaid.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Total settled expenditure
          </p>
        </div>

        {/* Card 2: Successful Payments */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
            Successful Payments
          </span>
          <div className="text-2xl font-black text-emerald-700 font-mono">
            {metrics.successfulCount}
          </div>
          <p className="text-[11px] text-emerald-600 font-medium">
            Completed transactions
          </p>
        </div>

        {/* Card 3: Pending */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/90 bg-amber-50/25 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
            Pending
          </span>
          <div className="text-2xl font-black text-amber-700 font-mono">
            {metrics.pendingCount}
          </div>
          <p className="text-[11px] text-amber-700 font-medium">
            Awaiting bank processing
          </p>
        </div>

        {/* Card 4: Failed */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/90 bg-rose-50/25 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
            Failed
          </span>
          <div className="text-2xl font-black text-rose-700 font-mono">
            {metrics.failedCount}
          </div>
          <p className="text-[11px] text-rose-600 font-medium">
            Declined or refunded
          </p>
        </div>

      </div>

      {/* 3. SEARCH & FILTERS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transaction ID, medicine, hospital..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-full sm:w-56">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-bold text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="SUCCESS">✓ Successful / Paid</option>
              <option value="PENDING">● Pending</option>
              <option value="FAILED">✕ Failed / Declined</option>
            </select>
          </div>

        </div>

        <div className="text-xs text-slate-400 font-medium px-1 flex items-center justify-between">
          <span>{filteredPayments.length} transactions found</span>
          <span className="font-mono text-[11px] text-slate-500">12% Healthcare GST Itemized</span>
        </div>
      </div>

      {/* 4. PAYMENT LIST (Desktop Table & Mobile Cards) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading && payments.length === 0 ? (
          <div className="p-12 text-center">
            <LoadingSpinner text="Loading payment records..." />
          </div>
        ) : filteredPayments.length === 0 ? (
          payments.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No payment records found"
              description="Your medicine purchase payments will appear here once orders are confirmed and settled."
              impact="All platform transactions use an automated escrow ledger for audit-grade accountability."
              actionLabel="Browse Marketplace"
              actionTo="/hospital/marketplace"
              secondaryActionLabel="View My Requests"
              secondaryActionTo="/hospital/my-requests"
            />
          ) : (
            <EmptyState
              icon={Filter}
              title="No payments match your filter"
              description="There are no payment transactions matching the selected search query or status filter."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
            />
          )
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3.5 text-left">Transaction</th>
                    <th className="px-4 py-3.5 text-left">Medicine</th>
                    <th className="px-4 py-3.5 text-left">Seller / Provider</th>
                    <th className="px-3 py-3.5 text-left">Date</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-3 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredPayments.map((p) => {
                    const totalAmt = p.totalPaid || p.amount;
                    const pKey = p.id || p.transactionId;

                    return (
                      <tr
                        key={pKey}
                        id={`payment-row-${pKey}`}
                        onClick={() => setSelectedPaymentForDrawer(p)}
                        className={`transition-colors cursor-pointer ${
                          highlightedId === pKey
                            ? 'alert-target-highlight alert-pulse-target shadow-lg ring-2 ring-emerald-500 bg-emerald-50/50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Transaction ID */}
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-slate-500 text-[11px] font-bold block">
                            {p.transactionId}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.razorpayPaymentId || 'B2B Escrow'}
                          </span>
                        </td>

                        {/* Medicine */}
                        <td className="px-4 py-3.5">
                          <div className="font-extrabold text-slate-900 leading-tight">
                            {p.medicineName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {p.quantity} units
                          </div>
                        </td>

                        {/* Seller */}
                        <td className="px-4 py-3.5 text-slate-800 font-medium">
                          {p.sellerHospital || 'Authorized Peer Hospital'}
                        </td>

                        {/* Date */}
                        <td className="px-3 py-3.5 font-mono text-slate-600 text-xs whitespace-nowrap">
                          {p.date}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          <div className="text-sm font-black text-slate-900">
                            ₹{(Number(totalAmt) || 0).toLocaleString('en-IN')}
                          </div>
                          <span className="text-[10px] text-slate-400 block">incl. GST</span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3.5 text-center">
                          <StatusBadge status={p.paymentStatus} />
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedPaymentForDrawer(p)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                          >
                            View
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-slate-100 p-3 space-y-3">
              {filteredPayments.map((p) => {
                const totalAmt = p.totalPaid || p.amount;
                const pKey = p.id || p.transactionId;

                return (
                  <div
                    key={pKey}
                    id={`payment-card-${pKey}`}
                    onClick={() => setSelectedPaymentForDrawer(p)}
                    className={`p-4 rounded-2xl bg-white border space-y-3 cursor-pointer transition-all ${
                      highlightedId === pKey
                        ? 'alert-target-highlight alert-pulse-target shadow-lg ring-2 ring-emerald-500 bg-emerald-50/50 border-emerald-300'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">{p.medicineName}</h4>
                        <p className="text-xs text-slate-500 font-medium">{p.sellerHospital || 'Peer Hospital'}</p>
                      </div>
                      <StatusBadge status={p.paymentStatus} />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <span className="text-slate-400 font-mono">{p.date}</span>
                      <span className="text-base font-black text-slate-900 font-mono">
                        ₹{Number(totalAmt).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                      <span className="text-slate-400 font-mono">Txn: {p.transactionId}</span>
                      <span className="text-primary-600 font-bold">View Details →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* 5. PAYMENT DETAIL DRAWER (Receipt-Like Layout) */}
      {selectedPaymentForDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="absolute inset-0" onClick={() => setSelectedPaymentForDrawer(null)} />
          
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto z-10 animate-slideLeft">
            
            {/* Drawer Top */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Transaction Receipt
              </span>
              <button
                onClick={() => setSelectedPaymentForDrawer(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-6 flex-1 text-xs">
              
              {/* Receipt Header Banner */}
              <div className="text-center p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <StatusBadge status={selectedPaymentForDrawer.paymentStatus} className="text-xs px-3 py-1 font-extrabold" />
                
                <div className="text-3xl font-black text-slate-900 font-mono tracking-tight pt-1">
                  ₹{Number(selectedPaymentForDrawer.totalPaid || selectedPaymentForDrawer.amount).toLocaleString('en-IN')}
                </div>
                
                <p className="text-[11px] text-slate-500 font-medium">
                  Settled on {selectedPaymentForDrawer.date}
                </p>
              </div>

              {/* Transaction Meta */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Transaction ID:</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                    <span>{selectedPaymentForDrawer.transactionId}</span>
                    <button
                      onClick={() => copyToClipboard(selectedPaymentForDrawer.transactionId, 'txn')}
                      className="text-slate-400 hover:text-slate-600"
                      title="Copy ID"
                    >
                      {copiedId === 'txn' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Gateway Payment ID:</span>
                  <span className="font-mono text-slate-700 font-medium">
                    {selectedPaymentForDrawer.razorpayPaymentId || 'pay_b2b_settlement'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Channel / Gateway:</span>
                  <span className="font-medium text-slate-800">
                    {selectedPaymentForDrawer.paymentMethod || 'Razorpay Escrow'}
                  </span>
                </div>
              </div>

              {/* Itemized Calculation Breakdown */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                  Itemized Breakdown
                </span>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{selectedPaymentForDrawer.medicineName} ({selectedPaymentForDrawer.quantity} units)</span>
                    <span className="font-mono text-slate-900 font-bold">₹{selectedPaymentForDrawer.amount?.toLocaleString('en-IN') || 0}</span>
                  </div>

                  <div className="flex justify-between text-emerald-700">
                    <span>Shelf-Life Concession</span>
                    <span className="font-mono font-bold">-Applied</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Cold-Chain Logistics & Handling</span>
                    <span className="font-mono font-bold">₹450</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Healthcare GST (12%)</span>
                    <span className="font-mono font-bold">₹{selectedPaymentForDrawer.gstAmount?.toLocaleString('en-IN') || Math.round((selectedPaymentForDrawer.amount || 0) * 0.12)}</span>
                  </div>

                  <div className="flex justify-between pt-2.5 border-t border-slate-200 text-sm font-black text-slate-900">
                    <span>TOTAL PAID</span>
                    <span className="font-mono text-primary-700">
                      ₹{Number(selectedPaymentForDrawer.totalPaid || selectedPaymentForDrawer.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Institution Entities */}
              <div className="grid grid-cols-2 gap-3 text-xs p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">SELLER HOSPITAL</span>
                  <strong className="text-slate-800 line-clamp-1">{selectedPaymentForDrawer.sellerHospital || 'Peer Facility'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">BUYER HOSPITAL</span>
                  <strong className="text-slate-800 line-clamp-1">{selectedPaymentForDrawer.buyerHospital || user?.name || 'Apollo Hospital'}</strong>
                </div>
              </div>

            </div>

            {/* Obvious Actions */}
            <div className="p-5 border-t border-slate-200 bg-white sticky bottom-0 space-y-2">
              <button
                onClick={() => {
                  const txn = selectedPaymentForDrawer.transactionId;
                  setSelectedPaymentForDrawer(null);
                  navigate(`/hospital/tracking?txn=${txn}`);
                }}
                className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-primary-600/20"
              >
                <Truck className="w-4 h-4" />
                <span>View Live Transfer & Shipment</span>
              </button>

              <button
                onClick={() => {
                  const p = selectedPaymentForDrawer;
                  setSelectedPaymentForDrawer(null);
                  setReceiptModalPayment(p);
                }}
                className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2"
              >
                <Receipt className="w-4 h-4 text-slate-500" />
                <span>Print Tax Invoice Receipt</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Official Printable Tax Invoice Modal */}
      <ReceiptModal
        isOpen={!!receiptModalPayment}
        onClose={() => setReceiptModalPayment(null)}
        payment={receiptModalPayment}
      />

    </div>
  );
};

export default PaymentHistory;
