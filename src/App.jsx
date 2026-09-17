import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Toaster, toast } from 'react-hot-toast';
import { logoutUser } from './store/slices/authSlice';

// Layouts (Static for structural stability)
import MainLayout from './layouts/MainLayout';
import HospitalLayout from './layouts/HospitalLayout';
import AdminLayout from './layouts/AdminLayout';

// Critical Initial Pages (Static for instant first render)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';

// Secondary Auth Pages (Lazy)
const HospitalSignupPage = lazy(() => import('./pages/auth/HospitalSignupPage'));
const AdminSignupPage = lazy(() => import('./pages/auth/AdminSignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const EmailVerificationPage = lazy(() => import('./pages/auth/EmailVerificationPage'));

// Informational & Legal Pages (Lazy)
const AboutPage = lazy(() => import('./pages/AboutPage'));
const HowItWorksPage = lazy(() => import('./pages/HowItWorksPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const CookiePreferencesPage = lazy(() => import('./pages/CookiePreferencesPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Hospital Portal Pages (Lazy)
const HospitalDashboard = lazy(() => import('./pages/hospital/HospitalDashboard'));
const HospitalInventory = lazy(() => import('./pages/hospital/HospitalInventory'));
const Marketplace = lazy(() => import('./pages/hospital/Marketplace'));
const MyRequests = lazy(() => import('./pages/hospital/MyRequests'));
const IncomingRequests = lazy(() => import('./pages/hospital/IncomingRequests'));
const HistoryPage = lazy(() => import('./pages/hospital/HistoryPage'));
const TrackPage = lazy(() => import('./pages/hospital/TrackPage'));
const PaymentHistory = lazy(() => import('./pages/hospital/PaymentHistory'));
const HospitalFeedback = lazy(() => import('./pages/hospital/HospitalFeedback'));
const HospitalProfilePage = lazy(() => import('./pages/hospital/HospitalProfilePage'));
const HospitalReports = lazy(() => import('./pages/hospital/HospitalReports'));
const HospitalAlerts = lazy(() => import('./pages/hospital/HospitalAlerts'));

// Smart redirect helper for legacy /hospital/requests paths that preserves search params
const RequestsRedirect = () => {
  const location = window.location;
  return <Navigate to={`/hospital/my-requests${location.search || ''}`} replace />;
};

// Admin Portal Pages (Lazy)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminHospitals = lazy(() => import('./pages/admin/AdminHospitals'));
const AdminHospitalDetails = lazy(() => import('./pages/admin/AdminHospitalDetails'));
const AdminVerification = lazy(() => import('./pages/admin/AdminVerification'));
const AdminMedicineData = lazy(() => import('./pages/admin/AdminMedicineData'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminAlerts = lazy(() => import('./pages/admin/AdminAlerts'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminManagement = lazy(() => import('./pages/admin/AdminManagement'));

// Protected Route Wrapper, Error Boundary & Fallback
import ProtectedRoute from './components/common/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import RouteLoadingFallback from './components/common/RouteLoadingFallback';

export const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const handleSessionExpired = () => {
      dispatch(logoutUser());
      toast.error('Session expired or unauthorized. Please sign in again.');
    };
    window.addEventListener('medex:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('medex:session-expired', handleSessionExpired);
    };
  }, [dispatch]);

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1A3A4A',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: '600',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.2)',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#FFFFFF',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#FFFFFF',
            },
          },
        }}
      />

      <ErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback text="Loading MedEx application..." />}>
          <Routes>
            {/* Public Informational & Auth Routes with MainLayout */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/cookie-preferences" element={<CookiePreferencesPage />} />

              {/* Authentication & Security Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/hospital-signup" element={<HospitalSignupPage />} />
              <Route path="/admin-signup" element={<AdminSignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<EmailVerificationPage />} />
            </Route>

            {/* Hospital Portal Routes */}
            <Route
              path="/hospital"
              element={
                <ProtectedRoute allowedRole="hospital">
                  <HospitalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/hospital/dashboard" replace />} />
              <Route path="dashboard" element={<HospitalDashboard />} />
              <Route path="inventory" element={<HospitalInventory />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="my-requests" element={<MyRequests />} />
              <Route path="incoming-requests" element={<IncomingRequests />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="track" element={<TrackPage />} />
              <Route path="payment-history" element={<PaymentHistory />} />
              <Route path="feedback" element={<HospitalFeedback />} />
              <Route path="reports" element={<HospitalReports />} />
              <Route path="profile" element={<HospitalProfilePage />} />
              <Route path="alerts" element={<HospitalAlerts />} />
              <Route path="requests" element={<RequestsRedirect />} />
              <Route path="requests/incoming" element={<Navigate to="/hospital/incoming-requests" replace />} />
            </Route>
            <Route path="/hospital-dashboard" element={<Navigate to="/hospital/dashboard" replace />} />

            {/* Admin Portal Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="hospitals" element={<AdminHospitals />} />
              <Route path="hospital-details" element={<AdminHospitalDetails />} />
              <Route path="verification" element={<AdminVerification />} />
              <Route path="medicines" element={<AdminMedicineData />} />
              <Route path="medicine-data" element={<Navigate to="/admin/medicines" replace />} />
              <Route path="inventory" element={<AdminInventory />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="alerts" element={<AdminAlerts />} />
              <Route path="feedback" element={<AdminFeedback />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="management" element={<AdminManagement />} />
            </Route>

            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
};

export default App;

