import React, { Suspense } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import StatusBadge from '../components/common/StatusBadge';
import RouteLoadingFallback from '../components/common/RouteLoadingFallback';
import PortalHistoryNavigation from '../components/common/PortalHistoryNavigation';
import { Building2, PlusCircle, Search, Radio, ShieldCheck, Sparkles, Navigation } from 'lucide-react';

export const HospitalLayout = () => {
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();

  const mobileNavItems = [
    { to: '/hospital/dashboard', label: 'Dashboard' },
    { to: '/hospital/inventory', label: 'Inventory' },
    { to: '/hospital/marketplace', label: 'Marketplace' },
    { to: '/hospital/my-requests', label: 'My Requests' },
    { to: '/hospital/incoming-requests', label: 'Incoming' },
    { to: '/hospital/track', label: 'Live Track' },
    { to: '/hospital/history', label: 'Trade History' },
    { to: '/hospital/payment-history', label: 'Payment History' },
    { to: '/hospital/reports', label: 'Reports' },
    { to: '/hospital/alerts', label: 'Alerts' },
    { to: '/hospital/feedback', label: 'Feedback' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      <Navbar />

      {/* Top Hospital Institutional Meta Bar */}
      <div className="bg-white border-b border-slate-200/90 px-4 sm:px-8 py-3 shadow-subtle">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-50 to-primary-100 border border-primary-200 text-primary-700 flex items-center justify-center font-bold shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  {user?.name || 'Apollo Hospital Central Pharmacy'}
                </h2>
                <StatusBadge status={user?.status || 'verified'} />
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Reg: <span className="text-slate-800 font-semibold">{user?.registrationNo || 'MH-MUM-2018-8821'}</span> • {user?.city || 'Mumbai'}, {user?.state || 'Maharashtra'}
              </p>
            </div>
          </div>

          {/* Institutional Quick Action Buttons & Status */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-800">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span>COLD-CHAIN SENSOR: NOMINAL (4.2°C)</span>
            </div>

            <Link
              to="/hospital/marketplace"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 hover:border-primary-400 bg-white text-xs font-bold text-slate-700 hover:text-primary-700 transition-all shadow-subtle hover:shadow"
            >
              <Search className="w-3.5 h-3.5 text-primary-600" />
              <span>Browse Market</span>
            </Link>

            <Link
              to="/hospital/inventory"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold shadow-md shadow-primary-600/20 transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Manage Stock</span>
            </Link>
          </div>

        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        
        {/* Desktop Intelligent Sidebar Rail */}
        <div className="hidden md:block">
          <Sidebar role="hospital" />
        </div>

        {/* Mobile Horizontal Navigation Rail */}
        <div className="md:hidden bg-white border-b border-slate-200 overflow-x-auto p-2 flex gap-1.5 shadow-inner">
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Page Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 overflow-y-auto">
          {/* Global In-App Back/Forward Controls */}
          <div className="mb-3 sm:mb-4 flex items-center justify-between">
            <PortalHistoryNavigation portal="hospital" />
          </div>
          <Suspense fallback={<RouteLoadingFallback text="Loading hospital workspace..." />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

    </div>
  );
};

export default HospitalLayout;
