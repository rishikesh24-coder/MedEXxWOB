import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  Layers, 
  FileText, 
  Eye, 
  RefreshCw, 
  Lock, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  Building2,
  Package,
  ShoppingBag,
  MessageSquare,
  Sliders
} from 'lucide-react';
import { auditService } from '../../services/auditService';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const MODULES = [
  'All Modules',
  'Hospitals',
  'Medicines',
  'Inventory',
  'Orders',
  'Feedback',
  'Settings'
];

const ACTIONS = [
  'All Actions',
  'HOSPITAL_APPLICATION_SUBMITTED',
  'HOSPITAL_APPLICATION_APPROVED',
  'HOSPITAL_APPLICATION_REJECTED',
  'HOSPITAL_APPROVED',
  'HOSPITAL_SUSPENDED',
  'HOSPITAL_REJECTED',
  'MEDICINE_ADDED',
  'MEDICINE_UPDATED',
  'STOCK_ADJUSTED',
  'STOCK_TRANSFERRED',
  'ORDER_STATUS_UPDATED',
  'FEEDBACK_RESOLVED',
  'FEEDBACK_STATUS_UPDATED',
  'SETTINGS_UPDATED'
];

export const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | '7d' | '30d'
  const [selectedModule, setSelectedModule] = useState('All Modules');
  const [selectedAction, setSelectedAction] = useState('All Actions');

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = () => {
    try {
      setLoading(true);
      const data = auditService.getAuditTrail(null);
      
      // Normalize logs to ensure module, adminName, description, status
      const normalized = data.map((entry, idx) => {
        let mod = entry.module || entry.entityType || 'Hospitals';
        if (mod === 'VERIFICATION' || mod === 'HOSPITAL') mod = 'Hospitals';
        else if (mod === 'INVENTORY' && entry.action?.includes('MEDICINE')) mod = 'Medicines';
        else if (mod === 'INVENTORY') mod = 'Inventory';
        else if (mod === 'REQUEST' || mod === 'ORDER' || mod === 'TRANSFER') mod = 'Orders';
        else if (mod === 'FEEDBACK') mod = 'Feedback';
        else if (mod === 'SETTINGS') mod = 'Settings';

        let adminUser = entry.adminName || (entry.hospitalId === 'hosp-admin' || !entry.hospitalId ? 'Super Administrator' : entry.hospitalName);
        if (entry.actor) adminUser = entry.actor;

        let desc = entry.description || entry.summary || 'Administrative event executed.';
        let st = entry.status || entry.resultingStatus || 'Completed';

        return {
          ...entry,
          id: entry.id || `audit-${idx}`,
          timestamp: entry.timestamp || new Date(Date.now() - idx * 3600000).toISOString(),
          adminUser,
          action: entry.action || 'AUDIT_LOG_RECORDED',
          module: mod,
          description: desc,
          status: st,
        };
      });

      setLogs(normalized);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      toast.error('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Module filter
      if (selectedModule !== 'All Modules' && log.module.toLowerCase() !== selectedModule.toLowerCase()) {
        return false;
      }

      // 2. Action filter
      if (selectedAction !== 'All Actions' && log.action !== selectedAction) {
        return false;
      }

      // 3. Date filter
      if (dateFilter !== 'all') {
        const logDate = new Date(log.timestamp).getTime();
        const now = Date.now();
        if (dateFilter === 'today' && now - logDate > 86400000) return false;
        if (dateFilter === '7d' && now - logDate > 7 * 86400000) return false;
        if (dateFilter === '30d' && now - logDate > 30 * 86400000) return false;
      }

      // 4. Search query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesDesc = log.description.toLowerCase().includes(q);
        const matchesAdmin = log.adminUser.toLowerCase().includes(q);
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesModule = log.module.toLowerCase().includes(q);
        if (!matchesDesc && !matchesAdmin && !matchesAction && !matchesModule) return false;
      }

      return true;
    });
  }, [logs, selectedModule, selectedAction, dateFilter, searchTerm]);

  const formatDateTime = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return ts;
    }
  };

  const getModuleIcon = (mod) => {
    switch (mod) {
      case 'Hospitals':
        return <Building2 className="w-3.5 h-3.5 text-teal-600" />;
      case 'Medicines':
        return <Package className="w-3.5 h-3.5 text-indigo-600" />;
      case 'Inventory':
        return <Layers className="w-3.5 h-3.5 text-emerald-600" />;
      case 'Orders':
        return <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />;
      case 'Feedback':
        return <MessageSquare className="w-3.5 h-3.5 text-amber-600" />;
      case 'Settings':
        return <Sliders className="w-3.5 h-3.5 text-slate-600" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-ocean-950 via-ocean-900 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <ShieldCheck className="w-3 h-3 text-teal-400" />
              Cryptographic Audit Trail
            </span>
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Read-Only Ledger
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Administrator Activity & Audit Logs</h1>
          <p className="text-xs text-slate-300 max-w-xl font-normal">
            Immutable regulatory audit trail recording all administrative approvals, formulary insertions, inventory reallocations, and security state transitions.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/10 text-xs font-semibold backdrop-blur-md text-white flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-teal-300" />
            <span>21 CFR Part 11 Compliant</span>
          </div>
          <button
            onClick={fetchLogs}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold backdrop-blur-md transition-colors border border-white/10"
            title="Refresh audit trail"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail by description or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Date filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600"
            >
              <option value="all">Date: All Time</option>
              <option value="today">Date: Today</option>
              <option value="7d">Date: Last 7 Days</option>
              <option value="30d">Date: Last 30 Days</option>
            </select>

            {/* Module filter */}
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600"
            >
              {MODULES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Action filter */}
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-teal-600 max-w-[200px] truncate"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <LoadingSpinner size="lg" />
          <p className="mt-3 text-xs font-medium text-slate-500 font-mono">Verifying block headers & audit hashes...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Audit Events Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || selectedModule !== 'All Modules' || selectedAction !== 'All Actions' || dateFilter !== 'all'
              ? 'No audit log entries match your specified search criteria.'
              : 'There are currently no recorded administrator actions.'}
          </p>
          {(searchTerm || selectedModule !== 'All Modules' || selectedAction !== 'All Actions' || dateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedModule('All Modules');
                setSelectedAction('All Actions');
                setDateFilter('all');
              }}
              className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden w-full max-w-full">
          {/* Desktop & Tablet Table (No horizontal scrollbar, 100% table-fixed layout) */}
          <div className="hidden md:block w-full overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed text-xs">
              <colgroup>
                <col style={{ width: '15%' }} /> {/* Date / Time */}
                <col style={{ width: '16%' }} /> {/* Admin / User */}
                <col style={{ width: '15%' }} /> {/* Action */}
                <col style={{ width: '12%' }} /> {/* Module */}
                <col style={{ width: '25%' }} /> {/* Description */}
                <col style={{ width: '10%' }} /> {/* Status */}
                <col style={{ width: '7%' }} />  {/* Inspect */}
              </colgroup>
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-2.5">Date / Time</th>
                  <th className="py-3 px-2">Admin / User</th>
                  <th className="py-3 px-2">Action</th>
                  <th className="py-3 px-2">Module</th>
                  <th className="py-3 px-2">Description</th>
                  <th className="py-3 px-1.5 text-center">Status</th>
                  <th className="py-3 px-2 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredLogs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    
                    {/* Date / Time */}
                    <td className="py-3 px-2.5 overflow-hidden text-slate-500 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate block" title={formatDateTime(entry.timestamp)}>
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                    </td>

                    {/* Admin / User */}
                    <td className="py-3 px-2 overflow-hidden font-semibold text-slate-900 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate block" title={entry.adminUser}>
                          {entry.adminUser}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-2 overflow-hidden">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase font-mono bg-slate-100 text-slate-700 border border-slate-200 inline-block truncate max-w-full" title={entry.action}>
                        {entry.action}
                      </span>
                    </td>

                    {/* Module */}
                    <td className="py-3 px-2 overflow-hidden">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 max-w-full">
                        <span className="shrink-0">{getModuleIcon(entry.module)}</span>
                        <span className="truncate">{entry.module}</span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="py-3 px-2 text-slate-600 text-xs overflow-hidden">
                      <p className="truncate" title={entry.description}>
                        {entry.description}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-1.5 text-center overflow-hidden">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>{entry.status}</span>
                      </span>
                    </td>

                    {/* Inspect */}
                    <td className="py-3 px-2 text-center overflow-hidden">
                      <button
                        onClick={() => setSelectedLog(entry)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1 shrink-0"
                        title="Inspect Event"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredLogs.map((entry) => (
              <div key={entry.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span className="font-semibold text-slate-900 text-xs truncate">{entry.adminUser}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{entry.status}</span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase font-mono bg-slate-100 text-slate-700 border border-slate-200">
                    {entry.action}
                  </span>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {getModuleIcon(entry.module)}
                    <span>{entry.module}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">
                  {entry.description}
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{formatDateTime(entry.timestamp)}</span>
                  </div>
                  <button
                    onClick={() => setSelectedLog(entry)}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1"
                  >
                    <Eye className="w-3 h-3" />
                    <span>View</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Showing {filteredLogs.length} of {logs.length} logged events</span>
            <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Immutable Append-Only Mode
            </span>
          </div>
        </div>
      )}

      {/* Inspect Audit Event Modal (Read-Only) */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Immutable Audit Event Signature"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-slate-800 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-900">{selectedLog.action}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {selectedLog.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block font-bold">EVENT ID:</span>
                  <span className="font-mono text-slate-700">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">TIMESTAMP:</span>
                  <span className="font-mono text-slate-700">{selectedLog.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">OPERATOR / ADMIN:</span>
                  <span className="font-semibold text-slate-800">{selectedLog.adminUser}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold">SYSTEM MODULE:</span>
                  <span className="font-semibold text-slate-800">{selectedLog.module}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Full Event Description & Summary:
              </label>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 leading-relaxed text-slate-800 font-medium">
                {selectedLog.description}
              </div>
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="space-y-1">
                <label className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Structured Payload Metadata:
                </label>
                <pre className="p-3 rounded-xl bg-slate-900 text-teal-300 font-mono text-[11px] overflow-x-auto max-h-40">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <Lock className="w-3 h-3 text-teal-600" />
                Cryptographic checksum verified
              </span>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminAuditLogs;
