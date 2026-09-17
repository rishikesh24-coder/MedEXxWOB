import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  LayoutDashboard,
  Boxes,
  ShoppingBag,
  Send,
  Inbox,
  History,
  Truck,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  Building2,
  Layers,
  Activity,
  FileCheck2,
  ChevronRight,
  Sparkles,
  Flame,
  Bell,
  BarChart3,
  Settings
} from 'lucide-react';
import { alertService } from '../../services/alertService';
import { getStoredItem, KEYS } from '../../services/storage';

export const Sidebar = ({ role = 'hospital' }) => {
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { incomingRequests } = useSelector((state) => state.requests);
  const { hospitals } = useSelector((state) => state.admin);

  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      if (role === 'admin') {
        try {
          const count = alertService.getAdminUnreadCount();
          setUnreadAlerts(count);
        } catch (e) {}
      } else if (role === 'hospital' && user?.id) {
        try {
          const count = alertService.getHospitalUnreadCount(user.id);
          setUnreadAlerts(count);
        } catch (e) {}
      }
    };

    updateCount();
    window.addEventListener('medex-alert-event', updateCount);
    const unsubscribe = alertService.subscribeToAlerts(updateCount);

    return () => {
      window.removeEventListener('medex-alert-event', updateCount);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [role, user?.id, location.pathname]);

  const reqList = incomingRequests && incomingRequests.length > 0
    ? incomingRequests
    : (user?.id ? getStoredItem(KEYS.REQUESTS, []).filter(r => r.toHospitalId === user.id) : []);
  const pendingIncomingCount = reqList.filter((r) => (r.status || '').toLowerCase() === 'pending').length;

  const hospList = hospitals && hospitals.length > 0
    ? hospitals
    : getStoredItem(KEYS.HOSPITALS, []);
  const pendingHospitalsCount = hospList.filter((h) => {
    const s = (h.status || '').toLowerCase();
    return s === 'pending' || s === 'pending_approval' || s === 'documents_missing' || s === 'under_review';
  }).length;

  // Grouped Navigation Sections for Hospital Portal
  const hospitalNavSections = [
    {
      title: 'OVERVIEW',
      items: [
        { to: '/hospital/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/hospital/reports', icon: BarChart3, label: 'Reports & Analytics' },
      ]
    },
    {
      title: 'INVENTORY',
      items: [
        { to: '/hospital/inventory', icon: Boxes, label: 'My Inventory' },
        { to: '/hospital/marketplace', icon: ShoppingBag, label: 'Marketplace' },
      ]
    },
    {
      title: 'TRANSACTIONS',
      items: [
        { to: '/hospital/my-requests', icon: Send, label: 'My Requests' },
        { 
          to: '/hospital/incoming-requests', 
          icon: Inbox, 
          label: 'Incoming Requests', 
          badge: pendingIncomingCount > 0 ? pendingIncomingCount : null,
          badgeColor: 'bg-amber-500'
        },
        { to: '/hospital/history', icon: History, label: 'Trade History' },
        { to: '/hospital/payment-history', icon: CreditCard, label: 'Payment History' },
      ]
    },
    {
      title: 'LOGISTICS',
      items: [
        { to: '/hospital/track', icon: Truck, label: 'Live Tracking' },
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { 
          to: '/hospital/alerts', 
          icon: Bell, 
          label: 'Alerts',
          badge: unreadAlerts > 0 ? unreadAlerts : null,
          badgeColor: 'bg-rose-500'
        },
        { to: '/hospital/feedback', icon: MessageSquare, label: 'Feedback' },
      ]
    }
  ];

  // Grouped Navigation Sections for Admin Portal (The 10 Required Sections)
  const adminNavSections = [
    {
      title: 'CORE OVERSIGHT',
      items: [
        { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { 
          to: '/admin/hospitals', 
          icon: Building2, 
          label: 'Hospitals',
          title: 'Approved hospitals in the MedEx network',
        },
        { 
          to: '/admin/verification', 
          icon: FileCheck2, 
          label: 'Hospital Verification',
          title: 'Review and approve new hospital registrations',
          badge: pendingHospitalsCount > 0 ? pendingHospitalsCount : null,
          badgeColor: 'bg-amber-500'
        },
        { to: '/admin/medicines', icon: Layers, label: 'Medicines' },
        { to: '/admin/inventory', icon: Boxes, label: 'Inventory' },
        { to: '/admin/orders', icon: ShoppingBag, label: 'Orders' },
      ]
    },
    {
      title: 'MONITORING & CSAT',
      items: [
        { 
          to: '/admin/alerts', 
          icon: Bell, 
          label: 'Alerts',
          badge: unreadAlerts > 0 ? unreadAlerts : null,
          badgeColor: 'bg-rose-500'
        },
        { to: '/admin/feedback', icon: MessageSquare, label: 'Hospital Feedback' },
        { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
      ]
    },
    {
      title: 'GOVERNANCE & CONFIG',
      items: [
        { to: '/admin/audit-logs', icon: ShieldCheck, label: 'Audit Logs' },
        { to: '/admin/settings', icon: Settings, label: 'Settings' },
      ]
    }
  ];

  const navSections = role === 'admin' ? adminNavSections : hospitalNavSections;

  return (
    <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200/90 min-h-[calc(100vh-4rem)] p-3.5 flex flex-col justify-between select-none">
      <div>
        
        {/* Navigation Rail Header */}
        <div className="px-2.5 py-1.5 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-slate-400">
              {role === 'admin' ? 'NATIONAL AUTHORITY RAIL' : 'HOSPITAL OPERATING RAIL'}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        </div>

        {/* Logical Groups */}
        <div className="space-y-4">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              <div className="px-2.5 py-1">
                <span className="text-[9px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  {section.title}
                </span>
              </div>

              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={item.title || item.label}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group relative ${
                          isActive
                            ? 'bg-primary-50 text-primary-800 font-bold border border-primary-200/70 shadow-sm'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div className="flex items-center gap-2.5">
                            <Icon 
                              className={`w-4 h-4 transition-colors ${
                                isActive 
                                  ? 'text-primary-600' 
                                  : 'text-slate-400 group-hover:text-slate-600'
                              }`} 
                            />
                            <span>{item.label}</span>
                          </div>

                          {item.badge ? (
                            <span className={`px-2 py-0.5 text-[9px] font-mono font-bold text-white rounded-full ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          ) : (
                            <ChevronRight 
                              className={`w-3.5 h-3.5 transition-all ${
                                isActive 
                                  ? 'opacity-100 text-primary-500 translate-x-0' 
                                  : 'opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 text-slate-400'
                              }`} 
                            />
                          )}

                          {/* Left active marker pill */}
                          {isActive && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary-600 rounded-r-full" />
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      {/* Security & Statutory Compliance Footer Badge */}
      <div className="mt-6 p-3 rounded-xl bg-gradient-to-br from-slate-50 to-primary-50/50 border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-[11px] font-extrabold text-slate-800">
              {role === 'admin' ? 'Supervisory Authority' : 'Verified Hospital Node'}
            </span>
          </div>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            SECURE
          </span>
        </div>
        <div className="text-[10px] text-slate-500 leading-relaxed font-medium space-y-0.5">
          <div className="flex items-center justify-between text-slate-600 font-mono">
            <span>Role:</span>
            <span className="font-bold uppercase text-primary-700">{role} (Demo Session)</span>
          </div>
          <p className="text-[10px] text-slate-400">
            Client-side defense safeguards active. CDSCO Rule 65 protocol.
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
