import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  ArrowUpDown, 
  Eye, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  LayoutGrid, 
  List, 
  CheckCircle2, 
  Boxes, 
  ArrowLeftRight,
  TrendingUp,
  Check
} from 'lucide-react';
import { fetchHospitals } from '../../store/slices/adminSlice';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { getStoredItem, KEYS } from '../../services/storage';

export const AdminHospitals = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { hospitals, isLoading } = useSelector((state) => state.admin);

  // Filters & Sorting State (NO pending/rejected filters!)
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  useEffect(() => {
    dispatch(fetchHospitals());
  }, [dispatch]);

  // Load live marketplace inventory and trade requests from storage
  const requests = getStoredItem(KEYS.REQUESTS, []);
  const medicines = getStoredItem(KEYS.MEDICINES, []);

  // DERIVE APPROVED HOSPITALS ONLY (Req: Separate Approved Hospitals from Verification)
  const approvedHospitals = useMemo(() => {
    return hospitals.filter((h) => {
      const s = (h.verification_status || h.verificationStatus || (['verified', 'approved'].includes((h.status || '').toLowerCase()) ? h.status : '')).toLowerCase();
      return s === 'verified' || s === 'approved';
    });
  }, [hospitals]);

  // Compute stats per approved hospital
  const hospitalStatsMap = useMemo(() => {
    const map = {};
    approvedHospitals.forEach((hosp) => {
      const hospMeds = medicines.filter((m) => m.hospitalId === hosp.id);
      const listingsCount = hospMeds.length;
      const totalUnits = hospMeds.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);

      const purchases = requests.filter((r) => r.fromHospitalId === hosp.id);
      const sales = requests.filter((r) => r.toHospitalId === hosp.id);
      const purchasesCount = purchases.length;
      const salesCount = sales.length;
      const totalTrades = purchasesCount + salesCount;
      const purchasePercent = totalTrades > 0 ? Math.round((purchasesCount / totalTrades) * 100) : 0;
      const salesPercent = totalTrades > 0 ? (100 - purchasePercent) : 0;

      map[hosp.id] = {
        listingsCount,
        totalUnits,
        purchasesCount,
        salesCount,
        totalTrades,
        purchasePercent,
        salesPercent,
      };
    });
    return map;
  }, [approvedHospitals, medicines, requests]);

  // Unique locations from approved hospitals for filter
  const uniqueLocations = useMemo(() => {
    const locs = new Set();
    approvedHospitals.forEach((h) => {
      if (h.city) locs.add(h.city);
    });
    return Array.from(locs).sort();
  }, [approvedHospitals]);

  // Summary Metrics (Pertaining strictly to approved directory)
  const totalApprovedHospitals = approvedHospitals.length;
  const approvedMedicines = useMemo(() => {
    const approvedIds = new Set(approvedHospitals.map((h) => h.id));
    return medicines.filter((m) => approvedIds.has(m.hospitalId));
  }, [approvedHospitals, medicines]);

  const totalApprovedListings = approvedMedicines.length;
  const totalApprovedUnits = approvedMedicines.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
  const activeTradingCount = approvedHospitals.filter((h) => {
    const s = hospitalStatsMap[h.id];
    return s && s.totalTrades > 0;
  }).length;

  // Filter & Sort Logic
  const filteredHospitals = useMemo(() => {
    return approvedHospitals.filter((hosp) => {
      const stats = hospitalStatsMap[hosp.id] || { listingsCount: 0, totalTrades: 0 };

      // Search matching name, city, state, reg no, email, phone
      const matchesSearch = 
        !searchTerm.trim() ||
        hosp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hosp.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        hosp.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (hosp.registrationNo && hosp.registrationNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (hosp.email && hosp.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (hosp.phone && hosp.phone.toLowerCase().includes(searchTerm.toLowerCase()));

      // Location filter
      const matchesLocation = locationFilter === 'all' || hosp.city?.toLowerCase() === locationFilter.toLowerCase();

      // Activity filter
      let matchesActivity = true;
      if (activityFilter === 'has_listings') {
        matchesActivity = stats.listingsCount > 0;
      } else if (activityFilter === 'has_trades') {
        matchesActivity = stats.totalTrades > 0;
      } else if (activityFilter === 'inactive') {
        matchesActivity = stats.listingsCount === 0 && stats.totalTrades === 0;
      }

      return matchesSearch && matchesLocation && matchesActivity;
    }).sort((a, b) => {
      const statsA = hospitalStatsMap[a.id] || { listingsCount: 0, totalTrades: 0 };
      const statsB = hospitalStatsMap[b.id] || { listingsCount: 0, totalTrades: 0 };

      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (sortBy === 'date-desc') {
        const dateA = new Date(a.verifiedDate || a.registeredDate || '2024-01-01');
        const dateB = new Date(b.verifiedDate || b.registeredDate || '2024-01-01');
        return dateB - dateA;
      }
      if (sortBy === 'date-asc') {
        const dateA = new Date(a.verifiedDate || a.registeredDate || '2024-01-01');
        const dateB = new Date(b.verifiedDate || b.registeredDate || '2024-01-01');
        return dateA - dateB;
      }
      if (sortBy === 'listings-desc') return statsB.listingsCount - statsA.listingsCount;
      if (sortBy === 'listings-asc') return statsA.listingsCount - statsB.listingsCount;
      if (sortBy === 'trades-desc') return statsB.totalTrades - statsA.totalTrades;
      return 0;
    });
  }, [approvedHospitals, searchTerm, locationFilter, activityFilter, sortBy, hospitalStatsMap]);

  return (
    <div className="space-y-6">
      
      {/* 1. PAGE HEADER (Dedicated to Approved Network Directory) */}
      <div className="bg-gradient-to-r from-secondary-950 via-secondary-900 to-primary-950 rounded-2xl p-5 sm:p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              APPROVED DIRECTORY
            </span>
            <span className="text-xs text-slate-400 font-mono">Active Institutional Network</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Approved Hospitals Directory</h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-normal leading-relaxed">
            Hospitals verified and accredited in the MedEx network. View submitted registration dossiers, active medicine listings, and trading activity.
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          <div className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md text-right">
            <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Approved Network</div>
            <div className="text-xl font-black text-white font-mono flex items-center justify-end gap-1.5">
              <span>{totalApprovedHospitals} Hospitals</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Approved Hospitals</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-2">{totalApprovedHospitals}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Accredited network partners</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Medicine Listings</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-cyan-700 font-mono mt-2">{totalApprovedListings}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Active catalogue listings</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Stock Units</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-primary-800 font-mono mt-2">{totalApprovedUnits.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Available physical medicine units</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Trading Nodes</span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-teal-700 font-mono mt-2">{activeTradingCount}</div>
          <p className="text-[11px] text-slate-500 mt-0.5">Hospitals with trade activity</p>
        </div>

      </div>

      {/* 3. DIRECTORY CONTROLS (Search, Location, Activity, Sort, View Toggle — NO Status Filter with Pending/Rejected) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              <span>Showing {filteredHospitals.length} Approved Network {filteredHospitals.length === 1 ? 'Hospital' : 'Hospitals'}</span>
            </span>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-end sm:self-auto">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'cards' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search approved hospital, city, reg ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
            />
          </div>

          {/* Location Filter */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Locations ({uniqueLocations.length} cities)</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Activity Filter */}
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Activity Levels</option>
              <option value="has_listings">With Medicine Listings</option>
              <option value="has_trades">With Trade Activity</option>
              <option value="inactive">Inactive (No listings or trades)</option>
            </select>
          </div>

        </div>

        {/* Sort Bar */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium">Sort results:</span>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="date-desc">Approval Date: Newest First</option>
              <option value="date-asc">Approval Date: Oldest First</option>
              <option value="name-asc">Hospital Name (A-Z)</option>
              <option value="name-desc">Hospital Name (Z-A)</option>
              <option value="listings-desc">Medicine Listings (High to Low)</option>
              <option value="trades-desc">Trade Activity (High to Low)</option>
            </select>
          </div>
        </div>

      </div>

      {/* 4. APPROVED HOSPITALS DIRECTORY VIEW: TABLE OR CARDS */}
      {isLoading && approvedHospitals.length === 0 ? (
        <div className="py-16">
          <LoadingSpinner text="Loading approved hospitals directory..." />
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200/80">
              <thead className="bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Hospital Facility</th>
                  <th className="py-3.5 px-3">Registration ID</th>
                  <th className="py-3.5 px-3">Location</th>
                  <th className="py-3.5 px-3">Approval Date</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3 text-center">Medicines Listed</th>
                  <th className="py-3.5 px-3 text-center min-w-[200px]">Trading Activity</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredHospitals.length > 0 ? (
                  filteredHospitals.map((hosp) => {
                    const stats = hospitalStatsMap[hosp.id] || {
                      listingsCount: 0,
                      totalUnits: 0,
                      purchasesCount: 0,
                      salesCount: 0,
                      totalTrades: 0,
                      purchasePercent: 0,
                      salesPercent: 0,
                    };

                    return (
                      <tr 
                        key={hosp.id} 
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => navigate(`/admin/hospital-details?hospitalId=${encodeURIComponent(hosp.id)}`)}
                      >
                        
                        {/* Hospital Facility */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <span className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors block truncate text-xs" title={hosp.name}>
                                {hosp.name}
                              </span>
                              <span className="text-[11px] text-slate-400 font-normal truncate block" title={hosp.authorizedPerson || 'Medical Director'}>
                                Contact: {hosp.authorizedPerson || 'Medical Director'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Registration ID */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-primary-800 text-[11px] bg-primary-50 px-2 py-0.5 rounded border border-primary-200/60">
                            {hosp.registrationNo || 'REG-PENDING'}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 font-semibold text-slate-800 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{hosp.city || 'India'}, {hosp.state || ''}</span>
                          </div>
                        </td>

                        {/* Approval Date */}
                        <td className="py-3.5 px-3 font-mono text-slate-600 text-xs whitespace-nowrap">
                          {hosp.verifiedDate || hosp.registeredDate || 'Verified'}
                        </td>

                        {/* Status (Approved / Verified Hospital Indicator) */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                            <span>Approved</span>
                          </span>
                        </td>

                        {/* Medicines Listed */}
                        <td className="py-3.5 px-3 text-center whitespace-nowrap">
                          <div className="inline-block text-left">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {stats.listingsCount} {stats.listingsCount === 1 ? 'listing' : 'listings'}
                            </span>
                            {stats.totalUnits > 0 && (
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {stats.totalUnits.toLocaleString('en-IN')} units
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Trading Activity */}
                        <td className="py-3 px-3 text-center">
                          {stats.totalTrades === 0 ? (
                            <div
                              className="w-full min-w-[170px] max-w-[210px] mx-auto py-1 px-1 text-left select-none"
                              title="Trading Activity&#10;Purchases: 0 transactions (0%)&#10;Sales: 0 transactions (0%)&#10;Total: 0 transactions"
                            >
                              {/* Neutral empty-state bar */}
                              <div className="w-full h-2 rounded-full bg-slate-200/90 mb-1.5" />
                              <div className="flex items-center justify-between text-[11px] leading-tight text-slate-500">
                                <span className="font-semibold text-slate-500">No Trading Activity</span>
                                <span className="text-[10px] text-slate-400 font-mono">0 transactions</span>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="w-full min-w-[170px] max-w-[210px] mx-auto py-1 px-1 text-left select-none"
                              title={`Trading Activity\nPurchases: ${stats.purchasesCount} transactions (${stats.purchasePercent}%)\nSales: ${stats.salesCount} transactions (${stats.salesPercent}%)\nTotal: ${stats.totalTrades} transactions`}
                            >
                              {/* Horizontal proportional distribution bar */}
                              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex shadow-inner mb-1.5">
                                {stats.purchasePercent > 0 && (
                                  <div
                                    style={{ width: `${stats.purchasePercent}%` }}
                                    className="h-full bg-teal-500 transition-all duration-300"
                                  />
                                )}
                                {stats.salesPercent > 0 && (
                                  <div
                                    style={{ width: `${stats.salesPercent}%` }}
                                    className="h-full bg-rose-500 transition-all duration-300"
                                  />
                                )}
                              </div>

                              {/* Percentage distribution with direction indicators */}
                              <div className="flex items-center justify-between text-[11px] font-bold font-mono leading-tight mb-0.5">
                                <span className="text-teal-700 flex items-center gap-0.5">
                                  <span className="text-[10px]">↗</span> {stats.purchasePercent}%
                                </span>
                                <span className="text-rose-700 flex items-center gap-0.5">
                                  {stats.salesPercent}% <span className="text-[10px]">↘</span>
                                </span>
                              </div>

                              {/* Accessible text labels and transaction counts */}
                              <div className="flex items-center justify-between text-[10px] text-slate-600 leading-tight">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-slate-700">Purchases</span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    {stats.purchasesCount} {stats.purchasesCount === 1 ? 'trade' : 'trades'}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="font-semibold text-slate-700">Sales</span>
                                  <span className="text-[9px] text-slate-400 font-mono">
                                    {stats.salesCount} {stats.salesCount === 1 ? 'trade' : 'trades'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Action: View Details (NO Approve/Reject buttons!) */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/hospital-details?hospitalId=${encodeURIComponent(hosp.id)}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-primary-50 text-slate-700 hover:text-primary-700 font-bold text-xs border border-slate-200 hover:border-primary-200 shadow-sm transition-all"
                          >
                            <Eye className="w-3.5 h-3.5 text-primary-600" />
                            <span>View Details</span>
                          </button>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-14 text-center text-slate-400">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-bold text-slate-700">No approved hospitals match your filter</p>
                      <p className="text-xs text-slate-400 mt-1">Try clearing your search query or location filter.</p>
                      {(searchTerm || locationFilter !== 'all' || activityFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchTerm('');
                            setLocationFilter('all');
                            setActivityFilter('all');
                          }}
                          className="mt-3 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                        >
                          Clear Filters
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredHospitals.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No approved hospitals match your filter"
          description="Try clearing your search query or location filter to view all verified network hospitals."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchTerm('');
            setLocationFilter('all');
            setActivityFilter('all');
          }}
        />
      ) : (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredHospitals.map((hosp) => {
            const stats = hospitalStatsMap[hosp.id] || {
              listingsCount: 0,
              totalUnits: 0,
              purchasesCount: 0,
              salesCount: 0,
              totalTrades: 0,
              purchasePercent: 0,
              salesPercent: 0,
            };

            return (
              <div
                key={hosp.id}
                onClick={() => navigate(`/admin/hospital-details?hospitalId=${encodeURIComponent(hosp.id)}`)}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-primary-600 transition-colors truncate" title={hosp.name}>
                          {hosp.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{hosp.city || 'India'}, {hosp.state || ''}</span>
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                      <span>Approved</span>
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Registration ID:</span>
                      <span className="font-mono font-bold text-primary-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                        {hosp.registrationNo || 'REG-PENDING'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Contact Person:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">{hosp.authorizedPerson || 'Medical Director'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Medicines Listed:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {stats.listingsCount} {stats.listingsCount === 1 ? 'listing' : 'listings'}
                        {stats.totalUnits > 0 && ` (${stats.totalUnits.toLocaleString('en-IN')} units)`}
                      </span>
                    </div>
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Trading Activity:</span>
                        {stats.totalTrades > 0 ? (
                          <span className="font-mono font-bold text-[11px]">
                            <span className="text-teal-700">{stats.purchasePercent}% Purchases</span>
                            <span className="text-slate-300 mx-1">•</span>
                            <span className="text-rose-700">{stats.salesPercent}% Sales</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-medium">No Trading Activity</span>
                        )}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                        {stats.totalTrades > 0 ? (
                          <>
                            {stats.purchasePercent > 0 && (
                              <div style={{ width: `${stats.purchasePercent}%` }} className="h-full bg-teal-500" />
                            )}
                            {stats.salesPercent > 0 && (
                              <div style={{ width: `${stats.salesPercent}%` }} className="h-full bg-rose-500" />
                            )}
                          </>
                        ) : (
                          <div className="h-full w-full bg-slate-200/90" />
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>{stats.purchasesCount} {stats.purchasesCount === 1 ? 'trade' : 'trades'}</span>
                        <span>{stats.salesCount} {stats.salesCount === 1 ? 'trade' : 'trades'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">Approved: {hosp.verifiedDate || hosp.registeredDate || 'Verified'}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/hospital-details?hospitalId=${encodeURIComponent(hosp.id)}`);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 hover:bg-primary-100 font-bold text-xs border border-primary-200/60 shadow-sm transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default AdminHospitals;
