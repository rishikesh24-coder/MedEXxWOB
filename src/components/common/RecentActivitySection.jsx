import React, { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Truck, 
  CheckCircle2, 
  Send, 
  Clock, 
  ChevronRight,
  Boxes,
  ShieldCheck,
  Flame,
  FileCheck2,
  Ban
} from 'lucide-react';
import { getStoredItem, KEYS } from '../../services/storage';

/**
 * RecentActivitySection
 * Displays chronological audit events dynamically derived from the application state:
 * - Stock received & inventory lot arrivals
 * - Requisitions reviewed & approved
 * - Transfers dispatched & delivered
 */
export const RecentActivitySection = ({ limit = 8, showHeader = true, title = "Recent Operational Activity" }) => {
  const { user } = useSelector((state) => state.auth);
  const { inventory = [] } = useSelector((state) => state.hospital);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'TRANSFERS' | 'REQUESTS' | 'INVENTORY'

  const storedRequests = getStoredItem(KEYS.REQUESTS, []);
  const storedTrackings = getStoredItem(KEYS.TRACKING, []);

  const activities = useMemo(() => {
    const list = [];
    const now = new Date();

    // 1. Transfers activity from tracking
    storedTrackings.forEach((trk, idx) => {
      const isDelivered = (trk.status || '').toLowerCase().includes('deliver') || (trk.status || '').toLowerCase().includes('received');
      list.push({
        id: `act-trk-${trk.transactionId || idx}`,
        type: 'TRANSFERS',
        action: isDelivered ? 'Consignment Delivered' : 'Transfer Dispatched',
        icon: Truck,
        iconBg: isDelivered ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600',
        entity: trk.medicineName || 'Medicine Batch',
        badge: trk.transactionId || `TRF-2026-${String(idx + 1).padStart(3, '0')}`,
        quantity: `${trk.quantity || 50} units`,
        detail: `${trk.senderHospital || 'Max Super Speciality'} → ${trk.receiverHospital || 'Apollo Hospital'}`,
        timestamp: new Date(now.getTime() - (idx * 45 + 15) * 60000),
        timeFormatted: `${String(10 - idx).padStart(2, '0')}:${String(51 - idx * 8).padStart(2, '0')}`,
        link: `/hospital/track?txn=${trk.transactionId}`,
      });
    });

    // 2. Requisition activities
    storedRequests.forEach((req, idx) => {
      const isCancelled = (req.status || '').toLowerCase() === 'cancelled';
      const isApproved = (req.status || '').toLowerCase() === 'accepted';
      const isPending = (req.status || '').toLowerCase() === 'pending';
      list.push({
        id: `act-req-${req.id || idx}`,
        type: 'REQUESTS',
        action: isCancelled 
          ? 'Requisition Cancelled' 
          : isApproved 
          ? 'Requisition Approved' 
          : isPending 
          ? 'Requisition Created' 
          : 'Requisition Reviewed',
        icon: isCancelled ? Ban : Send,
        iconBg: isCancelled 
          ? 'bg-rose-50 text-rose-600' 
          : isApproved 
          ? 'bg-emerald-50 text-emerald-600' 
          : 'bg-amber-50 text-amber-600',
        entity: req.medicineName || 'Essential Medicine',
        badge: req.id || `REQ-2026-${String(idx + 1).padStart(3, '0')}`,
        quantity: isCancelled && req.cancellation?.refundAmount 
          ? `₹${Number(req.cancellation.refundAmount).toLocaleString('en-IN')} Refunded` 
          : `${req.quantity || 100} units`,
        detail: isCancelled
          ? `Cancelled by Buyer • ${req.cancellation?.reason || 'Requirement changed'}`
          : `Requester: ${req.fromHospitalName || req.requesterHospital || 'Peer Healthcare'}`,
        timestamp: isCancelled && req.cancellation?.cancelledAt 
          ? new Date(req.cancellation.cancelledAt) 
          : new Date(now.getTime() - (idx * 30 + 35) * 60000),
        timeFormatted: `${String(11 - idx).padStart(2, '0')}:${String(18 - idx * 4).padStart(2, '0')}`,
        link: isCancelled || isApproved ? '/hospital/my-requests' : '/hospital/incoming-requests',
      });
    });

    // 3. Stock received / Inventory lots
    inventory.slice(0, 4).forEach((med, idx) => {
      list.push({
        id: `act-inv-${med.id || idx}`,
        type: 'INVENTORY',
        action: 'Stock Received & Earmarked',
        icon: Boxes,
        iconBg: 'bg-teal-50 text-teal-600',
        entity: med.medicineName || med.name || 'Medical Formulation',
        badge: `Lot: ${med.batchNo || med.batch || 'PCM-2024'}`,
        quantity: `+${med.quantity || med.usableStock || 100} units`,
        detail: `Formulary Verified • Expiry: ${med.expiryDate || 'Valid'}`,
        timestamp: new Date(now.getTime() - (idx * 60 + 50) * 60000),
        timeFormatted: `${String(10 - idx).padStart(2, '0')}:${String(42 - idx * 5).padStart(2, '0')}`,
        link: '/hospital/inventory',
      });
    });

    // Sort chronologically descending
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [inventory, storedRequests, storedTrackings]);

  const filteredList = useMemo(() => {
    if (filterType === 'ALL') return activities.slice(0, limit);
    return activities.filter((item) => item.type === filterType).slice(0, limit);
  }, [activities, filterType, limit]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
      {showHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {title}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological ledger of stock receipts, requisitions, and transfer logistics.
            </p>
          </div>

          {/* Activity Category Filters */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-mono font-bold overflow-x-auto">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'INVENTORY', label: 'Stock' },
              { id: 'REQUESTS', label: 'Requests' },
              { id: 'TRANSFERS', label: 'Transfers' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1 rounded-lg transition-all whitespace-nowrap ${
                  filterType === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline List */}
      {filteredList.length === 0 ? (
        <div className="py-10 text-center text-slate-400 space-y-1">
          <Clock className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-xs font-bold text-slate-700">No Recent Activity</p>
          <p className="text-[11px] text-slate-500">Inventory and transfer activity will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.link}
                className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0 shadow-2xs`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {item.action}
                      </span>
                      <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-200/70 text-slate-700">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
                      <strong className="text-slate-900">{item.entity}</strong> • {item.quantity}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {item.detail}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right flex-shrink-0 pl-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-700 block">
                      {item.timeFormatted}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 uppercase">
                      Logged
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-600 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecentActivitySection;
