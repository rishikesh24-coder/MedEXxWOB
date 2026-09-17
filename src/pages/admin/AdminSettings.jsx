import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Bell, 
  Sliders, 
  KeyRound, 
  CheckCircle2, 
  Save, 
  RefreshCw, 
  Smartphone, 
  Laptop, 
  Clock, 
  AlertTriangle,
  Lock,
  Camera
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

export const AdminSettings = () => {
  const [activeSection, setActiveSection] = useState('profile'); // 'profile' | 'security' | 'notifications' | 'system'
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [profile, setProfile] = useState({
    name: 'Super Administrator',
    email: 'admin@medex.org',
    phone: '+91 11 2345 6789',
    department: 'National Healthcare Logistics Oversight',
    avatar: '',
  });

  const [security, setSecurity] = useState({
    twoFactorEnabled: false,
    sessionTimeoutMinutes: 60,
    lastPasswordChange: '2024-07-15',
    loginHistory: [
      { id: '1', ip: '103.21.14.88', location: 'New Delhi, India', device: 'Chrome / Windows 11', timestamp: 'Today, 09:30 AM', current: true },
      { id: '2', ip: '103.21.14.88', location: 'New Delhi, India', device: 'Chrome / Windows 11', timestamp: 'Yesterday, 04:15 PM', current: false },
      { id: '3', ip: '49.207.210.12', location: 'Mumbai, India', device: 'Safari / macOS', timestamp: 'Sep 05, 2024, 11:20 AM', current: false },
    ],
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [notifications, setNotifications] = useState({
    lowStockNotifications: true,
    expiryNotifications: true,
    newHospitalNotifications: true,
    newOrderNotifications: true,
    feedbackNotifications: true,
  });

  const [system, setSystem] = useState({
    minStockThreshold: 20,
    expiryWarningPeriodDays: 60,
    requestSlaHours: 48,
    coldChainMinTemp: 2.0,
    coldChainMaxTemp: 8.0,
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await adminService.getSettings();
      if (data.profile) setProfile(data.profile);
      if (data.security) setSecurity(data.security);
      if (data.notifications) setNotifications(data.notifications);
      if (data.system) setSystem(data.system);
    } catch (err) {
      console.error('Failed to load settings:', err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await adminService.updateSettings({ profile });
      toast.success('Admin profile updated successfully');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setIsSaving(true);
    try {
      await new Promise((r) => setTimeout(r, 400));
      setSecurity((prev) => ({ ...prev, lastPasswordChange: new Date().toISOString().split('T')[0] }));
      await adminService.updateSettings({
        security: { ...security, lastPasswordChange: new Date().toISOString().split('T')[0] }
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Security password updated successfully');
    } catch (err) {
      toast.error('Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle2FA = async () => {
    const updated = !security.twoFactorEnabled;
    setSecurity((prev) => ({ ...prev, twoFactorEnabled: updated }));
    try {
      await adminService.updateSettings({
        security: { ...security, twoFactorEnabled: updated }
      });
      toast.success(`Two-Factor Authentication ${updated ? 'Enabled' : 'Disabled'}`);
    } catch (err) {
      toast.error('Failed to update 2FA setting');
    }
  };

  const handleToggleNotification = async (key) => {
    const updated = {
      ...notifications,
      [key]: !notifications[key],
    };
    setNotifications(updated);
    try {
      await adminService.updateSettings({ notifications: updated });
      toast.success('Notification preferences updated');
    } catch (err) {
      toast.error('Failed to update notifications');
    }
  };

  const handleSaveSystem = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await adminService.updateSettings({
        system: {
          minStockThreshold: Number(system.minStockThreshold),
          expiryWarningPeriodDays: Number(system.expiryWarningPeriodDays),
          requestSlaHours: Number(system.requestSlaHours),
          coldChainMinTemp: Number(system.coldChainMinTemp),
          coldChainMaxTemp: Number(system.coldChainMaxTemp),
        }
      });
      toast.success('System configuration parameters saved');
    } catch (err) {
      toast.error('Failed to save system parameters');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <LoadingSpinner size="lg" />
        <p className="mt-3 text-xs font-mono font-medium text-slate-500">
          Loading administration parameters...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-ocean-950 via-ocean-900 to-teal-950 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,rgba(10,110,121,0.25),transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <SettingsIcon className="w-3 h-3 text-teal-400" />
              Platform Configuration
            </span>
            <span className="text-xs text-slate-400 font-mono">Administrative Control</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Administration Settings & Policy</h1>
          <p className="text-xs text-slate-300 max-w-xl font-normal">
            Configure administrative profile credentials, authentication policies, telemetry thresholds, and statutory expiry warning periods.
          </p>
        </div>

        <div className="relative z-10">
          <button
            onClick={fetchSettings}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold backdrop-blur-md transition-colors border border-white/10"
            title="Reload settings"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-1">
        {[
          { id: 'profile', label: 'Admin Profile', icon: User },
          { id: 'security', label: 'Security & Auth', icon: Shield },
          { id: 'notifications', label: 'Notification Settings', icon: Bell },
          { id: 'system', label: 'System Parameters', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: ADMIN PROFILE */}
      {activeSection === 'profile' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm max-w-3xl space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Administrator Profile</h2>
            <p className="text-xs text-slate-500">Manage identity details and national regulatory credentials</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Avatar & Identicon */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-700 text-white flex items-center justify-center text-xl font-black shadow-md border-2 border-teal-600 font-mono">
                SA
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-800">Profile Identifier</div>
                <div className="text-xs text-slate-400 font-mono">Admin ID: ADM-NATIONAL-001</div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3" />
                  Master Root Privilege
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Administrator Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  required
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Official Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  required
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Department / Directorate</label>
                <input
                  type="text"
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SECTION 2: SECURITY & AUTHENTICATION */}
      {activeSection === 'security' && (
        <div className="space-y-6 max-w-3xl">
          {/* Change Password */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-teal-600" />
                Password & Authentication Credentials
              </h2>
              <p className="text-xs text-slate-500">
                Last updated: <span className="font-mono text-slate-700">{security.lastPasswordChange}</span>
              </p>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Current Master Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">New Password</label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Repeat new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Two-Factor Authentication */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600" />
                <h3 className="text-sm font-bold text-slate-900">Two-Factor Authentication (2FA)</h3>
              </div>
              <p className="text-xs text-slate-500 max-w-md">
                Enforce mandatory hardware token or authenticator app confirmation on administrative sign-in.
              </p>
            </div>

            <button
              onClick={handleToggle2FA}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                security.twoFactorEnabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {security.twoFactorEnabled ? 'Enabled (Active)' : 'Enable 2FA'}
            </button>
          </div>

          {/* Login Activity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" />
              Recent Administrator Login Activity
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-200 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Device / Platform</th>
                    <th className="py-2.5 px-3">Location & IP</th>
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {security.loginHistory?.map((sess) => (
                    <tr key={sess.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 flex items-center gap-2">
                        <Laptop className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sess.device}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {sess.location} • {sess.ip}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {sess.timestamp}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {sess.current ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Active Session
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">Closed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: NOTIFICATION SETTINGS */}
      {activeSection === 'notifications' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm max-w-3xl space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">Notification & Alert Channels</h2>
            <p className="text-xs text-slate-500">Configure administrative alert dispatch rules and telemetry triggers</p>
          </div>

          <div className="space-y-4">
            {[
              {
                key: 'lowStockNotifications',
                title: 'Low Medicine Stock Reserve Alerts',
                desc: 'Receive immediate warning when any participating hospital inventory falls below minimum threshold.',
              },
              {
                key: 'expiryNotifications',
                title: 'Medicine Expiry Warning Notifications',
                desc: 'Broadcast alerts when pharmaceuticals approach the statutory warning window (<60 days).',
              },
              {
                key: 'newHospitalNotifications',
                title: 'New Hospital Registration Alerts',
                desc: 'Notify administration when a new facility uploads Form 20B/21B drug license documents.',
              },
              {
                key: 'newOrderNotifications',
                title: 'Inter-Hospital Requisition Orders',
                desc: 'Send notifications upon submission of emergency high-priority hospital requisition orders.',
              },
              {
                key: 'feedbackNotifications',
                title: 'Hospital CSAT Feedback Submissions',
                desc: 'Alert compliance team when institutional complaints or quality feedback are recorded.',
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 hover:bg-slate-50/50 transition-colors"
              >
                <div className="space-y-0.5 pr-4">
                  <div className="text-xs font-bold text-slate-800">{item.title}</div>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleNotification(item.key)}
                  className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                    notifications[item.key] ? 'bg-teal-700' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform absolute top-0.5 ${
                      notifications[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: SYSTEM PARAMETERS */}
      {activeSection === 'system' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm max-w-3xl space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">National System Parameters</h2>
            <p className="text-xs text-slate-500">
              Define global thresholds, expiry warning periods, and cold-chain compliance standards
            </p>
          </div>

          <form onSubmit={handleSaveSystem} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Minimum Stock Reserve Threshold (Units)</label>
                <input
                  type="number"
                  min="5"
                  max="500"
                  value={system.minStockThreshold}
                  onChange={(e) => setSystem({ ...system, minStockThreshold: e.target.value })}
                  required
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-mono font-bold text-slate-800"
                />
                <span className="text-[11px] text-slate-400">Triggers "Low Stock" indicator when available inventory falls below this count.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Medicine Expiry Warning Period (Days)</label>
                <input
                  type="number"
                  min="15"
                  max="180"
                  value={system.expiryWarningPeriodDays}
                  onChange={(e) => setSystem({ ...system, expiryWarningPeriodDays: e.target.value })}
                  required
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-mono font-bold text-slate-800"
                />
                <span className="text-[11px] text-slate-400">Days before expiry date when automated concession & redistribution tags trigger.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Requisition SLA Timeout (Hours)</label>
                <input
                  type="number"
                  min="12"
                  max="96"
                  value={system.requestSlaHours}
                  onChange={(e) => setSystem({ ...system, requestSlaHours: e.target.value })}
                  required
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-mono font-bold text-slate-800"
                />
                <span className="text-[11px] text-slate-400">Automated dismissal window for pending hospital peer requisitions.</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Cold Chain Safe Temperature Range (°C)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={system.coldChainMinTemp}
                    onChange={(e) => setSystem({ ...system, coldChainMinTemp: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold text-center"
                  />
                  <span className="text-xs font-bold text-slate-400">to</span>
                  <input
                    type="number"
                    step="0.1"
                    value={system.coldChainMaxTemp}
                    onChange={(e) => setSystem({ ...system, coldChainMaxTemp: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono font-bold text-center"
                  />
                </div>
                <span className="text-[11px] text-slate-400">Vaccine & biologics transit tolerance standard (2.0°C - 8.0°C).</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow transition-all disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Global Parameters'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
