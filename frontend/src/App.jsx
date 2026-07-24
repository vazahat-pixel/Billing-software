import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthBootstrap from './components/auth/AuthBootstrap';
import FallbackRedirect from './components/auth/FallbackRedirect';
import { ConfigProvider } from './context/ConfigContext';
import ApiLoader from './components/ui/ApiLoader';
import AppProviders from './providers/AppProviders';

// Stage 7.8 — route-level code splitting (admin / auth lazy; ERP shell eager)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminCompanies = lazy(() => import('./pages/admin/Companies'));
const AdminPlans = lazy(() => import('./pages/admin/Plans'));
const AdminSubscriptions = lazy(() => import('./pages/admin/Subscriptions'));
const AdminLicenses = lazy(() => import('./pages/admin/Licenses'));
const AdminUsage = lazy(() => import('./pages/admin/Usage'));
const AdminAudit = lazy(() => import('./pages/admin/Audit'));
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const AdminModuleControl = lazy(() => import('./pages/admin/ModuleControl'));
const AdminUserManagement = lazy(() => import('./pages/admin/UserManagement'));
const AdminCompanyConfig = lazy(() => import('./pages/admin/CompanyConfig'));
const AdminDynamicConfig = lazy(() => import('./pages/admin/DynamicConfig'));
const PanelPortal = lazy(() => import('./pages/PanelPortal'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-[12px] text-slate-500">
      Loading…
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppProviders>
      <ApiLoader />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/portal" element={<PanelPortal />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/offline-login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Only the Legacy Dashboard is kept */}
        <Route path="/" element={
          <ProtectedRoute allowedRoles={['user', 'super_admin']}>
            <AuthBootstrap>
              <ConfigProvider>
                <Dashboard />
              </ConfigProvider>
            </AuthBootstrap>
          </ProtectedRoute>
        } />

        <Route path="/app" element={<Navigate to="/" replace />} />

        {/* Admin Panel Routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="companies" element={<AdminCompanies />} />
          <Route path="plans" element={<AdminPlans />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="licenses" element={<AdminLicenses />} />
          <Route path="usage" element={<AdminUsage />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="modules" element={<AdminModuleControl />} />
          <Route path="dynamic" element={<AdminDynamicConfig />} />
          <Route path="users" element={<AdminUserManagement />} />
          <Route path="config" element={<AdminCompanyConfig />} />
        </Route>

        <Route path="*" element={<FallbackRedirect />} />
      </Routes>
      </Suspense>
      </AppProviders>
    </Router>
  );
}

export default App;
