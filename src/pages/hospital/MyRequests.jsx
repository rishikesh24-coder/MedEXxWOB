import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { 
  Send, 
  CreditCard, 
  Truck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Search,
  Check,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  XCircle,
  Eye,
  Filter,
  RotateCcw,
  Calendar,
  ArrowUpDown,
  AlertTriangle,
  Package
} from 'lucide-react';
import { 
  fetchOutgoingRequests, 
  payForRequest, 
  failPaymentForRequest, 
  cancelRequisition 
} from '../../store/slices/requestSlice';
import StatusBadge from '../../components/common/StatusBadge';
import RazorpayMockModal from '../../components/common/RazorpayMockModal';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import CancelRequestModal from '../../components/hospital/CancelRequestModal';
import OrderDetailsModal from '../../components/common/OrderDetailsModal';
import { getCancellationPolicy, getCancellationBadgeProps } from '../../utils/cancellationPolicy';
import toast from 'react-hot-toast';
import { isHospitalSuspended, getLiveHospitalRecord } from '../../services/storage';
import { getRequestRemainingTime } from '../../utils/expiryUtils';
import { hospitalService } from '../../services/hospitalService';
import { formatDate } from '../../utils/formatters';

export const MyRequests = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { outgoingRequests = [], isLoading } = useSelector((state) => state.requests);

  const liveHospital = useMemo(() => {
    return getLiveHospitalRecord(user?.id) || user;
  }, [user]);

  const currentVerification = (
    liveHospital?.verification_status ||
    liveHospital?.verificationStatus ||
    (['verified', 'approved', 'pending', 'pending_approval', 'under_review', 'rejected'].includes((liveHospital?.status || '').toLowerCase())
      ? liveHospital.status
      : (user?.verification_status || 'verified'))
  ).toLowerCase();
  const currentStatus = (liveHospital?.status || user?.status || 'active').toLowerCase();
  const isSuspended = currentStatus === 'suspended';
  const isOperationalLocked = (currentVerification !== 'verified' && currentVerification !== 'approved') || isSuspended || currentStatus === 'inactive';

  // Modal states
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [activePaymentReq, setActivePaymentReq] = useState(null);
  const [cancelModalReq, setCancelModalReq] = useState(null);
  const [rejectReasonModal, setRejectReasonModal] = useState(null);

  // Alert Deep-Link & Pulse Highlighting
  const [highlightedId, setHighlightedId] = useState(null);
  const processedTargetRef = useRef(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [providingHospitalFilter, setProvidingHospitalFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState('requestDate');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchOutgoingRequests(user.id));
    }
  }, [dispatch, user?.id]);

  // Keep selected order in sync when outgoingRequests update
  useEffect(() => {
    if (selectedOrderForDetails) {
      const fresh = outgoingRequests.find((r) => r.id === selectedOrderForDetails.id || r.transactionId === selectedOrderForDetails.transactionId);
      if (fresh) {
        setSelectedOrderForDetails(fresh);
      }
    }
  }, [outgoingRequests]);

  // Alert Deep-Link Target Resolution Effect
  useEffect(() => {
    if (isLoading || !outgoingRequests || outgoingRequests.length === 0) return;

    const targetReqId = searchParams.get('requestId') || searchParams.get('orderId') || searchParams.get('reqId') || searchParams.get('transactionId') || location.state?.alertTarget?.requestId || location.state?.alertTarget?.orderId;
    if (!targetReqId) return;

    const targetSig = `${targetReqId}`;
    if (processedTargetRef.current === targetSig) return;
    processedTargetRef.current = targetSig;

    const cleanParams = () => {
      try {
        const next = new URLSearchParams(searchParams);
        next.delete('requestId');
        next.delete('orderId');
        next.delete('reqId');
        next.delete('transactionId');
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

    const matched = outgoingRequests.find(
      (r) => r.id === targetReqId || r.requestId === targetReqId || r.transactionId === targetReqId || r.orderId === targetReqId
    );

    if (matched) {
      // Ensure row is visible
      setActiveTabFilter('all');
      setOrderStatusFilter('all');
      setPaymentStatusFilter('all');
      setProvidingHospitalFilter('all');
      setPriorityFilter('all');
      setSearchTerm('');

      setHighlightedId(matched.id);
      setSelectedOrderForDetails(matched);
      toast.success(`Focused on request for ${matched.medicineName || 'medicine'}`, { icon: '🎯', id: 'req-inspect-toast' });

      let attempts = 0;
      const scrollTimer = setInterval(() => {
        attempts++;
        const targetEl = document.getElementById(`my-request-row-${matched.id}`) || document.getElementById(`my-request-card-${matched.id}`);
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

    toast.error('Original request is no longer available.', {
      icon: '⚠️',
      duration: 4000,
      id: 'req-missing-toast',
    });
    cleanParams();
  }, [outgoingRequests, isLoading, searchParams, location.state]);

  // Unique providing hospitals for filter dropdown
  const uniqueProvidingHospitals = useMemo(() => {
    const set = new Set();
    outgoingRequests.forEach((r) => {
      if (r.toHospitalName) set.add(r.toHospitalName);
    });
    return Array.from(set).sort();
  }, [outgoingRequests]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = { all: 0, purchases: 0, actionable: 0, transit: 0, pending: 0, cancelled: 0 };
    outgoingRequests.forEach((r) => {
      counts.all += 1;
      const s = (r.status || '').toLowerCase().trim();
      const ps = (r.paymentStatus || '').toLowerCase().trim();
      const isPaid = ['paid', 'success', 'successful', 'completed', 'settled'].includes(ps);
      const isReceived = ['delivered', 'completed'].includes(s) || !!r.deliveredAt || !!r.receivedDate;

      // Purchase History: only orders where payment was completed AND order was received/delivered
      if (isPaid && isReceived) counts.purchases += 1;
      if (s === 'accepted' || s === 'approved') counts.actionable += 1;
      if (['paid', 'preparing', 'dispatched', 'shipped', 'in transit', 'in_transit'].includes(s)) counts.transit += 1;
      if (s === 'pending' || s === 'requested' || s === 'reviewing') counts.pending += 1;
      if (s === 'cancelled' || s === 'cancelled by buyer') counts.cancelled += 1;
    });
    return counts;
  }, [outgoingRequests]);

  // Filtered and sorted outgoing requests
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return outgoingRequests
      .filter((r) => {
        const s = (r.status || '').toLowerCase().trim();
        const ps = (r.paymentStatus || '').toLowerCase().trim();
        const isPaid = ['paid', 'success', 'successful', 'completed', 'settled'].includes(ps);
        const isReceived = ['delivered', 'completed'].includes(s) || !!r.deliveredAt || !!r.receivedDate;

        // 1. Tab filter
        if (activeTabFilter === 'purchases') {
          // Strictly ONLY medicines that satisfy BOTH conditions:
          // 1. Payment was successfully completed
          // 2. The order was successfully received/delivered by the hospital
          if (!isPaid || !isReceived) return false;
        } else if (activeTabFilter === 'actionable') {
          if (s !== 'accepted' && s !== 'approved') return false;
        } else if (activeTabFilter === 'transit') {
          if (!['paid', 'preparing', 'dispatched', 'shipped', 'in transit', 'in_transit'].includes(s)) return false;
        } else if (activeTabFilter === 'pending') {
          if (!['pending', 'requested', 'reviewing'].includes(s)) return false;
        } else if (activeTabFilter === 'cancelled') {
          if (s !== 'cancelled' && s !== 'cancelled by buyer') return false;
        }

        // 2. Order Status dropdown
        if (orderStatusFilter !== 'all') {
          if (orderStatusFilter === 'requested' && !(s === 'pending' || s === 'requested' || s === 'reviewing')) return false;
          else if ((orderStatusFilter === 'accepted' || orderStatusFilter === 'approved') && !(s === 'accepted' || s === 'approved')) return false;
          else if (orderStatusFilter === 'in transit' && !(s === 'in transit' || s === 'in_transit')) return false;
          else if (orderStatusFilter === 'dispatched' && !(s === 'dispatched' || s === 'shipped')) return false;
          else if (orderStatusFilter === 'preparing' && !(s === 'preparing' || s === 'processing')) return false;
          else if (orderStatusFilter === 'cancelled' && !(s === 'cancelled' || s === 'cancelled by buyer')) return false;
          else if (orderStatusFilter === 'insufficient_stock' && !(s === 'insufficient_stock' || s === 'insufficient stock')) return false;
          else if (!['requested', 'accepted', 'approved', 'in transit', 'dispatched', 'preparing', 'cancelled', 'insufficient_stock'].includes(orderStatusFilter) && s !== orderStatusFilter) return false;
        }

        // 3. Payment Status dropdown
        if (paymentStatusFilter !== 'all') {
          if (paymentStatusFilter === 'paid' && !isPaid) return false;
          if (paymentStatusFilter === 'pending' && !(ps === 'pending' && (s === 'accepted' || s === 'approved'))) return false;
          if (paymentStatusFilter === 'failed' && ps !== 'failed') return false;
          if (paymentStatusFilter === 'refunded' && !(ps === 'refunded' || r.cancellation?.refundStatus)) return false;
        }

        // 4. Providing Hospital dropdown
        if (providingHospitalFilter !== 'all' && r.toHospitalName !== providingHospitalFilter) return false;

        // 5. Priority dropdown
        if (priorityFilter !== 'all') {
          const isEmergency = r.urgency === 'Emergency' || r.priority === 'Emergency' || r.notes?.includes('ICU');
          if (priorityFilter === 'emergency' && !isEmergency) return false;
          if (priorityFilter === 'standard' && isEmergency) return false;
        }

        // 6. Date Range filter
        if (startDate) {
          const rDate = new Date(r.requestDate || r.createdAt);
          if (rDate < new Date(startDate)) return false;
        }
        if (endDate) {
          const rDate = new Date(r.requestDate || r.createdAt);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (rDate > end) return false;
        }

        // 7. Search term matching: Medicine, TXN, Providing Hospital
        if (term) {
          const medMatch = (r.medicineName || '').toLowerCase().includes(term);
          const hospMatch = (r.toHospitalName || '').toLowerCase().includes(term);
          const txnMatch = (r.transactionId || '').toLowerCase().includes(term) || (r.id || '').toLowerCase().includes(term);
          const batchMatch = (r.batchNo || '').toLowerCase().includes(term);
          if (!medMatch && !hospMatch && !txnMatch && !batchMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortField === 'totalAmount') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else if (sortField === 'quantity') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [
    outgoingRequests, 
    activeTabFilter, 
    orderStatusFilter, 
    paymentStatusFilter, 
    providingHospitalFilter, 
    priorityFilter, 
    startDate, 
    endDate, 
    searchTerm, 
    sortField, 
    sortOrder
  ]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setActiveTabFilter('all');
    setOrderStatusFilter('all');
    setPaymentStatusFilter('all');
    setProvidingHospitalFilter('all');
    setPriorityFilter('all');
    setStartDate('');
    setEndDate('');
    setSortField('requestDate');
    setSortOrder('desc');
  };

  const handlePaymentSuccess = async ({ requestId, paymentMethod, deliveryCharge, distanceKm, totalPayable, verification }) => {
    const result = await dispatch(payForRequest({ requestId, paymentMethod, deliveryCharge, distanceKm, totalPayable, verification }));
    if (result.meta.requestStatus === 'rejected') {
      throw new Error(result.payload || 'Payment could not be processed');
    }
    toast.success('Payment successfully processed! Order moved to Paid.');
    dispatch(fetchOutgoingRequests(user?.id));
    return result.payload;
  };

  const handlePaymentFailure = async ({ requestId, reason }) => {
    const result = await dispatch(failPaymentForRequest({ requestId, reason }));
    if (result.meta.requestStatus === 'rejected') {
      throw new Error(result.payload || 'Payment failure could not be registered');
    }
    toast.error('Payment simulation failed. Requisition remains Accepted for retry.');
    dispatch(fetchOutgoingRequests(user?.id));
    return result.payload;
  };

  const handleConfirmCancel = async ({ requestId, reason, note, policy, amounts }) => {
    try {
      await dispatch(cancelRequisition({
        requestId,
        reason,
        note,
        hospitalId: user?.id,
      })).unwrap();
      toast.success(
        `Requisition cancelled successfully. Demo refund initiated: ₹${(amounts?.refundAmount || 0).toLocaleString()} (${policy?.refundPercent || 100}% refund).`
      );
      setCancelModalReq(null);
      dispatch(fetchOutgoingRequests(user?.id));
    } catch (err) {
      toast.error(err?.message || 'Failed to cancel requisition');
      throw err;
    }
  };

  const handleConfirmDelivery = async (order) => {
    try {
      await hospitalService.advanceOrderFulfillment({ requestId: order.id });
      toast.success('Dock intake confirmed! Requisition marked as Completed and stock added to inventory.');
      dispatch(fetchOutgoingRequests(user?.id));
    } catch (err) {
      toast.error(err?.message || 'Failed to confirm delivery');
    }
  };

  return (
    <div className="space-y-6">

      {/* Compliance Status Notice */}
      {isOperationalLocked && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
          currentVerification === 'pending' || currentVerification === 'under_review' || currentVerification === 'pending_approval'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-950'
            : isSuspended
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-950'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-950'
        }`}>
          <div>
            <div className="font-bold text-sm">
              Requisition Operations Restricted • Status: <span className="capitalize">{currentVerification.replace('_', ' ')}</span>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {currentVerification === 'pending' || currentVerification === 'under_review' || currentVerification === 'pending_approval' ? (
                <span>Submitting new procurement requisitions is restricted until your facility accreditation is verified by MEDEX Administration.</span>
              ) : isSuspended ? (
                <span>Your facility account has been suspended ({liveHospital?.suspensionReason || 'Administrative hold'}). Requisition submissions are disabled.</span>
              ) : (
                <span>Your facility registration was rejected ({liveHospital?.rejectionReason || 'Documentation declined'}). Requisition submissions are disabled.</span>
              )}
            </p>
          </div>
        </div>
      )}
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-secondary-900 tracking-tight">
              Outgoing Medicine Requisitions
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold text-primary-700 bg-primary-50 border border-primary-200 rounded">
              PIPELINE TRACKER
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track stage milestones of pharmaceutical procurements submitted to partner healthcare facilities. Click any order row to view full tracking, timeline, and batch details.
          </p>
        </div>

        {isOperationalLocked ? (
          <button
            onClick={() => toast.error('Requisitions are locked for unverified or suspended facilities.')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Requisition</span>
          </button>
        ) : (
          <Link
            to="/hospital/marketplace"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Requisition</span>
          </Link>
        )}
      </div>

      {/* Unified Filters & Search Toolbar (Section 6) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3.5">
        {/* Row 1: Search & Status Tabs */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Medicine, Hospital, or TXN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 focus:outline-none font-medium transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
            {[
              { id: 'all', label: 'All Orders', count: tabCounts.all },
              { id: 'purchases', label: 'Purchase History', count: tabCounts.purchases },
              { id: 'actionable', label: 'Ready for Escrow', count: tabCounts.actionable },
              { id: 'transit', label: 'In Transit', count: tabCounts.transit },
              { id: 'pending', label: 'Awaiting Approval', count: tabCounts.pending },
              { id: 'cancelled', label: 'Cancelled', count: tabCounts.cancelled },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  activeTabFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTabFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white text-slate-700 border border-slate-200'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Secondary Compact Filters Row (Status, Payment, Date Range, Hospital, Priority, Clear) */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs">
          {/* Order Status Select */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Status:</span>
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="requested">Requested</option>
              <option value="accepted">Accepted / Approved</option>
              <option value="paid">Paid</option>
              <option value="preparing">Preparing</option>
              <option value="dispatched">Dispatched</option>
              <option value="in transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
              <option value="insufficient_stock">Insufficient Stock</option>
            </select>
          </div>

          {/* Payment Status Select */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Payment:</span>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Payment Pending</option>
              <option value="failed">Payment Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Providing Hospital Select */}
          {uniqueProvidingHospitals.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 max-w-[200px]">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 shrink-0">Seller:</span>
              <select
                value={providingHospitalFilter}
                onChange={(e) => setProvidingHospitalFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer truncate"
              >
                <option value="all">All Sellers</option>
                {uniqueProvidingHospitals.map((hosp) => (
                  <option key={hosp} value={hosp}>{hosp}</option>
                ))}
              </select>
            </div>
          )}

          {/* Priority Select */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="emergency">Emergency / STAT</option>
              <option value="standard">Standard</option>
            </select>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <Calendar className="w-3 h-3 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-slate-700 focus:outline-none"
              title="From date"
            />
            <span className="text-slate-300">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-[11px] font-mono text-slate-700 focus:outline-none"
              title="To date"
            />
          </div>

          {/* Clear Filters Button */}
          {(searchTerm || activeTabFilter !== 'all' || orderStatusFilter !== 'all' || paymentStatusFilter !== 'all' || providingHospitalFilter !== 'all' || priorityFilter !== 'all' || startDate || endDate) && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Order List / Table Layout (Section 4, 51, 52) */}
      {isLoading && outgoingRequests.length === 0 ? (
        <LoadingSpinner text="Querying active requisition pipeline..." />
      ) : filtered.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Medicine Name</th>
                  <th className="py-3 px-4">Order / TXN ID</th>
                  <th className="py-3 px-4">Providing Hospital</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Settlement</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Date / SLA</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filtered.map((req) => {
                  const s = (req.status || '').toLowerCase().trim();
                  const ps = (req.paymentStatus || '').toLowerCase().trim();
                  const isPaid = ['paid', 'success', 'successful', 'completed', 'settled'].includes(ps);
                  const isFailed = ps === 'failed';
                  const isCancelled = s === 'cancelled' || s === 'cancelled by buyer';
                  const isRejected = s === 'rejected';
                  const cancelPolicy = getCancellationPolicy(req);
                  const cancelBadge = getCancellationBadgeProps(cancelPolicy);
                  const sla = getRequestRemainingTime(req.requestDate, req.expiryDate);

                  return (
                    <tr
                      key={req.id}
                      id={`my-request-row-${req.id}`}
                      onClick={() => setSelectedOrderForDetails(req)}
                      className={`transition-colors cursor-pointer group ${
                        highlightedId === req.id
                          ? 'alert-target-highlight alert-pulse-target shadow-lg ring-2 ring-teal-500 bg-teal-50/50'
                          : 'hover:bg-teal-50/30'
                      }`}
                    >
                      {/* Medicine */}
                      <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-teal-900 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>{req.medicineName}</span>
                          {req.urgency === 'Emergency' && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-black uppercase bg-red-100 text-red-700 border border-red-200">
                              STAT
                            </span>
                          )}
                          {(req.hasDiscrepancy || req.discrepancy) && (
                            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Discrepancy logged" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {req.genericName || req.power || 'Active Batch'}
                        </span>
                      </td>

                      {/* Order / TXN ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        {req.transactionId || req.id}
                      </td>

                      {/* Providing Hospital */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium max-w-[180px] truncate" title={req.toHospitalName}>
                        {req.toHospitalName}
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                        {req.quantity}
                      </td>

                      {/* Total Settlement */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900">
                        <div>₹{(req.finalTotalAmount || req.totalAmount || 0).toLocaleString()}</div>
                        {req.deliveryCharge > 0 && (
                          <div className="text-[10px] text-teal-700 font-normal">
                            incl. ₹{req.deliveryCharge} delivery
                          </div>
                        )}
                      </td>

                      {/* Current Status */}
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={req.status} />
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                            <span>Paid</span>
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Failed</span>
                          </span>
                        ) : (s === 'accepted' || s === 'approved') ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </span>
                        ) : isRejected ? (
                          <span className="text-slate-400">Declined</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Order Date / SLA */}
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        <div>{formatDate(req.requestDate)}</div>
                        {s === 'pending' && (
                          <span className={`text-[9px] font-bold ${sla.isExpired ? 'text-rose-700' : 'text-amber-700'}`}>
                            {sla.isExpired ? 'SLA Expired' : `${sla.formattedRemaining} left`}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Pay Now Button directly accessible if accepted or approved */}
                          {(s === 'accepted' || s === 'approved') && !isPaid && !isFailed && (
                            <button
                              onClick={() => !isSuspended && setActivePaymentReq(req)}
                              disabled={isSuspended}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                              title="Pay Now"
                            >
                              Pay Now
                            </button>
                          )}

                          {(s === 'accepted' || s === 'approved') && isFailed && (
                            <button
                              onClick={() => !isSuspended && setActivePaymentReq(req)}
                              disabled={isSuspended}
                              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                              title="Retry Payment"
                            >
                              Retry
                            </button>
                          )}

                          {/* Existing View Details Button (Section 4) */}
                          <button
                            onClick={() => setSelectedOrderForDetails(req)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                            title="View Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet Compact Card Layout (Section 52) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filtered.map((req) => {
              const s = (req.status || '').toLowerCase().trim();
              const ps = (req.paymentStatus || '').toLowerCase().trim();
              const isPaid = ['paid', 'success', 'successful', 'completed', 'settled'].includes(ps);
              const isFailed = ps === 'failed';

              return (
                <div
                  key={req.id}
                  id={`my-request-card-${req.id}`}
                  onClick={() => setSelectedOrderForDetails(req)}
                  className={`p-4 transition-colors cursor-pointer space-y-3 ${
                    highlightedId === req.id
                      ? 'alert-target-highlight alert-pulse-target shadow-lg ring-2 ring-teal-500 bg-teal-50/50 rounded-xl'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{req.medicineName}</div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">
                        TXN: <strong className="text-slate-700">{req.transactionId || req.id}</strong>
                      </div>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Seller</span>
                      <span className="font-bold text-slate-800 truncate block">{req.toHospitalName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Qty</span>
                      <span className="font-bold text-slate-800">{req.quantity} units</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Settlement</span>
                      <span className="font-black text-slate-900 block">₹{(req.finalTotalAmount || req.totalAmount || 0).toLocaleString()}</span>
                      {req.deliveryCharge > 0 && (
                        <span className="text-[9px] text-teal-700 block">incl. ₹{req.deliveryCharge} delivery</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Payment</span>
                      <span className={`font-bold ${isPaid ? 'text-emerald-700' : isFailed ? 'text-rose-600' : 'text-amber-700'}`}>
                        {isPaid ? 'Paid' : isFailed ? 'Failed' : (s === 'accepted' || s === 'approved') ? 'Pending' : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs text-slate-500" onClick={(e) => e.stopPropagation()}>
                    <span className="font-mono text-[11px]">{formatDate(req.requestDate)}</span>
                    
                    <div className="flex items-center gap-2">
                      {(s === 'accepted' || s === 'approved') && !isPaid && !isFailed && (
                        <button
                          onClick={() => !isSuspended && setActivePaymentReq(req)}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs"
                        >
                          Pay Now
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedOrderForDetails(req)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        <EmptyState
          icon={Send}
          title="No outgoing requisitions found"
          description="Requisitions submitted to peer hospitals for critical medicine stock will appear here."
          impact="Procuring verified near-expiry stock from peers saves up to 80% while solving urgent inpatient shortages."
          actionLabel="Browse Exchange Marketplace"
          actionTo="/hospital/marketplace"
        />
      )}

      {/* Reusable Complete Order Details Modal (Section 16, 17, 18, 21, 43) */}
      {selectedOrderForDetails && (
        <OrderDetailsModal
          isOpen={!!selectedOrderForDetails}
          onClose={() => setSelectedOrderForDetails(null)}
          order={selectedOrderForDetails}
          role="hospital"
          isSuspended={isSuspended}
          onPayNow={(order) => {
            setActivePaymentReq(order);
          }}
          onRetryPayment={(order) => {
            setActivePaymentReq(order);
          }}
          onCancelRequest={(order) => {
            setCancelModalReq(order);
          }}
          onConfirmDelivery={handleConfirmDelivery}
        />
      )}

      {/* Razorpay Escrow Modal (Preserved) */}
      {activePaymentReq && (
        <RazorpayMockModal
          isOpen={!!activePaymentReq}
          onClose={() => setActivePaymentReq(null)}
          request={activePaymentReq}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentFailure={handlePaymentFailure}
        />
      )}

      {/* Cancel Request Confirmation Modal (Preserved) */}
      {cancelModalReq && (
        <CancelRequestModal
          isOpen={!!cancelModalReq}
          onClose={() => setCancelModalReq(null)}
          request={cancelModalReq}
          onConfirmCancel={handleConfirmCancel}
        />
      )}

      {/* Rejection Reason Modal (Preserved) */}
      {rejectReasonModal && (
        <Modal
          isOpen={!!rejectReasonModal}
          onClose={() => setRejectReasonModal(null)}
          title="Requisition Formally Declined"
          subtitle={`Notice recorded by ${rejectReasonModal.toHospitalName}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-1">
            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-rose-700 tracking-wider">
                Audited Reason:
              </span>
              <p className="text-xs text-rose-800 font-medium leading-relaxed">
                {rejectReasonModal.rejectReason || 'Declined due to internal surgical ward quota priority.'}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectReasonModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Close Audit Dossier
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default MyRequests;
