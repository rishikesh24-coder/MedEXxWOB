import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
  Pill, 
  ShieldCheck, 
  LogIn, 
  UserPlus, 
  LayoutDashboard, 
  LogOut, 
  Building2, 
  ShieldAlert, 
  Menu, 
  X, 
  ChevronDown,
  Sparkles,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { logoutUser, setUserSession } from '../../store/slices/authSlice';
import { getStoredItem, setStoredItem, KEYS } from '../../services/storage';
import { alertService } from '../../services/alertService';
import toast from 'react-hot-toast';

export const Navbar = () => {
  const { isAuthenticated, user, role, token } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [alerts, setAlerts] = useState([]);

  const refreshAlerts = async () => {
    if (user?.id) {
      const activeAlerts = await alertService.getHospitalAlerts(user.id);
      setAlerts(activeAlerts || []);
    } else {
      setAlerts([]);
    }
  };

  useEffect(() => {
    refreshAlerts();

    const handleRealtimeAlert = () => {
      refreshAlerts();
    };

    window.addEventListener('medex-alert-event', handleRealtimeAlert);
    const unsubscribe = alertService.subscribeToAlerts(() => {
      refreshAlerts();
    });

    return () => {
      window.removeEventListener('medex-alert-event', handleRealtimeAlert);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [user?.id, notificationOpen]);

  const handleDismissAlert = (e, alertId) => {
    e.preventDefault();
    e.stopPropagation();
    alertService.dismissAlert(alertId);
    refreshAlerts();
  };

  const handleMarkAllRead = () => {
    if (user?.id) {
      alertService.markAllAsRead(user.id);
      refreshAlerts();
      toast.success('All alerts marked as read');
    }
  };

  const handleLogoutClick = () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await dispatch(logoutUser());
    toast.success('Logged out successfully. Secure session terminated.');
    navigate('/');
  };

  // Lock body scroll and handle Escape key for modals mounted outside header
  useEffect(() => {
    if (!showLogoutConfirm && !editProfileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowLogoutConfirm(false);
        setEditProfileOpen(false);
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLogoutConfirm, editProfileOpen]);


  const openEditProfile = () => {
    setEditFormData({
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      registrationNo: user?.registrationNo || '',
      city: user?.city || '',
      state: user?.state || '',
    });
    setEditProfileOpen(true);
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setEditFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSaveProfile = (event) => {
    event.preventDefault();
    const updatedUser = { ...user, ...editFormData };
    dispatch(setUserSession({ user: updatedUser, token: token || 'mock-jwt-token' }));

    const hospitals = getStoredItem(KEYS.HOSPITALS, []);
    const updatedHospitals = hospitals.map((hospital) => (
      hospital.id === user?.id ? { ...hospital, ...editFormData } : hospital
    ));
    setStoredItem(KEYS.HOSPITALS, updatedHospitals);
    setEditProfileOpen(false);
    toast.success('Hospital profile updated');
  };

  const dashboardPath = role === 'admin' ? '/admin/dashboard' : '/hospital/dashboard';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md transition-all shadow-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-900 flex items-center justify-center text-white shadow-md shadow-primary-700/20 group-hover:scale-105 transition-transform">
              <Pill className="w-5 h-5 rotate-45 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-secondary-900">
                  Med<span className="text-primary-600">Ex</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary-50 text-primary-700 border border-primary-200">
                  <ShieldCheck className="w-3 h-3 text-primary-600" />
                  Verified B2B
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500 -mt-0.5 tracking-wide hidden sm:block">
                Inter-Hospital Logistics & Medicine Exchange
              </p>
            </div>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-bold text-slate-600">
            <Link 
              to="/" 
              className={`hover:text-primary-600 transition-colors ${
                location.pathname === '/' ? 'text-primary-600 font-extrabold' : ''
              }`}
            >
              Home
            </Link>
            <Link 
              to="/how-it-works" 
              className={`hover:text-primary-600 transition-colors ${
                location.pathname === '/how-it-works' ? 'text-primary-600 font-extrabold' : ''
              }`}
            >
              How It Works
            </Link>
            <Link 
              to="/about" 
              className={`hover:text-primary-600 transition-colors ${
                location.pathname === '/about' ? 'text-primary-600 font-extrabold' : ''
              }`}
            >
              About
            </Link>
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-3">
            
            {/* Subtle Demo Data indicator (Section 19 Requirement) */}
            <div 
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-[10px] font-bold text-slate-500 font-mono select-none"
              title="Simulation Environment: Running on local client-side offline mock storage data. APIs ready for backend connect."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              <span>Demo Data</span>
            </div>

            {/* Notification Bell Dropdown */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  onClick={() => {
                    setNotificationOpen(!notificationOpen);
                    setUserDropdownOpen(false);
                  }}
                  className="relative p-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 transition-colors"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {alerts.filter((a) => !a.read).length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
                  )}
                </button>

                {/* Notifications Drawer */}
                {notificationOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-200/90 py-3 z-50 animate-scaleUp overflow-hidden"
                    onMouseLeave={() => setNotificationOpen(false)}
                  >
                    <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                        <Bell className="w-3.5 h-3.5 text-primary-600" />
                        <span>Institutional Activity Alerts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {alerts.filter((a) => !a.read).length > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[10px] font-bold text-primary-600 hover:text-primary-800"
                          >
                            Mark all read
                          </button>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary-50 text-primary-700">
                          {alerts.filter((a) => !a.read).length} Unread
                        </span>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {alerts.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 space-y-1">
                          <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500" />
                          <p className="text-xs font-bold text-slate-700">All Systems Nominal</p>
                          <p className="text-[11px] text-slate-500">No active inventory, request, or transfer alerts.</p>
                        </div>
                      ) : (
                        alerts.map((n) => (
                          <div
                            key={n.id}
                            className={`p-3.5 hover:bg-slate-50/80 transition-colors block space-y-1 ${
                              !n.read ? 'bg-primary-50/20' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                to={n.link || (role === 'admin' ? '/admin/alerts' : '/hospital/alerts')}
                                state={{ alertTarget: n }}
                                onClick={() => {
                                  if (!n.read) {
                                    alertService.markAsRead(n.id);
                                    refreshAlerts();
                                  }
                                  setNotificationOpen(false);
                                }}
                                className="flex items-center gap-1.5 font-bold text-slate-900 hover:text-primary-600 flex-1"
                              >
                                {n.urgent ? (
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                ) : (
                                  <Sparkles className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                                )}
                                <span className="line-clamp-1">{n.title}</span>
                              </Link>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button
                                  onClick={(e) => handleDismissAlert(e, n.id)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                  title="Dismiss alert"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-relaxed">
                              {n.desc || n.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 px-4 border-t border-slate-100 text-center">
                      <Link
                        to={role === 'admin' ? '/admin/alerts' : '/hospital/alerts'}
                        onClick={() => setNotificationOpen(false)}
                        className="text-[11px] font-bold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
                      >
                        <span>View All {role === 'admin' ? 'Administrative' : 'Hospital'} Alerts</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hospital / Admin Profile Dropdown */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => {
                    setUserDropdownOpen(!userDropdownOpen);
                    setNotificationOpen(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200/90 hover:border-primary-300 bg-slate-50/70 hover:bg-white text-slate-700 transition-all text-xs shadow-sm"
                >
                  <div className="w-7 h-7 rounded-lg bg-primary-100 border border-primary-200 text-primary-700 flex items-center justify-center font-bold">
                    {role === 'admin' ? <ShieldAlert className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  </div>

                  <div className="text-left hidden sm:block">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold leading-none text-slate-900 truncate max-w-[130px]">
                        {user?.name || 'Apollo Hospital'}
                      </p>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    </div>
                    <span className="text-[10px] font-mono text-primary-600 uppercase tracking-wider font-semibold">
                      {role === 'admin' ? 'SUPERVISORY' : 'HOSPITAL'}
                    </span>
                  </div>

                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Profile Selector Menu */}
                {userDropdownOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-64 rounded-2xl bg-white shadow-2xl border border-slate-200/90 py-2 z-50 animate-scaleUp"
                    onMouseLeave={() => setUserDropdownOpen(false)}
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        {role === 'hospital' ? 'ACTIVE HOSPITAL' : 'Active Workspace'}
                      </p>
                      <p className="text-xs font-extrabold text-slate-900 mt-0.5">{user?.name || 'Apollo Hospital'}</p>
                      <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                      {role === 'hospital' && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-100 text-[10px]">
                          <span className="text-slate-400">Registration</span>
                          <span className="text-right font-semibold text-slate-700 truncate">{user?.registrationNo || 'Not provided'}</span>
                          <span className="text-slate-400">Location</span>
                          <span className="text-right font-semibold text-slate-700 truncate">{[user?.city, user?.state].filter(Boolean).join(', ') || 'Not provided'}</span>
                          <span className="text-slate-400">Phone</span>
                          <span className="text-right font-semibold text-slate-700 truncate">{user?.phone || 'Not provided'}</span>
                        </div>
                      )}
                    </div>

                    <div className="py-1">
                      <Link
                        to={dashboardPath}
                        onClick={() => setUserDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-primary-600 transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-primary-600" />
                        <span>{role === 'admin' ? 'Supervisory Dashboard' : 'Hospital Command Center'}</span>
                      </Link>

                      {role === 'hospital' && (
                        <>
                          <Link
                            to="/hospital/inventory"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-primary-600 transition-colors"
                          >
                            <Pill className="w-4 h-4 text-emerald-600" />
                            <span>Pharmacy Inventory</span>
                          </Link>
                          <Link
                            to="/hospital/profile"
                            onClick={() => setUserDropdownOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-primary-600 transition-colors"
                          >
                            <Building2 className="w-4 h-4 text-cyan-600" />
                            <span>Hospital Public Profile</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              openEditProfile();
                              setUserDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-primary-600 transition-colors text-left"
                          >
                            <Building2 className="w-4 h-4 text-indigo-600" />
                            <span>Edit Hospital Details</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-1">
                      <button
                        onClick={handleLogoutClick}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out of Session</span>
                      </button>
                    </div>
                  </div>
                )}

                {editProfileOpen && role === 'hospital' && typeof document !== 'undefined' && createPortal(
                  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={() => setEditProfileOpen(false)}>
                    <form
                      onSubmit={handleSaveProfile}
                      onClick={(event) => event.stopPropagation()}
                      className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp my-auto"
                    >
                      <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
                        <div>
                          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-600">Hospital Profile</p>
                          <h2 className="text-lg font-extrabold text-slate-900 mt-1">Hospital Details</h2>
                        </div>
                        <button type="button" onClick={() => setEditProfileOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close profile editor">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5">
                        {[
                          ['name', 'Hospital name'],
                          ['email', 'Email address'],
                          ['phone', 'Phone number'],
                          ['registrationNo', 'Registration number'],
                          ['city', 'City'],
                          ['state', 'State'],
                        ].map(([field, label]) => (
                          <label key={field} className="space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
                            <input
                              name={field}
                              value={editFormData[field] || ''}
                              onChange={handleProfileChange}
                              required={field === 'name' || field === 'email'}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
                            />
                          </label>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2 px-5 py-4 bg-slate-50 border-t border-slate-100">
                        <button type="button" onClick={() => setEditProfileOpen(false)} className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" className="px-3.5 py-2 rounded-xl bg-primary-600 text-xs font-bold text-white hover:bg-primary-700">Save Changes</button>
                      </div>
                    </form>
                  </div>,
                  document.body
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:text-primary-600 hover:bg-primary-50/60 rounded-lg transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Link>

                <Link
                  to="/hospital-signup"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-md shadow-primary-600/20 rounded-lg transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Join Platform</span>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <div className="flex md:hidden items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-6 space-y-3">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-xs font-bold text-slate-700 hover:text-primary-600"
          >
            Home
          </Link>
          <Link
            to="/how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-xs font-bold text-slate-700 hover:text-primary-600"
          >
            How It Works
          </Link>
          <Link
            to="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-xs font-bold text-slate-700 hover:text-primary-600"
          >
            About Us
          </Link>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            {isAuthenticated ? (
              <>
                <Link
                  to={dashboardPath}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary-600 text-white font-bold text-xs shadow-sm"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Open Portal</span>
                </Link>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-rose-600 bg-rose-50 font-bold text-xs cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-xs"
                >
                  Sign In
                </Link>
                <Link
                  to="/hospital-signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 rounded-lg bg-primary-600 text-white font-bold text-xs"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Logout Confirmation Modal (Portaled to document.body to avoid header containing-block clipping) */}
      {showLogoutConfirm && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 text-center space-y-4 font-sans animate-scaleUp my-auto"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">Sign Out of Session?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Signing out will safely terminate your active authenticated session and purge your session token from this device.
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Confirm Sign Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export default Navbar;
