import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { 
  Boxes, 
  ShoppingBag, 
  TrendingUp, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle,
  Send,
  PlusCircle,
  Truck,
  Sparkles,
  ShieldCheck,
  Calendar,
  Filter,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Layers,
  Activity,
  FileCheck2,
  Building2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { fetchHospitalDashboard, fetchInventory } from '../../store/slices/hospitalSlice';
import PurchasesBarChart from '../../components/charts/PurchasesBarChart';
import SalesBarChart from '../../components/charts/SalesBarChart';
import ProfitabilityComboChart from '../../components/charts/ProfitabilityComboChart';
import FloatingNetworkHero from '../../components/spatial/FloatingNetworkHero';
import SpatialInventoryOverview from '../../components/spatial/SpatialInventoryOverview';
import LiveSupplyNetworkMap from '../../components/spatial/LiveSupplyNetworkMap';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { calculateMedicineExpiry } from '../../utils/expiryUtils';
import { getLiveHospitalRecord } from '../../services/storage';

export const HospitalDashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { dashboardData, inventory = [], isLoading } = useSelector((state) => state.hospital);

  const [timeRange, setTimeRange] = useState('6M'); // 7D | 30D | 3M | 6M | 1Y
  const [hospitalRecord, setHospitalRecord] = useState(() => 
    getLiveHospitalRecord(user?.hospitalId || user?.id) || user
  );

  useEffect(() => {
    const updateRecord = () => {
      const rec = getLiveHospitalRecord(user?.hospitalId || user?.id);
      if (rec) setHospitalRecord(rec);
    };
    updateRecord();
    window.addEventListener('storage', updateRecord);
    return () => window.removeEventListener('storage', updateRecord);
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      dispatch(fetchHospitalDashboard(user.id));
      dispatch(fetchInventory(user.id));
    }
  }, [dispatch, user?.id]);

  // Derived real-time inventory statistics from single source of truth
  const inventoryMetrics = useMemo(() => {
    const totalBatches = inventory.length;
    const totalUnits = inventory.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);

    let expiredBatches = 0;
    let expiredUnits = 0;
    let availableUnits = 0;

    inventory.forEach((m) => {
      const isDisposed = m.status === 'disposed';
      const qty = Number(m.quantity) || 0;
      const exp = calculateMedicineExpiry(m.expiryDate, qty);

      if (exp.isExpired) {
        expiredBatches++;
        expiredUnits += qty;
      } else if (!isDisposed) {
        availableUnits += qty;
      }
    });

    return {
      totalBatches,
      totalUnits,
      expiredBatches,
      expiredUnits,
      availableUnits,
    };
  }, [inventory]);

  if (isLoading && !dashboardData && inventory.length === 0) {
    return <LoadingSpinner text="Compiling Pharmacy Supply Chain Telemetry..." />;
  }

  const stats = dashboardData?.stats || {
    totalMedicines: inventoryMetrics.totalUnits,
    activeSkus: inventoryMetrics.totalBatches,
    monthlyPurchases: 0,
    monthlySales: 0,
    profitabilityPercent: 0,
    pendingRequestsCount: 0,
    activeShipmentsCount: 0,
  };

  if (isLoading && !dashboardData && inventory.length === 0) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <LoadingSpinner size="lg" text="Loading hospital analytics and inventory ledger..." />
      </div>
    );
  }

  return (
    <div className="space-y-7 pb-10">
      
      {/* PERSISTENT VERIFICATION STATUS CARD (Section 10 Requirement) */}
      {(() => {
        const status = (hospitalRecord?.status || user?.status || 'verified').toLowerCase();
        
        if (status === 'pending' || status === 'under_review') {
          return (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-amber-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-700">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-amber-950">Registration Under Review</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-800">
                      Pending Verification
                    </span>
                  </div>
                  <p className="text-xs text-amber-800/90 mt-0.5 max-w-2xl font-medium">
                    Your hospital registration is currently under review. Operational features (Inventory, Medicine requests/orders, and Marketplace) will remain restricted until verified by the MEDEX Administration.
                  </p>
                </div>
              </div>
              <Link
                to="/hospital/profile"
                className="px-4 py-2 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-xl transition-colors whitespace-nowrap self-start sm:self-center"
              >
                View Verification Status
              </Link>
            </div>
          );
        }

        if (status === 'rejected') {
          return (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 text-rose-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-700">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-rose-950">Hospital Registration Rejected</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-200 text-rose-800">
                      Application Declined
                    </span>
                  </div>
                  <p className="text-xs text-rose-800/90 mt-0.5 font-medium">
                    Your hospital registration was rejected.
                  </p>
                  {hospitalRecord?.rejectionReason && (
                    <div className="mt-2 p-2.5 rounded-xl bg-white/80 border border-rose-200 text-xs font-medium text-rose-900">
                      <span className="font-bold">Rejection Reason: </span>
                      {hospitalRecord.rejectionReason}
                    </div>
                  )}
                </div>
              </div>
              <Link
                to="/hospital/profile"
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors whitespace-nowrap self-start sm:self-center shadow-sm"
              >
                Review Application & Resubmit
              </Link>
            </div>
          );
        }

        if (status === 'suspended') {
          return (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-5 text-purple-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-700">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-purple-950">Hospital Account Suspended</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-200 text-purple-800">
                      Administrative Hold
                    </span>
                  </div>
                  <p className="text-xs text-purple-800/90 mt-0.5 font-medium">
                    Your hospital account has been suspended.
                  </p>
                  {hospitalRecord?.suspensionReason && (
                    <div className="mt-2 p-2.5 rounded-xl bg-white/80 border border-purple-200 text-xs font-medium text-purple-900">
                      <span className="font-bold">Suspension Reason: </span>
                      {hospitalRecord.suspensionReason}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-3.5 py-2 text-xs font-semibold text-purple-800 bg-purple-100 rounded-xl whitespace-nowrap self-start sm:self-center">
                Contact MEDEX Support
              </div>
            </div>
          );
        }

        // Verified status
        return (
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-emerald-950 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-700">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-emerald-950">Verified Healthcare Facility</span>
                  <span className="px-2 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/90 font-medium">
                  Your hospital has been successfully verified. You can now access MEDEX services.
                </p>
              </div>
            </div>
            <div className="text-[10px] text-emerald-700 font-mono font-semibold self-start sm:self-center">
              Facility ID: {hospitalRecord?.id || user?.id || 'HOSP-VERIFIED'}
            </div>
          </div>
        );
      })()}

      {/* 1. SOPHISTICATED SPATIAL HERO */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#091522] via-[#0E2433] to-[#0A1B28] p-6 sm:p-8 text-white border border-primary-500/25 shadow-2xl overflow-hidden">
        {/* Glow backdrop illumination */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-grid-dark opacity-25 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Hero Narrative */}
          <div className="lg:col-span-6 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 border border-primary-400/30 text-cyan-300 text-xs font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>HOSPITAL SUPPLY INTELLIGENCE • MUMBAI CLUSTER</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Your Hospital Supply, <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-300">
                Connected.
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 font-normal leading-relaxed max-w-xl">
              Manage complete hospital inventory, discover peer exchanges with automated shelf-life discounts, track requisitions, and coordinate cold-chain logistics.
            </p>

            {/* Hero Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                to="/hospital/inventory"
                className="px-5 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-secondary-950 font-extrabold text-xs shadow-lg shadow-primary-500/30 transition-all flex items-center gap-2 hover:scale-[1.02]"
              >
                <Boxes className="w-4 h-4" />
                <span>My Inventory</span>
              </Link>

              <Link
                to="/hospital/reports"
                className="px-5 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold text-xs border border-indigo-500/40 transition-all flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>Reports & Analytics</span>
              </Link>

              <Link
                to="/hospital/marketplace"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs border border-white/20 transition-all flex items-center gap-2"
              >
                <ShoppingBag className="w-4 h-4 text-cyan-300" />
                <span>Marketplace</span>
              </Link>
            </div>

            {/* Quick Metrics Bar */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-mono">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Verified Peer Nodes</span>
                <span className="text-slate-200 font-bold">48 Hospitals Active</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Bio-Centre Partner</span>
                <span className="text-emerald-400 font-bold">GreenBio Medical Waste Centre</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Cold Chain SLA</span>
                <span className="text-cyan-300 font-bold">99.8% Compliant</span>
              </div>
            </div>
          </div>

          {/* Right Hero 3D Digital Logistics Network */}
          <div className="lg:col-span-6 w-full">
            <FloatingNetworkHero />
          </div>

        </div>
      </div>

      {/* 2. DYNAMIC KPI SYSTEM (Total Inventory, Expired Medicines, Disposal Required, Operating Margins) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: TOTAL INVENTORY */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-primary-900 to-secondary-900 text-white border border-primary-500/30 shadow-elevated flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase font-bold text-cyan-300 tracking-wider">
                Total Inventory
              </span>
              <div className="w-8 h-8 rounded-lg bg-white/10 text-cyan-300 flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
            </div>

            <div className="pt-2">
              <div className="text-3xl font-extrabold font-mono tracking-tight text-white">
                {inventoryMetrics.totalUnits.toLocaleString()} <span className="text-sm font-normal text-slate-300">units</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold mt-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{inventoryMetrics.totalBatches} total stored batches</span>
              </div>
            </div>
          </div>

          {/* Miniature Stock Pill */}
          <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-slate-300">
            <span>Available: {inventoryMetrics.availableUnits.toLocaleString()} units</span>
            <Link to="/hospital/inventory" className="text-cyan-300 hover:underline font-bold">
              View Inventory →
            </Link>
          </div>
        </div>

        {/* KPI 2: EXPIRED / QUARANTINED STOCK */}
        <div className="p-5 rounded-2xl bg-white border border-rose-200 shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-mono uppercase font-bold text-rose-700 tracking-wider">
                Expired Stock
              </span>
              <div className="text-2xl font-extrabold font-mono tracking-tight text-rose-800 mt-1">
                {inventoryMetrics.expiredBatches} <span className="text-sm font-normal text-rose-600">batches</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-rose-900 font-semibold space-y-0.5">
            <div className="flex items-center justify-between font-bold text-rose-800">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>{inventoryMetrics.expiredUnits.toLocaleString()} units expired</span>
              </span>
              <Link to="/hospital/inventory" className="text-rose-700 hover:underline text-[11px] font-extrabold">
                Review →
              </Link>
            </div>
            <p className="text-[10px] text-rose-700 font-normal">
              Quarantined from marketplace exchange
            </p>
          </div>
        </div>

        {/* KPI 3: REDISTRIBUTION & PROCUREMENT SAVINGS */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-mono uppercase font-bold text-slate-500 tracking-wider">
                Redistribution Revenue
              </span>
              <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 mt-1">
                ₹{stats?.monthlySales?.toLocaleString() || 0}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-900 font-semibold space-y-0.5">
            <div className="flex items-center gap-1 font-bold text-emerald-700">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              <span>Surplus Recovered</span>
            </div>
            <p className="text-[11px] text-emerald-800">
              {stats?.pendingRequestsCount ?? 0} incoming peer requests pending
            </p>
          </div>
        </div>

        {/* KPI 4: OPERATING MARGIN % */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-card hover:shadow-card-hover transition-all flex flex-col justify-between space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[11px] font-mono uppercase font-bold text-slate-500 tracking-wider">
                Operating Margin
              </span>
              <div className="text-2xl font-extrabold font-mono tracking-tight text-slate-900 mt-1">
                {stats?.profitabilityPercent ?? 18.5}%
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-xs text-amber-900 font-semibold space-y-0.5">
            <div className="flex items-center gap-1 font-bold text-amber-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Target Efficiency</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Zero-waste exchange redistribution
            </p>
          </div>
        </div>

      </div>

      {/* 3. QUICK ACTION TILES (Hospital Workflow Shortcuts) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Action 1: My Inventory */}
        <Link
          to="/hospital/inventory"
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-primary-400 hover:shadow-md transition-all flex items-start gap-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 group-hover:bg-primary-600 group-hover:text-white transition-all flex items-center justify-center font-bold flex-shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 font-bold text-sm text-slate-900 group-hover:text-primary-700">
              <span>My Inventory</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Add and manage all medicines, stock levels, batches, and shelf life parameters.
            </p>
          </div>
        </Link>

        {/* Action 2: Reports & Analytics */}
        <Link
          to="/hospital/reports"
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all flex items-start gap-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-all flex items-center justify-center font-bold flex-shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 font-bold text-sm text-slate-900 group-hover:text-indigo-700">
              <span>Reports & Analytics</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Track purchase vs sales velocity, procurement savings, and organization-wide analytics.
            </p>
          </div>
        </Link>

        {/* Action 3: Marketplace */}
        <Link
          to="/hospital/marketplace"
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all flex items-start gap-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-all flex items-center justify-center font-bold flex-shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 font-bold text-sm text-slate-900 group-hover:text-emerald-700">
              <span>Peer Marketplace</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Discover verified medicine exchanges and near-expiry stock discounts across peer hospitals.
            </p>
          </div>
        </Link>

      </div>

      {/* 4. SPATIAL INVENTORY WAREHOUSE VISUALIZATION */}
      <SpatialInventoryOverview />

      {/* 5. DATA VISUALIZATION SECTION WITH TIMEFRAME TOGGLE */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Procurement & Sales Velocity Analytics
              </h3>
              <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Demo Projection
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Dual-view financial trends benchmarked against historical concession concessions.
            </p>
          </div>

          {/* Timeframe selector: 7D, 30D, 3M, 6M, 1Y */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-mono font-bold">
            {['7D', '30D', '3M', '6M', '1Y'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  timeRange === range
                    ? 'bg-white text-primary-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Purchases Monthly */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Monthly Procurement Spend</h4>
                <p className="text-[11px] text-slate-400">Total drug acquisition expenditure</p>
              </div>
              <span className="text-[10px] font-mono font-bold text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg border border-primary-200">
                Spend Velocity
              </span>
            </div>
            <PurchasesBarChart data={dashboardData?.purchasesMonthly} />
          </div>

          {/* Chart 2: Sales Monthly */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-slate-800">Monthly Surplus Sales</h4>
                <p className="text-[11px] text-slate-400">Near-expiry revenue recovered from peers</p>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Surplus Recovery
              </span>
            </div>
            <SalesBarChart data={dashboardData?.salesMonthly} />
          </div>

        </div>

        {/* Chart 3: Combo Chart - Profitability & Margin Trend */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800">5-Month Margin & Capital Turnover Analysis</h4>
              <p className="text-[11px] text-slate-400">
                Comparative correlation of sales recovery volume against procurement cost and net gross yield.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Optimal Target: &gt; 25%
            </span>
          </div>
          <ProfitabilityComboChart data={dashboardData?.profitabilityTrend} />
        </div>
      </div>

      {/* 6. LIVE SUPPLY NETWORK COMPONENT */}
      <LiveSupplyNetworkMap />

    </div>
  );
};

export default HospitalDashboard;
