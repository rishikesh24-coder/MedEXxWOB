import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  Boxes, 
  AlertTriangle, 
  AlertCircle,
  ShoppingBag, 
  Package, 
  Layers, 
  ArrowRight, 
  ArrowUpRight, 
  Star, 
  MessageSquare,
  Activity,
  CheckCircle2,
  RefreshCw,
  Eye,
  Check,
  Radio
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell, 
  PieChart, 
  Pie, 
  AreaChart, 
  Area 
} from 'recharts';
import { fetchAdminDashboard } from '../../store/slices/adminSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export const AdminDashboard = () => {
  const dispatch = useDispatch();
  const { dashboardData, isLoading } = useSelector((state) => state.admin);

  useEffect(() => {
    dispatch(fetchAdminDashboard());
  }, [dispatch]);

  const stats = dashboardData?.stats || {
    totalHospitals: 24,
    verifiedHospitals: 19,
    pendingVerification: 4,
    totalMedicines: 42,
    lowStock: 6,
    expiringSoon: 8,
    pendingOrders: 5,
    totalOrders: 38,
  };

  const medicineStockOverview = dashboardData?.medicineStockOverview || [
    { name: 'In Stock', value: 28, color: '#0A6E79' },
    { name: 'Low Stock', value: 6, color: '#F59E0B' },
    { name: 'Out of Stock', value: 3, color: '#EF4444' },
    { name: 'Expired', value: 5, color: '#94A3B8' },
  ];

  const ordersOverview = dashboardData?.ordersOverview || [
    { status: 'Pending', count: 5, color: '#F59E0B' },
    { status: 'Processing', count: 7, color: '#06B6D4' },
    { status: 'Shipped', count: 12, color: '#3B82F6' },
    { status: 'Delivered', count: 11, color: '#10B981' },
    { status: 'Cancelled', count: 3, color: '#EF4444' },
  ];

  const hospitalRegistrationTrend = dashboardData?.hospitalRegistrationTrend || [
    { month: 'Apr', count: 4, verified: 3 },
    { month: 'May', count: 6, verified: 5 },
    { month: 'Jun', count: 9, verified: 8 },
    { month: 'Jul', count: 12, verified: 10 },
    { month: 'Aug', count: 18, verified: 15 },
    { month: 'Sep', count: 24, verified: 19 },
  ];

  const recentActivity = dashboardData?.recentActivity || [
    {
      id: 'act-1',
      type: 'REGISTRATION',
      title: 'New hospital registration received',
      hospital: 'Metro Care Super Speciality',
      time: '15 minutes ago',
      status: 'Pending Audit',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      link: '/admin/verification'
    },
    {
      id: 'act-2',
      type: 'VERIFICATION',
      title: 'Hospital verification approved',
      hospital: 'Apollo Hospital (Bandra Unit)',
      time: '1 hour ago',
      status: 'Verified',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      link: '/admin/hospitals'
    },
    {
      id: 'act-3',
      type: 'STOCK_UPDATE',
      title: 'Medicine stock updated (+150 units)',
      hospital: 'Lilavati Hospital & Research Centre',
      time: '2 hours ago',
      status: 'In Stock',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      link: '/admin/inventory'
    },
    {
      id: 'act-4',
      type: 'NEW_ORDER',
      title: 'New inter-hospital order received',
      hospital: 'Max Super Speciality to Fortis Hospital',
      time: '3 hours ago',
      status: 'Processing',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      link: '/admin/orders'
    },
    {
      id: 'act-5',
      type: 'ORDER_STATUS',
      title: 'Order status changed to Shipped',
      hospital: 'Consignment #ORD-MED-1024',
      time: '4 hours ago',
      status: 'Cold-Chain Transit',
      badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      link: '/admin/orders'
    },
    {
      id: 'act-6',
      type: 'FEEDBACK',
      title: 'Hospital feedback received (5 Stars)',
      hospital: 'City Care Hospital',
      time: '6 hours ago',
      status: 'New Feedback',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      link: '/admin/feedback'
    }
  ];

  const feedbackSummary = dashboardData?.feedbackSummary || {
    total: 12,
    new: 3,
    underReview: 4,
    resolved: 5,
    averageRating: '4.8',
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="py-24">
        <LoadingSpinner text="Compiling National Platform Analytics & Regulatory Audit Telemetry..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Welcome / Supervisory Authority Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#06141F] bg-gradient-to-r from-slate-950 via-[#0a1e2c] to-[#042429] p-6 sm:p-7 text-white border border-teal-500/30 shadow-xl shadow-slate-950/25 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Subtle decorative mesh gradients */}
        <div className="absolute right-0 top-0 w-96 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(13,148,136,0.22),transparent_70%)] pointer-events-none" />
        <div className="absolute left-1/4 bottom-0 w-72 h-32 bg-[radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.12),transparent_70%)] pointer-events-none" />
        
        {/* Left Column: Badge, Heading, Description */}
        <div className="relative z-10 space-y-2.5 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-950/90 border border-teal-400/40 text-teal-300 text-xs font-bold tracking-wide shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">Central National Healthcare Logistics Command</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm leading-tight">
            Administrative Supervisory Dashboard
          </h1>

          <p className="text-xs sm:text-sm text-slate-200/90 font-normal leading-relaxed max-w-2xl">
            Centralized monitoring of accredited hospital networks, critical pharmaceutical inventory velocity, orders fulfillment, and statutory quality compliance.
          </p>
        </div>

        {/* Right Column: Action Buttons */}
        <div className="relative z-10 flex flex-wrap sm:flex-nowrap items-center gap-3 w-full sm:w-auto shrink-0">
          <Link
            to="/admin/verification"
            aria-label="Review pending hospital verifications"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 active:bg-teal-600 text-slate-950 text-xs font-bold shadow-md shadow-teal-950/40 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all cursor-pointer"
          >
            <span>Review Verifications</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </Link>
          <Link
            to="/admin/alerts"
            aria-label="View live platform alerts"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 active:bg-slate-900 text-slate-100 hover:text-white border border-slate-700 hover:border-slate-500 text-xs font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Live Alerts</span>
          </Link>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 1. 8 SUMMARY METRIC CARDS */}
      {/* ============================================================ */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
            Platform Key Performance Indicators
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Real-time sync</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Total Hospitals */}
          <Link 
            to="/admin/hospitals"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary-300 transition-all group"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Hospitals</span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 font-mono">{stats.totalHospitals}</h3>
              <p className="text-[11px] text-teal-700 font-semibold mt-1 flex items-center gap-1">
                <span>Registered institutional participants</span>
              </p>
            </div>
          </Link>

          {/* Card 2: Verified Hospitals */}
          <Link 
            to="/admin/hospitals?status=verified"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Verified Hospitals</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 font-mono">{stats.verifiedHospitals}</h3>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Active trading credentials</span>
              </p>
            </div>
          </Link>

          {/* Card 3: Pending Verification */}
          <Link 
            to="/admin/verification"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-amber-300 transition-all group"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Verification</span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-amber-600 font-mono">{stats.pendingVerification}</h3>
              <p className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Awaiting Form 20B/21B audit</span>
              </p>
            </div>
          </Link>

          {/* Card 4: Total Medicines */}
          <Link 
            to="/admin/medicines"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-primary-300 transition-all group"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Medicines</span>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 font-mono">{stats.totalMedicines}</h3>
              <p className="text-[11px] text-cyan-700 font-semibold mt-1 flex items-center gap-1">
                <span>Unique pharmaceutical lines</span>
              </p>
            </div>
          </Link>

          {/* Card 5: Low Stock */}
          <Link 
            to="/admin/inventory?status=low_stock"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-orange-300 transition-all group"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Low Stock</span>
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-orange-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-orange-600 font-mono">{stats.lowStock}</h3>
              <p className="text-[11px] text-orange-700 font-semibold mt-1 flex items-center gap-1">
                <span>Below institutional threshold</span>
              </p>
            </div>
          </Link>

          {/* Card 6: Expiring Soon */}
          <Link 
            to="/admin/medicines"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-rose-300 transition-all group"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Expiring Soon</span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-rose-600 font-mono">{stats.expiringSoon}</h3>
              <p className="text-[11px] text-rose-700 font-semibold mt-1 flex items-center gap-1">
                <span>Within 60-day shelf life concession</span>
              </p>
            </div>
          </Link>

          {/* Card 7: Pending Orders */}
          <Link 
            to="/admin/orders?status=pending"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-amber-300 transition-all group"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Orders</span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-amber-600 font-mono">{stats.pendingOrders}</h3>
              <p className="text-[11px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                <span>Awaiting dispatch authorization</span>
              </p>
            </div>
          </Link>

          {/* Card 8: Total Orders */}
          <Link 
            to="/admin/orders"
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group"
          >
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 font-mono">{stats.totalOrders}</h3>
              <p className="text-[11px] text-blue-700 font-semibold mt-1 flex items-center gap-1">
                <span>Inter-hospital requisitions processed</span>
              </p>
            </div>
          </Link>

        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. VISUAL ANALYTICS SECTION (A, B, C) */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* A. Medicine Stock Overview */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-black text-slate-900">A. Medicine Stock Overview</h3>
              <p className="text-xs text-slate-400">Inventory breakdown across pharmaceutical depots</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
              CDSCO Live
            </span>
          </div>

          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={medicineStockOverview} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(val, name) => [`${val} Medicines`, 'Inventory Count']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {medicineStockOverview.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            {medicineStockOverview.map((item) => (
              <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium text-[11px]">{item.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* B. Orders Overview */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-black text-slate-900">B. Orders Overview</h3>
              <p className="text-xs text-slate-400">Requisitions pipeline status distribution</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              Pipeline SLA
            </span>
          </div>

          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersOverview} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="status" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(val) => [`${val} Orders`, 'Order Count']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={34}>
                  {ordersOverview.map((entry, index) => (
                    <Cell key={`cell-ord-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            {ordersOverview.slice(0, 4).map((item) => (
              <div key={item.status} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium text-[11px]">{item.status}</span>
                </div>
                <span className="font-mono font-bold text-slate-800">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* C. Hospital Registration Trend */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-sm font-black text-slate-900">C. Hospital Registration Trend</h3>
              <p className="text-xs text-slate-400">Institutional network growth over time</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Network +240%
            </span>
          </div>

          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hospitalRegistrationTrend} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A6E79" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0A6E79" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip 
                  formatter={(val) => [`${val} Hospitals`, 'Total Registered']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="count" stroke="#0A6E79" strokeWidth={2.5} fillOpacity={1} fill="url(#trendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
            <span className="text-[11px] text-slate-400">Accreditation rate</span>
            <span className="font-mono font-bold text-teal-800">
              {stats.verifiedHospitals} of {stats.totalHospitals} Institutions Verified (79.2%)
            </span>
          </div>
        </div>

      </div>

      {/* ============================================================ */}
      {/* 3. RECENT ACTIVITY & HOSPITAL FEEDBACK SUMMARY */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* D. Recent Activity Feed (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-black text-slate-900">D. Recent Platform Activity</h3>
              <p className="text-xs text-slate-400">Live operational events across network nodes</p>
            </div>
            <Link
              to="/admin/audit-logs"
              className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 transition-colors"
            >
              <span>View Audit Logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentActivity.map((act) => (
              <div key={act.id} className="py-3 flex items-start justify-between gap-3 hover:bg-slate-50/70 px-2 rounded-xl transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {act.type.includes('REGISTRATION') ? <Building2 className="w-4 h-4 text-teal-600" /> :
                     act.type.includes('VERIFICATION') ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> :
                     act.type.includes('STOCK') ? <Boxes className="w-4 h-4 text-amber-600" /> :
                     act.type.includes('ORDER') ? <ShoppingBag className="w-4 h-4 text-blue-600" /> :
                     <MessageSquare className="w-4 h-4 text-purple-600" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{act.title}</h4>
                    <p className="text-[11px] text-slate-500">{act.hospital}</p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${act.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {act.status}
                  </span>
                  <span className="text-[10px] text-slate-400">{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hospital Feedback Summary Card (1 Col) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-5">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm font-black text-slate-900">Hospital Feedback Summary</h3>
                <p className="text-xs text-slate-400">Institutional participant satisfaction index</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>

            {/* Big Rating Display */}
            <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-purple-50/60 to-slate-50 border border-purple-100/80 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" />
                ))}
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono">
                {feedbackSummary.averageRating} <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Overall Hospital Satisfaction CSAT Score
              </p>
            </div>

            {/* Breakdown Badges */}
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
              <div className="p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50">
                <div className="text-[10px] text-slate-400 uppercase font-bold">Total Feedback</div>
                <div className="text-base font-black text-slate-800 font-mono mt-0.5">{feedbackSummary.total}</div>
              </div>
              <div className="p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/50">
                <div className="text-[10px] text-amber-600 uppercase font-bold">New Submissions</div>
                <div className="text-base font-black text-amber-700 font-mono mt-0.5">{feedbackSummary.new}</div>
              </div>
              <div className="p-2.5 rounded-xl border border-blue-200/80 bg-blue-50/50">
                <div className="text-[10px] text-blue-600 uppercase font-bold">Under Review</div>
                <div className="text-base font-black text-blue-700 font-mono mt-0.5">{feedbackSummary.underReview}</div>
              </div>
              <div className="p-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50">
                <div className="text-[10px] text-emerald-600 uppercase font-bold">Resolved</div>
                <div className="text-base font-black text-emerald-700 font-mono mt-0.5">{feedbackSummary.resolved}</div>
              </div>
            </div>
          </div>

          {/* Action: View All Feedback */}
          <Link
            to="/admin/feedback"
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <span>View All Feedback</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          </Link>
        </div>

      </div>

    </div>
  );
};

export default AdminDashboard;
