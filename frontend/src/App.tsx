import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './state/authStore';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import ParentLayout from './layouts/ParentLayout';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Admin Pages
import DashboardPage from './pages/admin/DashboardPage';
import StudentsPage from './pages/admin/StudentsPage';
import StudentDetailPage from './pages/admin/StudentDetailPage';
import LedgersPage from './pages/admin/LedgersPage';
import LedgerDetailPage from './pages/admin/LedgerDetailPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import PaymentDetailPage from './pages/admin/PaymentDetailPage';
import ReceiptsPage from './pages/admin/ReceiptsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';

// Parent Pages
import ParentHomePage from './pages/parent/ParentHomePage';
import ChildrenPage from './pages/parent/ChildrenPage';
import StudentLedgerPage from './pages/parent/StudentLedgerPage';

function RequireAuth({ children, role }: { children: React.ReactNode; role?: string }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) {
    return <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/parent'} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#111827',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            border: '1px solid #f3f4f6',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />

      <Routes>
        <Route path="/login" element={
          isAuthenticated
            ? <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/parent'} replace />
            : <LoginPage />
        } />

        <Route path="/admin" element={
          <RequireAuth role="ADMIN"><AdminLayout /></RequireAuth>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="student/:id" element={<StudentDetailPage />} />
          <Route path="ledgers" element={<LedgersPage />} />
          <Route path="ledger/:id" element={<LedgerDetailPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payment/:id" element={<PaymentDetailPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="audit-logs" element={<AuditLogsPage />} />
        </Route>

        <Route path="/parent" element={
          <RequireAuth role="PARENT"><ParentLayout /></RequireAuth>
        }>
          <Route index element={<ParentHomePage />} />
          <Route path="children" element={<ChildrenPage />} />
          <Route path="student/:id/ledger" element={<StudentLedgerPage />} />
        </Route>

        <Route path="/" element={
          isAuthenticated
            ? <Navigate to={user?.role === 'ADMIN' ? '/admin' : '/parent'} replace />
            : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
