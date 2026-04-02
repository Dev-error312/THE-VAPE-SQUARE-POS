import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'

import AuthPage from './components/auth/AuthPage'
import RegisterBusinessPage from './components/auth/RegisterBusinessPage'
import AuthCallbackPage from './components/auth/AuthCallbackPage'
import Layout from './components/shared/Layout'
import ProtectedRoute from './components/shared/ProtectedRoute'
import DashboardPage from './components/dashboard/DashboardPage'
import POSPage from './components/pos/POSPage'
import InventoryPage from './components/inventory/InventoryPage'
import ReportsPage from './components/reports/ReportsPage'
import AnalyticsPage from './components/analytics/AnalyticsPage'
import ExpensesPage from './components/expenses/ExpensesPage'
import CreditsPage from './components/credits/CreditsPage'
import WholesalePage from './components/wholesale/WholesalePage'
import ProfilePage from './components/profile/ProfilePage'
import EmployeesPage from './components/employees/EmployeesPage'

export default function App() {
  const initialize = useAuthStore(s => s.initialize)
  const user = useAuthStore(s => s.user)
  
  useEffect(() => { initialize() }, [initialize])

  // Update document title with business name
  useEffect(() => {
    if (user?.business_name) {
      document.title = `Vyapaar - ${user.business_name}`
    } else {
      document.title = 'Vyapaar'
    }
  }, [user?.business_name])

  /** Standard protected route — any authenticated user */
  const wrap = (child: React.ReactNode) => (
    <ProtectedRoute><Layout>{child}</Layout></ProtectedRoute>
  )

  /** Admin-only protected route — redirects cashiers to /dashboard */
  const adminWrap = (child: React.ReactNode) => (
    <ProtectedRoute adminOnly><Layout>{child}</Layout></ProtectedRoute>
  )

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155', borderRadius: '12px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login"          element={<AuthPage />} />
        <Route path="/register"       element={<RegisterBusinessPage />} />
        <Route path="/auth-callback"  element={<AuthCallbackPage />} />
        <Route path="/"               element={wrap(<Navigate to="/dashboard" replace />)} />
        <Route path="/dashboard" element={wrap(<DashboardPage />)} />
        <Route path="/pos"       element={wrap(<POSPage />)} />
        <Route path="/inventory" element={wrap(<InventoryPage />)} />
        <Route path="/reports"   element={wrap(<ReportsPage />)} />
        <Route path="/wholesale" element={wrap(<WholesalePage />)} />
        <Route path="/profile"   element={wrap(<ProfilePage />)} />
        <Route path="/expenses"  element={wrap(<ExpensesPage />)} />
        {/* Admin-only routes — cashiers are redirected to /dashboard */}
        <Route path="/analytics" element={adminWrap(<AnalyticsPage />)} />
        <Route path="/credits"   element={adminWrap(<CreditsPage />)} />
        <Route path="/employees" element={adminWrap(<EmployeesPage />)} />
        <Route path="*"          element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
