import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { 
  FileSpreadsheet, 
  Calendar, 
  Boxes, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Search, 
  Filter, 
  ShieldCheck, 
  Info,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  TrendingUp,
  ShoppingBag
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import EmptyState from '../../components/common/EmptyState';
import { MetricCardSkeleton, TableSkeleton } from '../../components/common/Skeleton';
import StatusBadge from '../../components/common/StatusBadge';
import { hospitalService } from '../../services/hospitalService';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  Completed: '#10B981',
  Delivered: '#0A6E79',
  'In Transit': '#3B82F6',
  Paid: '#6366F1',
  Pending: '#F59E0B',
  Cancelled: '#EF4444',
};

export const HospitalReports = () => {
  const { user } = useSelector((state) => state.auth);
  const sessionHospitalId = useMemo(() => {
    try {
      const raw = localStorage.getItem('sms_auth_session');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.user?.hospitalId || parsed?.user?.id || null;
    } catch {
      return null;
    }
  }, []);
  const hospitalId = user?.hospitalId || user?.id || sessionHospitalId;

  // Filters State
  const [dateFilter, setDateFilter] = useState('30D'); // 'TODAY' | '7D' | '30D' | '90D' | 'CUSTOM'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [reportType, setReportType] = useState('ALL'); // 'ALL' | 'PURCHASES' | 'SALES'
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Data State
  const [tradesData, setTradesData] = useState({ trades: [], pagination: { total: 0, pages: 1 } });
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Compute effective date bounds for API query
  const dateBounds = useMemo(() => {
    const now = new Date();
    let startDate = null;
    let endDate = now.toISOString().split('T')[0];

    if (dateFilter === 'TODAY') {
      startDate = now.toISOString().split('T')[0];
    } else if (dateFilter === '7D') {
      const d = new Date(now.getTime() - 7 * 86400000);
      startDate = d.toISOString().split('T')[0];
    } else if (dateFilter === '30D') {
      const d = new Date(now.getTime() - 30 * 86400000);
      startDate = d.toISOString().split('T')[0];
    } else if (dateFilter === '90D') {
      const d = new Date(now.getTime() - 90 * 86400000);
      startDate = d.toISOString().split('T')[0];
    } else if (dateFilter === 'CUSTOM') {
      startDate = customStart || null;
      endDate = customEnd || null;
    }

    return { startDate, endDate };
  }, [dateFilter, customStart, customEnd]);

  // Fetch Report Data from Backend
  const loadReports = async (showToast = false) => {
    if (!hospitalId) return;
    try {
      if (showToast) setIsRefreshing(true);
      else setIsLoading(true);

      const [tradesRes, summaryRes] = await Promise.all([
        hospitalService.getTrades({
          hospitalId,
          page,
          limit,
          status: statusFilter,
          search: searchQuery,
          startDate: dateBounds.startDate,
          endDate: dateBounds.endDate,
          reportType,
        }),
        hospitalService.getTradingSummary({
          hospitalId,
          startDate: dateBounds.startDate,
          endDate: dateBounds.endDate,
        })
      ]);

      setTradesData(tradesRes || { trades: [], pagination: { total: 0, pages: 1 } });
      setSummaryData(summaryRes || null);
      if (showToast) toast.success('Report metrics updated');
    } catch (err) {
      console.error('Failed to load reports:', err);
      toast.error('Failed to fetch trading report data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [hospitalId, dateFilter, customStart, customEnd, statusFilter, page, reportType]);

  // Handle Search submit / debounce
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadReports();
  };

  // CSV Export Action
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await hospitalService.exportTradesCSV({
        hospitalId,
        startDate: dateBounds.startDate,
        endDate: dateBounds.endDate,
        status: statusFilter,
        search: searchQuery,
        reportType,
      });
      toast.success('Trading report exported to CSV');
    } catch (err) {
      toast.error('Failed to export CSV: ' + (err?.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  const metrics = summaryData?.metrics || {
    totalTrades: 0,
    totalPurchases: 0,
    totalSales: 0,
    totalQuantityPurchased: 0,
    totalQuantitySold: 0,
    totalPurchaseAmount: 0,
    totalSalesAmount: 0,
    completedTrades: 0,
    cancelledTrades: 0,
    pendingTrades: 0,
    ratios: { purchasesPercentage: 0, salesPercentage: 0 },
  };

  // Chart 1 Data: Time Series
  const comparativeChartData = useMemo(() => {
    if (summaryData?.timeSeries && summaryData.timeSeries.length > 0) {
      return summaryData.timeSeries.map((t) => ({
        interval: t.month,
        received: t.purchaseUnits || 0,
        sent: t.saleUnits || 0,
      }));
    }
    return [
      { interval: 'Current Period', received: metrics.totalQuantityPurchased, sent: metrics.totalQuantitySold }
    ];
  }, [summaryData, metrics]);

  // Chart 2 Data: Request Lifecycle Distribution
  const requestDistributionData = useMemo(() => {
    const completed = metrics.completedTrades;
    const pending = metrics.pendingTrades;
    const cancelled = metrics.cancelledTrades;

    if (completed === 0 && pending === 0 && cancelled === 0) {
      return [{ name: 'No Activity', value: 1, color: '#CBD5E1' }];
    }

    const res = [];
    if (completed > 0) res.push({ name: 'Completed', value: completed, color: STATUS_COLORS.Completed });
    if (pending > 0) res.push({ name: 'In Progress', value: pending, color: STATUS_COLORS.Pending });
    if (cancelled > 0) res.push({ name: 'Cancelled', value: cancelled, color: STATUS_COLORS.Cancelled });
    return res;
  }, [metrics]);

  // Filtered trades by Report Type
  const displayTrades = useMemo(() => {
    let list = tradesData.trades || [];
    if (reportType === 'PURCHASES') {
      list = list.filter((t) => (t.buyerHospitalId || t.buyer_hospital_id) === hospitalId);
    } else if (reportType === 'SALES') {
      list = list.filter((t) => (t.sellerHospitalId || t.seller_hospital_id) === hospitalId);
    }
    return list;
  }, [tradesData.trades, reportType, hospitalId]);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Trading Reports & Operational Analytics
            </h1>
            <span className="px-2.5 py-0.5 text-[11px] font-mono font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              CDSCO AUDIT READY
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            Authoritative ledger of hospital-to-hospital medicine trades, procurement volumes, and capital velocity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadReports(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all hover:scale-[1.02]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isExporting ? 'Exporting...' : 'Export Report (CSV)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Control Bar: Date Range + Filters + Search */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Date Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-primary-600" /> Timeframe:
            </span>
            {[
              { id: 'TODAY', label: 'Today' },
              { id: '7D', label: '7 Days' },
              { id: '30D', label: '30 Days' },
              { id: '90D', label: '90 Days' },
              { id: 'CUSTOM', label: 'Custom Range' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setDateFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  dateFilter === tab.id
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setPage(1); }}
                className="px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:border-primary-500"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setPage(1); }}
                className="px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:border-primary-500"
              />
            </div>
          )}
        </div>

        {/* Secondary Filter Row: Search + Status + Report Type */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Report Type Selector */}
            <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 text-xs">
              {['ALL', 'PURCHASES', 'SALES'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setReportType(type);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    reportType === type ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'ALL' ? 'All Trades' : type === 'PURCHASES' ? 'Purchases Only' : 'Sales Only'}
                </button>
              ))}
            </div>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-primary-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed / Delivered</option>
              <option value="paid">Paid (Escrow Locked)</option>
              <option value="in_transit">In Transit</option>
              <option value="accepted">Accepted (Preparing)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search medicine, batch, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-primary-500"
            />
          </form>
        </div>
      </div>

      {/* 3. Summary Metric Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Purchases Volume */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Total Purchases
              </span>
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-teal-700 font-mono">
              ₹{(metrics.totalPurchaseAmount || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              {metrics.totalPurchases} orders • {metrics.totalQuantityPurchased.toLocaleString()} units acquired
            </p>
          </div>

          {/* Card 2: Sales Volume */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Total Sales
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              ₹{(metrics.totalSalesAmount || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              {metrics.totalSales} orders • {metrics.totalQuantitySold.toLocaleString()} units supplied
            </p>
          </div>

          {/* Card 3: Purchases vs Sales Ratio */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Purchase vs Sales Ratio
              </span>
              <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono flex items-center gap-2">
              <span>{metrics.ratios?.purchasesPercentage || 0}%</span>
              <span className="text-xs text-slate-400 font-normal">/</span>
              <span className="text-emerald-600">{metrics.ratios?.salesPercentage || 0}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
              <div 
                className="bg-teal-600 h-full transition-all duration-500" 
                style={{ width: `${metrics.ratios?.purchasesPercentage || 0}%` }}
                title={`Purchases: ${metrics.ratios?.purchasesPercentage || 0}%`}
              />
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${metrics.ratios?.salesPercentage || 0}%` }}
                title={`Sales: ${metrics.ratios?.salesPercentage || 0}%`}
              />
            </div>
          </div>

          {/* Card 4: Trade Status Fulfillment */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Fulfillment Status
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono">
              {metrics.completedTrades} <span className="text-xs text-slate-500 font-normal">completed</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {metrics.pendingTrades} in pipeline • {metrics.cancelledTrades} cancelled
            </p>
          </div>
        </div>
      )}

      {/* 4. Charts Section: Trading Movement & Lifecycle Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Bar Chart */}
        <div className="lg:col-span-8 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Trading Velocity (Purchases vs Sales)
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Physical unit quantities transacted across authorized peer hospitals.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Units
            </span>
          </div>

          <div className="w-full h-72">
            {metrics.totalTrades === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <ShoppingBag className="w-8 h-8 mb-2 stroke-1" />
                <p>No trading activity for this period.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="interval" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(val, name) => [`${val} units`, name === 'received' ? 'Purchased' : 'Sold']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="received" name="Purchases (Units)" fill="#0A6E79" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="sent" name="Sales (Units)" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Donut Chart */}
        <div className="lg:col-span-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Trade Status Distribution
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Fulfillment state breakdown of transacted requisitions.
            </p>
          </div>

          <div className="w-full h-52 flex items-center justify-center">
            {metrics.totalTrades === 0 ? (
              <div className="text-slate-400 text-xs flex flex-col items-center">
                <Clock className="w-6 h-6 mb-1 text-slate-300" />
                <span>Zero records in timeframe</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={requestDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {requestDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`${val} Trades`, 'Volume']}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px]">
            {requestDistributionData.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 font-medium">{item.name}:</span>
                <strong className="text-slate-900 font-mono">{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Itemized Transactions Audit Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden space-y-3 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Itemized Operational Trading Ledger
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Statutory verification ledger of medicine exchanges and financial transactions.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {tradesData.pagination?.total || displayTrades.length} total trades recorded
          </span>
        </div>

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : displayTrades.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No medicines matched your filters' : 'No trading activity for this period'}
            description={
              searchQuery
                ? 'Try adjusting your search query or removing status filters.'
                : 'Select a wider date range or submit an exchange requisition on the marketplace.'
            }
            actionText={searchQuery ? 'Clear Search' : 'View Last 90 Days'}
            onAction={() => {
              if (searchQuery) { setSearchQuery(''); setPage(1); }
              else { setDateFilter('90D'); setPage(1); }
            }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-2.5 px-3">Trade ID</th>
                    <th className="py-2.5 px-3">Operation</th>
                    <th className="py-2.5 px-3">Medicine & Batch</th>
                    <th className="py-2.5 px-3">Units</th>
                    <th className="py-2.5 px-3">Counterparty Hospital</th>
                    <th className="py-2.5 px-3">Unit Price</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayTrades.map((row) => {
                    const isBuyer = (row.buyerHospitalId || row.buyer_hospital_id) === hospitalId;
                    const counterparty = isBuyer 
                      ? (row.sellerHospitalName || row.seller_hospital_name || 'Supplying Facility')
                      : (row.buyerHospitalName || row.buyer_hospital_name || 'Procuring Facility');

                    return (
                      <tr key={row.id || row.transactionId} className="hover:bg-slate-50/70 transition-colors font-medium text-slate-700">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {row.transactionId || row.transaction_id || row.id}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBuyer ? 'bg-teal-50 text-teal-800' : 'bg-emerald-50 text-emerald-800'
                          }`}>
                            {isBuyer ? 'Purchase' : 'Sale'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{row.medicineName || row.medicine_name}</div>
                          <div className="text-[10px] font-mono text-slate-400">Batch: {row.batchNo || row.batch_no || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-800">
                          {row.quantity}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {counterparty}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600">
                          ₹{Number(row.unitPrice || row.unit_price || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          ₹{Number(row.totalAmount || row.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400 text-right">
                          {(row.transactionDate || row.transaction_date || row.createdAt || row.created_at || '').split('T')[0]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {tradesData.pagination && tradesData.pagination.pages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500 font-mono">
                <span>
                  Page {tradesData.pagination.page} of {tradesData.pagination.pages}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={tradesData.pagination.page <= 1}
                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(tradesData.pagination.pages, p + 1))}
                    disabled={tradesData.pagination.page >= tradesData.pagination.pages}
                    className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Compliance Disclaimer Footer */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-700">Audit & Statutory Notice:</p>
          <p>
            All trading records and financial aggregates are computed authoritatively from database transaction ledgers under CDSCO Rule 65 statutory guidelines. Exported CSV reports include unique trade IDs and cryptographic escrow references for official accounting reconciliation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HospitalReports;
