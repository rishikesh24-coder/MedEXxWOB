import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  Printer, 
  Building2, 
  Pill, 
  ShoppingBag, 
  MessageSquare, 
  ArrowUpRight, 
  TrendingUp, 
  FileSpreadsheet, 
  FileText, 
  RefreshCw,
  Star,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { adminService } from '../../services/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const DATE_RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom Range' },
];

const COLORS = ['#0A6E79', '#14B8A6', '#F59E0B', '#EF4444', '#6366F1'];

export const AdminReports = () => {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState('2024-08-01');
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReports = async (range) => {
    try {
      setLoading(true);
      const data = await adminService.getReports(range);
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports:', err);
      toast.error('Failed to load analytical reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports(selectedRange);
  }, [selectedRange]);

  const handleExportCSV = async () => {
    try {
      await adminService.exportTradingReportCSV({
        startDate: selectedRange === 'custom' ? customStartDate : null,
        endDate: selectedRange === 'custom' ? customEndDate : null,
      });
      toast.success('National trading report exported to CSV');
    } catch (err) {
      toast.error('Failed to download report export: ' + (err?.message || err));
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  if (loading || !reports) {
    return (
      <div className="py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <LoadingSpinner size="lg" />
        <p className="mt-3 text-xs font-mono font-medium text-slate-500">
          Synthesizing multi-institutional analytics ledger...
        </p>
      </div>
    );
  }

  // Visual data mappings
  const hospitalData = [
    { name: 'Verified', count: reports.hospitals.verified, color: '#0A6E79' },
    { name: 'Pending Review', count: reports.hospitals.newRegistrations, color: '#F59E0B' },
    { name: 'Suspended', count: reports.hospitals.suspended, color: '#64748B' },
    { name: 'Rejected', count: reports.hospitals.rejected, color: '#EF4444' },
  ];

  const medicineStatusData = [
    { name: 'In Stock', count: reports.medicines.total - reports.medicines.lowStock - reports.medicines.outOfStock - reports.medicines.expired, color: '#10B981' },
    { name: 'Low Stock', count: reports.medicines.lowStock, color: '#F59E0B' },
    { name: 'Out of Stock', count: reports.medicines.outOfStock, color: '#EF4444' },
    { name: 'Expired', count: reports.medicines.expired, color: '#881337' },
  ];

  return (
    <div className="space-y-6 print:p-0">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-ocean-950 via-ocean-900 to-teal-950 text-white shadow-xl relative overflow-hidden print:bg-none print:text-black print:border-b print:shadow-none">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none print:hidden" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30 print:hidden">
              <BarChart3 className="w-3 h-3 text-teal-400" />
              Statutory Intelligence & Audit
            </span>
            <span className="text-xs text-slate-400 font-mono">Consolidated Analytics</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white print:text-slate-900">
            National Healthcare Logistics Reports
          </h1>
          <p className="text-xs text-slate-300 max-w-xl font-normal print:text-slate-600">
            Real-time multi-echelon inventory trends, inter-hospital transaction volumes, institutional compliance metrics, and quality CSAT.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 print:hidden">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold backdrop-blur-md transition-colors border border-white/10"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-300" />
            Export CSV
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Date Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto pb-1 sm:pb-0">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap mr-1">Timeframe:</span>
          {DATE_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRange(r.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedRange === r.id
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {selectedRange === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="p-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
            />
            <span className="text-slate-400 font-bold">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="p-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
            />
          </div>
        )}
      </div>

      {/* 1. HOSPITAL REPORTS SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Hospital Network Reports</h2>
              <p className="text-xs text-slate-500">Accreditation status and institutional onboarding rates</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-teal-50 text-teal-800">
            {reports.hospitals.total} Institutions
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Total Hospitals</div>
            <div className="text-xl font-black text-slate-900 font-mono">{reports.hospitals.total}</div>
            <div className="text-[10px] text-slate-500">Registered facilities</div>
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-teal-700">Verified Hospitals</div>
            <div className="text-xl font-black text-teal-800 font-mono">{reports.hospitals.verified}</div>
            <div className="text-[10px] text-teal-600">Active trading accounts</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-amber-700">New / Pending</div>
            <div className="text-xl font-black text-amber-800 font-mono">{reports.hospitals.newRegistrations}</div>
            <div className="text-[10px] text-amber-600">Awaiting Form 20B/21B</div>
          </div>

          <div className="p-3.5 rounded-xl bg-red-50/50 border border-red-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-red-700">Rejected</div>
            <div className="text-xl font-black text-red-800 font-mono">{reports.hospitals.rejected}</div>
            <div className="text-[10px] text-red-600">Non-compliant audits</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-slate-600">Suspended</div>
            <div className="text-xl font-black text-slate-800 font-mono">{reports.hospitals.suspended}</div>
            <div className="text-[10px] text-slate-500">Revoked privileges</div>
          </div>
        </div>

        {/* Hospital Breakdown Visual */}
        <div className="h-48 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hospitalData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} width={100} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px' }}
                formatter={(val) => [`${val} Hospitals`, 'Count']}
              />
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {hospitalData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. MEDICINE REPORTS SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <Pill className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Medicine & Inventory Reports</h2>
              <p className="text-xs text-slate-500">Stock distribution, critical depletion, and requisition velocity</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-teal-50 text-teal-800">
            {reports.medicines.total} Batches Listed
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Total Medicines</div>
            <div className="text-xl font-black text-slate-900 font-mono">{reports.medicines.total}</div>
            <div className="text-[10px] text-slate-500">Active formulary items</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-amber-700">Low Stock</div>
            <div className="text-xl font-black text-amber-800 font-mono">{reports.medicines.lowStock}</div>
            <div className="text-[10px] text-amber-600">Below min threshold</div>
          </div>

          <div className="p-3.5 rounded-xl bg-red-50/50 border border-red-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-red-700">Out of Stock</div>
            <div className="text-xl font-black text-red-800 font-mono">{reports.medicines.outOfStock}</div>
            <div className="text-[10px] text-red-600">0 balance emergency</div>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-rose-700">Expired Medicines</div>
            <div className="text-xl font-black text-rose-800 font-mono">{reports.medicines.expired}</div>
            <div className="text-[10px] text-rose-600">Quarantined regulatory hold</div>
          </div>

          <div className="p-3.5 rounded-xl bg-orange-50/50 border border-orange-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-orange-700">Expiring Soon</div>
            <div className="text-xl font-black text-orange-800 font-mono">{reports.medicines.expiringSoon}</div>
            <div className="text-[10px] text-orange-600">Shelf life &lt; 60 days</div>
          </div>
        </div>

        {/* Most Requested Medicines Table */}
        <div className="pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Most Requested Formulary Medicines (Inter-Hospital Exchange)
          </h4>
          <div className="border border-slate-200/80 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Medicine Formulation</th>
                  <th className="py-2.5 px-3 text-right">Units Requested</th>
                  <th className="py-2.5 px-3 text-right">Fulfillment Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {reports.medicines.mostRequested?.map((med, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px] font-mono">
                          {idx + 1}
                        </span>
                        <span>{med.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {med.units} units
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-bold">
                      98.4%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. ORDER REPORTS SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Requisition & Orders Velocity</h2>
              <p className="text-xs text-slate-500">Cadence of procurement requests and hospital-wise requisitions</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-teal-50 text-teal-800">
            {reports.orders.total} Total Orders
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Daily Average</div>
            <div className="text-xl font-black text-slate-900 font-mono">{reports.orders.daily}</div>
            <div className="text-[10px] text-slate-500">Orders per day</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Weekly Requisitions</div>
            <div className="text-xl font-black text-slate-900 font-mono">{reports.orders.weekly}</div>
            <div className="text-[10px] text-slate-500">Avg past 7 days</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Monthly Volume</div>
            <div className="text-xl font-black text-slate-900 font-mono">{reports.orders.monthly}</div>
            <div className="text-[10px] text-slate-500">Rolling 30 days</div>
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-teal-700">Total Lifetime</div>
            <div className="text-xl font-black text-teal-800 font-mono">{reports.orders.total}</div>
            <div className="text-[10px] text-teal-600">Requisitions ledger</div>
          </div>
        </div>

        {/* Hospital-wise Orders Breakdown */}
        <div className="pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Hospital-wise Requisition Volumes
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reports.orders.hospitalWise?.slice(0, 6).map((hosp, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">{hosp.name}</span>
                </div>
                <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md">
                  {hosp.count} orders
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. FEEDBACK REPORTS SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Institutional Feedback & CSAT Reports</h2>
              <p className="text-xs text-slate-500">Hospital participant satisfaction trends and category resolution</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold font-mono">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{reports.feedback.averageRating} / 5.0 CSAT</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-slate-400">Total Feedback</div>
            <div className="text-xl font-black text-slate-900 font-mono">{reports.feedback.total}</div>
            <div className="text-[10px] text-slate-500">Submissions received</div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-emerald-700">Resolved</div>
            <div className="text-xl font-black text-emerald-800 font-mono">{reports.feedback.resolved}</div>
            <div className="text-[10px] text-emerald-600">Executive reply sent</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-amber-700">Unresolved / Open</div>
            <div className="text-xl font-black text-amber-800 font-mono">{reports.feedback.unresolved}</div>
            <div className="text-[10px] text-amber-600">Pending investigation</div>
          </div>

          <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200/80 space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-teal-700">Satisfaction Score</div>
            <div className="text-xl font-black text-teal-800 font-mono">{reports.feedback.averageRating} ★</div>
            <div className="text-[10px] text-teal-600">Target: &gt; 4.5 ★</div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Category-wise Feedback Breakdown
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {reports.feedback.categoryWise?.map((cat, idx) => (
              <div key={idx} className="p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{cat.category}</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                  {cat.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
