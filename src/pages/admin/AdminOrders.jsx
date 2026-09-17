import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Clock, 
  Building2, 
  Eye, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Package, 
  FileText, 
  X, 
  Calendar, 
  ArrowUpDown, 
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ChevronRight,
  Info,
  CreditCard,
  AlertCircle,
  Check,
  Ban,
  ThermometerSnowflake,
  ShieldCheck,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import OrderDetailsModal from '../../components/common/OrderDetailsModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

const FILTER_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'requested', label: 'Requested' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'paid', label: 'Paid' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'in transit', label: 'In Transit' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'payment pending', label: 'Payment Pending' },
  { id: 'payment failed', label: 'Payment Failed' },
  { id: 'discrepancy', label: 'Discrepancy' },
];

export const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters (Section 8, 9)
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [requestingHospitalFilter, setRequestingHospitalFilter] = useState('all');
  const [providingHospitalFilter, setProvidingHospitalFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [batchSearchTerm, setBatchSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState('orderDate');
  const [sortOrder, setSortOrder] = useState('desc');

  // Details Modal (Section 16, 17, 18, 43)
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Status Change Confirmation Modal
  const [confirmStatusModal, setConfirmStatusModal] = useState({
    isOpen: false,
    order: null,
    targetStatus: '',
    note: '',
    isSubmitting: false,
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await adminService.getOrders('all');
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
      toast.error('Failed to load orders ledger');
    } finally {
      setLoading(false);
    }
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const processedOrderRef = useRef(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Deep-link to target order from alert Inspect
  useEffect(() => {
    const targetOrderId = searchParams.get('orderId') || location.state?.alertTarget?.orderId;
    if (!targetOrderId || orders.length === 0 || processedOrderRef.current) return;

    const found = orders.find((o) => o.id === targetOrderId || o.orderNumber === targetOrderId);
    if (found) {
      processedOrderRef.current = true;
      setActiveFilterTab('all');
      setSelectedOrder(found);
      toast.success(`Focused on Order #${found.orderNumber || found.id}`, { icon: '📦' });

      try {
        const next = new URLSearchParams(searchParams);
        next.delete('orderId');
        setSearchParams(next, { replace: true });
      } catch (e) {
        console.warn(e);
      }
    }
  }, [orders, searchParams, location.state]);

  // Compute status & category metrics
  const metrics = useMemo(() => {
    const total = orders.length;
    let pendingPayment = 0;
    let inFulfillment = 0;
    let completed = 0;
    let discrepancies = 0;

    orders.forEach((o) => {
      const s = (o.status || '').toLowerCase().trim();
      const ps = (o.paymentStatus || '').toLowerCase().trim();
      if (ps === 'pending' && s === 'accepted') pendingPayment += 1;
      if (['preparing', 'dispatched', 'in transit'].includes(s)) inFulfillment += 1;
      if (s === 'delivered' || s === 'completed') completed += 1;
      if (o.hasDiscrepancy || o.discrepancy) discrepancies += 1;
    });

    return { total, pendingPayment, inFulfillment, completed, discrepancies };
  }, [orders]);

  // Compute tab counts
  const filterCounts = useMemo(() => {
    const counts = {};
    FILTER_TABS.forEach((t) => {
      counts[t.id] = 0;
    });

    orders.forEach((o) => {
      counts['all'] = (counts['all'] || 0) + 1;
      const s = (o.status || '').toLowerCase().trim();
      const ps = (o.paymentStatus || '').toLowerCase().trim();

      if (s === 'pending' || s === 'requested') counts['requested'] = (counts['requested'] || 0) + 1;
      if (s === 'accepted') counts['accepted'] = (counts['accepted'] || 0) + 1;
      if (s === 'paid') counts['paid'] = (counts['paid'] || 0) + 1;
      if (s === 'preparing' || s === 'processing') counts['preparing'] = (counts['preparing'] || 0) + 1;
      if (s === 'dispatched' || s === 'shipped') counts['dispatched'] = (counts['dispatched'] || 0) + 1;
      if (s === 'in transit' || s === 'in_transit') counts['in transit'] = (counts['in transit'] || 0) + 1;
      if (s === 'delivered') counts['delivered'] = (counts['delivered'] || 0) + 1;
      if (s === 'completed') counts['completed'] = (counts['completed'] || 0) + 1;
      if (s === 'cancelled') counts['cancelled'] = (counts['cancelled'] || 0) + 1;
      if (s === 'rejected') counts['rejected'] = (counts['rejected'] || 0) + 1;
      if (ps === 'pending' && s === 'accepted') counts['payment pending'] = (counts['payment pending'] || 0) + 1;
      if (ps === 'failed') counts['payment failed'] = (counts['payment failed'] || 0) + 1;
      if (o.hasDiscrepancy || o.discrepancy) counts['discrepancy'] = (counts['discrepancy'] || 0) + 1;
    });

    return counts;
  }, [orders]);

  // Unique requesting & providing hospitals
  const { requestingHospitals, providingHospitals } = useMemo(() => {
    const reqSet = new Set();
    const provSet = new Set();

    orders.forEach((o) => {
      if (o.hospital?.name) reqSet.add(o.hospital.name);
      if (o.fulfillingHospital?.name) provSet.add(o.fulfillingHospital.name);
    });

    return {
      requestingHospitals: Array.from(reqSet).sort(),
      providingHospitals: Array.from(provSet).sort(),
    };
  }, [orders]);

  // Filtered and sorted orders
  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const batchTerm = batchSearchTerm.toLowerCase().trim();

    return orders
      .filter((o) => {
        const s = (o.status || '').toLowerCase().trim();
        const ps = (o.paymentStatus || '').toLowerCase().trim();

        // 1. Tab filter
        let matchesTab = true;
        if (activeFilterTab === 'requested') matchesTab = (s === 'pending' || s === 'requested');
        else if (activeFilterTab === 'accepted') matchesTab = (s === 'accepted');
        else if (activeFilterTab === 'paid') matchesTab = (s === 'paid');
        else if (activeFilterTab === 'preparing') matchesTab = (s === 'preparing' || s === 'processing');
        else if (activeFilterTab === 'dispatched') matchesTab = (s === 'dispatched' || s === 'shipped');
        else if (activeFilterTab === 'in transit') matchesTab = (s === 'in transit' || s === 'in_transit');
        else if (activeFilterTab === 'delivered') matchesTab = (s === 'delivered');
        else if (activeFilterTab === 'completed') matchesTab = (s === 'completed');
        else if (activeFilterTab === 'cancelled') matchesTab = (s === 'cancelled');
        else if (activeFilterTab === 'rejected') matchesTab = (s === 'rejected');
        else if (activeFilterTab === 'payment pending') matchesTab = (ps === 'pending' && s === 'accepted');
        else if (activeFilterTab === 'payment failed') matchesTab = (ps === 'failed');
        else if (activeFilterTab === 'discrepancy') matchesTab = Boolean(o.hasDiscrepancy || o.discrepancy);
        if (!matchesTab) return false;

        // 2. Order status filter dropdown
        if (orderStatusFilter !== 'all') {
          if (orderStatusFilter === 'requested' && !(s === 'pending' || s === 'requested')) return false;
          else if (orderStatusFilter === 'in transit' && !(s === 'in transit' || s === 'in_transit')) return false;
          else if (orderStatusFilter === 'dispatched' && !(s === 'dispatched' || s === 'shipped')) return false;
          else if (orderStatusFilter === 'preparing' && !(s === 'preparing' || s === 'processing')) return false;
          else if (orderStatusFilter === 'insufficient_stock' && !(s === 'insufficient_stock' || s === 'insufficient stock')) return false;
          else if (!['requested', 'in transit', 'dispatched', 'preparing', 'insufficient_stock'].includes(orderStatusFilter) && s !== orderStatusFilter) return false;
        }

        // 3. Payment status filter dropdown
        if (paymentStatusFilter !== 'all') {
          if (paymentStatusFilter === 'paid' && ps !== 'paid') return false;
          if (paymentStatusFilter === 'pending' && !(ps === 'pending' && s === 'accepted')) return false;
          if (paymentStatusFilter === 'failed' && ps !== 'failed') return false;
          if (paymentStatusFilter === 'refunded' && ps !== 'refunded') return false;
        }

        // 4. Requesting hospital filter
        if (requestingHospitalFilter !== 'all' && o.hospital?.name !== requestingHospitalFilter) return false;

        // 5. Providing hospital filter
        if (providingHospitalFilter !== 'all' && o.fulfillingHospital?.name !== providingHospitalFilter) return false;

        // 6. Priority filter
        if (priorityFilter !== 'all') {
          const isStat = o.urgency === 'Emergency' || o.priority === 'Emergency';
          if (priorityFilter === 'emergency' && !isStat) return false;
          if (priorityFilter === 'standard' && isStat) return false;
        }

        // 7. Batch search term
        if (batchTerm) {
          const batchMatch = (o.batchNo || '').toLowerCase().includes(batchTerm) ||
            o.items?.some((it) => (it.batchNo || '').toLowerCase().includes(batchTerm));
          if (!batchMatch) return false;
        }

        // 8. Date range filter
        if (startDate) {
          const oDate = new Date(o.orderDate);
          if (oDate < new Date(startDate)) return false;
        }
        if (endDate) {
          const oDate = new Date(o.orderDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (oDate > end) return false;
        }

        // 9. Main Search matching: Order ID, Medicine, Requesting Hospital, Providing Hospital, Batch
        if (term) {
          const orderIdMatch = (o.orderId || '').toLowerCase().includes(term) || (o.transactionId || '').toLowerCase().includes(term);
          const medMatch = (o.medicineName || '').toLowerCase().includes(term) ||
            o.items?.some((it) => (it.name || '').toLowerCase().includes(term) || (it.genericName || '').toLowerCase().includes(term));
          const reqHospMatch = (o.hospital?.name || '').toLowerCase().includes(term);
          const provHospMatch = (o.fulfillingHospital?.name || '').toLowerCase().includes(term);
          const bMatch = (o.batchNo || '').toLowerCase().includes(term);

          if (!orderIdMatch && !medMatch && !reqHospMatch && !provHospMatch && !bMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (sortField === 'totalAmount' || sortField === 'settlementAmount') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else if (sortField === 'quantity' || sortField === 'totalItems') {
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
    orders, 
    activeFilterTab, 
    orderStatusFilter, 
    paymentStatusFilter, 
    requestingHospitalFilter, 
    providingHospitalFilter, 
    priorityFilter, 
    batchSearchTerm, 
    startDate, 
    endDate, 
    searchTerm, 
    sortField, 
    sortOrder
  ]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setActiveFilterTab('all');
    setOrderStatusFilter('all');
    setPaymentStatusFilter('all');
    setRequestingHospitalFilter('all');
    setProvidingHospitalFilter('all');
    setPriorityFilter('all');
    setBatchSearchTerm('');
    setStartDate('');
    setEndDate('');
    setSortField('orderDate');
    setSortOrder('desc');
  };

  const handleOpenStatusConfirm = (order, newStatus) => {
    setConfirmStatusModal({
      isOpen: true,
      order,
      targetStatus: newStatus,
      note: '',
      isSubmitting: false,
    });
  };

  const handleConfirmStatusChange = async () => {
    const { order, targetStatus, note } = confirmStatusModal;
    if (!order || !targetStatus) return;

    setConfirmStatusModal((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await adminService.updateOrderStatus(order.id, targetStatus, note);
      toast.success(`Order #${order.orderId} moved to ${targetStatus}`);
      setConfirmStatusModal({ isOpen: false, order: null, targetStatus: '', note: '', isSubmitting: false });
      
      await fetchOrders();
      if (selectedOrder && selectedOrder.id === order.id) {
        const freshOrders = await adminService.getOrders('all');
        const updated = freshOrders.find((o) => o.id === order.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to update order status');
      setConfirmStatusModal((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Refined MedEx Header Banner (Section 35) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-ocean-950 via-ocean-900 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <ShoppingBag className="w-3 h-3 text-teal-400" />
              Central Orders Ledger
            </span>
            <span className="text-xs text-slate-400 font-mono">8-Stage Real-Time Pipeline</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Inter-Hospital Requisitions & Order Fulfillment
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl font-normal leading-relaxed">
            Supervise peer hospital procurements, monitor cold-chain transit telemetries, inspect physical dock intake discrepancies, and maintain unified ledger compliance.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <button
            onClick={fetchOrders}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold backdrop-blur-md transition-all border border-white/10 shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Ledger</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow transition-all space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-mono font-black text-slate-900">{metrics.total}</div>
          <span className="text-[10px] text-slate-400 font-mono">Peer requisitions logged</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-sm hover:shadow transition-all space-y-1">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Escrow</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-mono font-black text-amber-800">{metrics.pendingPayment}</div>
          <span className="text-[10px] text-amber-700 font-mono">Accepted & awaiting payment</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-primary-200/80 bg-primary-50/20 shadow-sm hover:shadow transition-all space-y-1">
          <div className="flex items-center justify-between text-primary-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">In Fulfillment</span>
            <Truck className="w-4 h-4 text-primary-600" />
          </div>
          <div className="text-2xl font-mono font-black text-primary-800">{metrics.inFulfillment}</div>
          <span className="text-[10px] text-primary-700 font-mono">Preparing, dispatched, in transit</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-sm hover:shadow transition-all space-y-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed / Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-mono font-black text-emerald-800">{metrics.completed}</div>
          <span className="text-[10px] text-emerald-700 font-mono">Verified dock reception</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-sm hover:shadow transition-all space-y-1 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Discrepancies</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-mono font-black text-rose-800">{metrics.discrepancies}</div>
          <span className="text-[10px] text-rose-700 font-mono">Quantity / cold-chain alerts</span>
        </div>
      </div>

      {/* Unified Filter Area (Section 9) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3.5">
        {/* Row 1: Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Order ID, medicine, hospital, or batch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="font-semibold text-slate-700 font-sans">Sort:</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-teal-600 cursor-pointer"
              >
                <option value="orderDate">Order Date</option>
                <option value="totalAmount">Settlement Amount</option>
                <option value="quantity">Quantity</option>
                <option value="status">Status</option>
              </select>
              <button
                onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 font-bold border border-slate-200 cursor-pointer"
                title="Toggle sort direction"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: 14 Status Filter Tabs (with Counts) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-1 border-t border-slate-100 scrollbar-thin">
          {FILTER_TABS.map((tab) => {
            const count = filterCounts[tab.id] || 0;
            const isActive = activeFilterTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilterTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: All Advanced Filters Together (Requesting Hospital, Providing Hospital, Priority, Batch, Date, Clear) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2.5 text-xs">
          {/* Requesting Hospital (Buyer) */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 max-w-[210px]">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 shrink-0">Buyer:</span>
            <select
              value={requestingHospitalFilter}
              onChange={(e) => setRequestingHospitalFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer truncate"
            >
              <option value="all">All Buyer Hospitals</option>
              {requestingHospitals.map((hosp) => (
                <option key={hosp} value={hosp}>{hosp}</option>
              ))}
            </select>
          </div>

          {/* Providing Hospital (Seller) */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 max-w-[210px]">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400 shrink-0">Seller:</span>
            <select
              value={providingHospitalFilter}
              onChange={(e) => setProvidingHospitalFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer truncate"
            >
              <option value="all">All Seller Hospitals</option>
              {providingHospitals.map((hosp) => (
                <option key={hosp} value={hosp}>{hosp}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="emergency">Emergency (STAT)</option>
              <option value="standard">Standard</option>
            </select>
          </div>

          {/* Batch Filter Input */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Batch:</span>
            <input
              type="text"
              placeholder="e.g. BAT-..."
              value={batchSearchTerm}
              onChange={(e) => setBatchSearchTerm(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-700 focus:outline-none w-24 placeholder:text-slate-400"
            />
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
          {(searchTerm || activeFilterTab !== 'all' || orderStatusFilter !== 'all' || paymentStatusFilter !== 'all' || requestingHospitalFilter !== 'all' || providingHospitalFilter !== 'all' || priorityFilter !== 'all' || batchSearchTerm || startDate || endDate) && (
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

      {/* Compact Order List / Table (Section 7, 51) */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/90 shadow-sm">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs font-mono font-medium text-slate-500">Querying inter-hospital order ledger...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm
              ? `No requisitions matched your query "${searchTerm}".`
              : `There are currently no orders under the selected filters.`}
          </p>
          {(searchTerm || activeFilterTab !== 'all') && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Order / TXN ID</th>
                  <th className="py-3 px-4">Medicine & Batch</th>
                  <th className="py-3 px-4">Requesting Hospital (Buyer)</th>
                  <th className="py-3 px-4">Providing Hospital (Seller)</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Settlement</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredOrders.map((order) => {
                  const s = (order.status || '').toLowerCase().trim();
                  const ps = (order.paymentStatus || '').toLowerCase().trim();
                  const isPaid = ['paid', 'success', 'successful', 'completed', 'settled'].includes(ps);
                  const isFailed = ps === 'failed';

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-teal-50/30 transition-colors cursor-pointer group"
                    >
                      {/* Order / TXN ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 group-hover:text-teal-900">
                        <div className="flex items-center gap-1.5">
                          <span>#{order.orderId}</span>
                          {order.urgency === 'Emergency' && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-black uppercase bg-red-100 text-red-700 border border-red-200">
                              STAT
                            </span>
                          )}
                          {(order.hasDiscrepancy || order.discrepancy) && (
                            <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" title="Discrepancy alert" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {order.transactionId}
                        </span>
                      </td>

                      {/* Medicine & Batch */}
                      <td className="py-3.5 px-4 font-bold text-slate-800 max-w-[200px]">
                        <div className="truncate" title={order.medicineName}>{order.medicineName}</div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Batch: <strong className="text-slate-600">{order.batchNo}</strong>
                        </span>
                      </td>

                      {/* Requesting Hospital */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-[170px]">
                        <div className="font-semibold truncate" title={order.hospital?.name}>{order.hospital?.name}</div>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {order.hospital?.city}{order.hospital?.state ? `, ${order.hospital.state}` : ''}
                        </span>
                      </td>

                      {/* Providing Hospital */}
                      <td className="py-3.5 px-4 text-slate-700 max-w-[170px]">
                        <div className="font-semibold truncate" title={order.fulfillingHospital?.name}>{order.fulfillingHospital?.name}</div>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {order.fulfillingHospital?.city}{order.fulfillingHospital?.state ? `, ${order.fulfillingHospital.state}` : ''}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                        {order.quantity}
                      </td>

                      {/* Settlement Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900">
                        {formatCurrency(order.settlementAmount || order.totalAmount)}
                      </td>

                      {/* Current Status */}
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={order.status} />
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        <StatusBadge status={order.paymentStatus || (isPaid ? 'paid' : 'pending')} />
                      </td>

                      {/* Order Date */}
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatDate(order.orderDate)}
                      </td>

                      {/* View Dossier Button */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
                          title="View Order Dossier"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="block md:hidden divide-y divide-slate-100">
            {filteredOrders.map((order) => {
              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-slate-900">#{order.orderId}</span>
                        {order.urgency === 'Emergency' && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-black uppercase bg-red-100 text-red-700 border border-red-200">
                            STAT
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-sm text-slate-800 mt-0.5">{order.medicineName}</div>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 font-mono">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Buyer</span>
                      <span className="font-bold text-slate-800 truncate block">{order.hospital?.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Seller</span>
                      <span className="font-bold text-slate-800 truncate block">{order.fulfillingHospital?.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Qty / Batch</span>
                      <span className="font-bold text-slate-800">{order.quantity} units • {order.batchNo}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Settlement</span>
                      <span className="font-black text-slate-900">{formatCurrency(order.settlementAmount || order.totalAmount)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs text-slate-500" onClick={(e) => e.stopPropagation()}>
                    <span className="font-mono text-[11px]">{formatDate(order.orderDate)}</span>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Dossier</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* Complete Order Details Dossier Modal (Section 16, 17, 18, 21, 33, 43) */}
      {selectedOrder && (
        <OrderDetailsModal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
          role="admin"
          onAdminAdvanceStatus={(order, targetStatus) => {
            handleOpenStatusConfirm(order, targetStatus);
          }}
        />
      )}

      {/* Confirmation Dialog for Status Change */}
      {confirmStatusModal.isOpen && (
        <Modal
          isOpen={confirmStatusModal.isOpen}
          onClose={() => setConfirmStatusModal({ isOpen: false, order: null, targetStatus: '', note: '', isSubmitting: false })}
          title="Confirm Order Status Transition"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-slate-800">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Administrative Protocol:</span> Transition Order{' '}
                <span className="font-mono font-bold">#{confirmStatusModal.order?.orderId}</span> to{' '}
                <span className="font-bold uppercase tracking-wider text-amber-950">{confirmStatusModal.targetStatus}</span>?
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Audit Note / Dispatch Remark (Optional):</label>
              <textarea
                value={confirmStatusModal.note}
                onChange={(e) => setConfirmStatusModal((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="e.g. Cold-chain seal inspected, airway bill assigned, or physical intake verified..."
                rows="3"
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmStatusModal({ isOpen: false, order: null, targetStatus: '', note: '', isSubmitting: false })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={confirmStatusModal.isSubmitting}
                onClick={handleConfirmStatusChange}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow transition-all cursor-pointer disabled:opacity-50"
              >
                {confirmStatusModal.isSubmitting ? 'Updating...' : `Confirm → ${confirmStatusModal.targetStatus}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default AdminOrders;
