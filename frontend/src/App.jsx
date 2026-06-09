import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthBootstrap from './components/auth/AuthBootstrap';
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminCompanies from './pages/admin/Companies';
import AdminPlans from './pages/admin/Plans';
import AdminSubscriptions from './pages/admin/Subscriptions';
import AdminLicenses from './pages/admin/Licenses';
import AdminUsage from './pages/admin/Usage';
import AdminAudit from './pages/admin/Audit';
import AdminLogin from './pages/admin/Login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        
        {/* Only the Legacy Dashboard is kept */}
        <Route path="/" element={
          <ProtectedRoute allowedRoles={['user', 'super_admin']}>
            <AuthBootstrap>
              <Dashboard />
            </AuthBootstrap>
          </ProtectedRoute>
        } />

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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
