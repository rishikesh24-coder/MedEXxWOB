import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  AlertTriangle, 
  ShieldAlert, 
  Info, 
  CheckCircle2, 
  Search, 
  ExternalLink, 
  Clock, 
  Trash2, 
  CheckCheck,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { alertService } from '../../services/alertService';
import toast from 'react-hot-toast';

export const AlertsView = ({
  portal = 'hospital',
  hospitalId = null,
  customTitle = null,
  customSubtitle = null,
  customBadge = null,
}) => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'WARNING' | 'INFORMATION'
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let data = [];
      if (portal === 'admin') {
        data = await alertService.getAdminAlerts();
      } else {
        data = await alertService.getHospitalAlerts(hospitalId);
      }
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(`Failed to load ${portal} alerts:`, err);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const handleRealtime = () => {
      fetchAlerts();
    };

    window.addEventListener('medex-alert-event', handleRealtime);
    const unsubscribe = alertService.subscribeToAlerts(() => {
      fetchAlerts();
    });

    return () => {
      window.removeEventListener('medex-alert-event', handleRealtime);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [portal, hospitalId]);

  // Unified category normalization helper
  const getNormalizedCategory = (alert) => {
    const rawCat = (alert.category || alert.alertType || alert.type || '').toUpperCase();
    const rawSev = (alert.severity || '').toUpperCase();

    if (rawSev === 'CRITICAL' || rawCat === 'CRITICAL' || rawCat.includes('EXPIRED') || rawCat.includes('FAIL') || rawCat.includes('BREACH')) {
      return 'CRITICAL';
    }
    if (rawSev === 'WARNING' || rawSev === 'ACTION' || rawCat === 'WARNING' || rawCat.includes('WARN') || rawCat.includes('LOW_STOCK') || rawCat.includes('EXPIRING') || rawCat.includes('CANCEL') || rawCat.includes('REJECT') || rawCat.includes('PENDING')) {
      return 'WARNING';
    }
    return 'INFORMATION';
  };

  const counts = useMemo(() => {
    const res = { ALL: alerts.length, CRITICAL: 0, WARNING: 0, INFORMATION: 0, unread: 0 };
    alerts.forEach((a) => {
      if (!a.read) res.unread += 1;
      const cat = getNormalizedCategory(a);
      if (cat === 'CRITICAL') res.CRITICAL += 1;
      else if (cat === 'WARNING') res.WARNING += 1;
      else res.INFORMATION += 1;
    });
    return res;
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const normCat = getNormalizedCategory(a);
      const matchesTab = activeTab === 'ALL' || normCat === activeTab;
      const matchesUnread = !unreadOnly || !a.read;
      const descText = (a.description || a.desc || a.message || '').toLowerCase();
      const titleText = (a.title || '').toLowerCase();
      const relatedText = (a.relatedItem || a.medicineName || a.batchNo || '').toLowerCase();
      const q = searchTerm.trim().toLowerCase();

      const matchesSearch = 
        !q ||
        titleText.includes(q) ||
        descText.includes(q) ||
        relatedText.includes(q);

      return matchesTab && matchesUnread && matchesSearch;
    });
  }, [alerts, activeTab, unreadOnly, searchTerm]);

  const handleMarkAsRead = (alertId) => {
    alertService.markAsRead(alertId);
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
    );
    toast.success('Marked as read');
  };

  const handleMarkAllRead = () => {
    if (portal === 'admin') {
      alertService.markAllAdminAlertsAsRead();
    } else {
      alertService.markAllAsRead(hospitalId);
    }
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    toast.success('All alerts marked as read');
  };

  const handleDismiss = (alertId) => {
    alertService.dismissAlert(alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    toast.success('Alert dismissed');
  };

  const handleNavigate = (link, alert) => {
    if (link) {
      if (alert && !alert.read) {
        alertService.markAsRead(alert.id);
        setAlerts((prev) =>
          prev.map((a) => (a.id === alert.id ? { ...a, read: true } : a))
        );
      }
      navigate(link, { state: { alertTarget: alert } });
    }
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    try {
      const diffMs = Date.now() - new Date(timestamp).getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      const diffHours = Math.floor(diffMs / (3600 * 1000));
      const diffDays = Math.floor(diffMs / (86400 * 1000));

      if (diffMins < 5) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return new Date(timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const isAdmin = portal === 'admin';
  const bannerBadge = customBadge || (isAdmin ? 'Administrative Telemetry' : 'Hospital Pharmacy Telemetry');
  const bannerSubBadge = isAdmin ? 'Real-time Watchtower' : 'Node Health & Operational Signals';
  const bannerTitle = customTitle || (isAdmin ? 'Alerts & System Notifications' : 'Hospital Alerts & Notifications');
  const bannerDesc = customSubtitle || (
    isAdmin
      ? 'Real-time critical inventory depletion, statutory expiry milestones, pending hospital verifications, and urgent order alerts.'
      : 'Real-time inventory depletion, near-expiry alerts, incoming requisitions awaiting approval, transfer telemetry, and payment notifications.'
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-ocean-950 via-ocean-900 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Bell className="w-3 h-3 text-teal-400" />
              {bannerBadge}
            </span>
            <span className="text-xs text-slate-400 font-mono">{bannerSubBadge}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">{bannerTitle}</h1>
          <p className="text-xs text-slate-300 max-w-xl font-normal">
            {bannerDesc}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          {counts.unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Read ({counts.unread})
            </button>
          )}
          <button
            onClick={fetchAlerts}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold backdrop-blur-md transition-colors border border-white/10 cursor-pointer"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-200">
        {[
          { id: 'ALL', label: 'All Alerts', count: counts.ALL, color: 'text-slate-700' },
          { id: 'CRITICAL', label: 'Critical Outages', count: counts.CRITICAL, color: 'text-red-700', badgeBg: 'bg-red-100 text-red-700' },
          { id: 'WARNING', label: 'Warnings & Expiries', count: counts.WARNING, color: 'text-amber-700', badgeBg: 'bg-amber-100 text-amber-700' },
          { id: 'INFORMATION', label: 'Operational Info', count: counts.INFORMATION, color: 'text-teal-700', badgeBg: 'bg-teal-100 text-teal-700' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : tab.badgeBg || 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={isAdmin ? "Filter alerts by medicine, hospital, or keywords..." : "Filter alerts by medicine, batch, requisition, or keywords..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
            />
            Show unread only ({counts.unread})
          </label>
        </div>
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-600 mx-auto" />
          <p className="text-xs text-slate-500 font-mono">Inspecting system telemetry channels...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">All Systems Nominal</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm
              ? `No alerts matched your search "${searchTerm}".`
              : unreadOnly
              ? 'No unread notifications at this time.'
              : `No alerts currently reported under the ${activeTab} category.`}
          </p>
          {(searchTerm || unreadOnly) && (
            <button
              onClick={() => { setSearchTerm(''); setUnreadOnly(false); }}
              className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const normCat = getNormalizedCategory(alert);
            const isCritical = normCat === 'CRITICAL';
            const isWarning = normCat === 'WARNING';
            const isInfo = normCat === 'INFORMATION';

            const contextText = alert.relatedItem || 
              (alert.medicineName ? `${alert.medicineName}${alert.batchNo ? ` (Batch ${alert.batchNo})` : ''}` : null) ||
              (alert.requestId ? `Requisition #${alert.requestId}` : null) ||
              (alert.transferId ? `Transfer #${alert.transferId}` : null);

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  !alert.read
                    ? isCritical
                      ? 'bg-red-50/40 border-red-200 shadow-sm'
                      : isWarning
                      ? 'bg-amber-50/40 border-amber-200 shadow-sm'
                      : 'bg-teal-50/30 border-teal-200 shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Severity Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isCritical
                        ? 'bg-red-100 text-red-700 ring-2 ring-red-200/60'
                        : isWarning
                        ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200/60'
                        : 'bg-teal-100 text-teal-700 ring-2 ring-teal-200/60'
                    }`}
                  >
                    {isCritical ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <Info className="w-5 h-5" />
                    )}
                  </div>

                  {/* Alert Content */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          isCritical
                            ? 'bg-red-100 text-red-800'
                            : isWarning
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-teal-100 text-teal-800'
                        }`}
                      >
                        {alert.category || normCat}
                      </span>

                      {!alert.read && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          New
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getRelativeTime(alert.timestamp)}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {alert.title}
                    </h4>

                    <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                      {alert.description || alert.desc || alert.message}
                    </p>

                    {contextText && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium pt-0.5">
                        <span className="text-slate-400">Context:</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] truncate max-w-md">
                          {contextText}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                  {alert.link && (
                    <button
                      onClick={() => handleNavigate(alert.link, alert)}
                      className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{alert.actionText || 'Inspect'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}

                  {!alert.read ? (
                    <button
                      onClick={() => handleMarkAsRead(alert.id)}
                      className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium px-2 py-1">Read</span>
                  )}

                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                    title="Dismiss alert"
                  >
                    <Trash2 className="w-4 h-4" />
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

export default AlertsView;
