import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, CreditCard, Receipt,
  History, LogOut, Menu, X, GraduationCap
} from 'lucide-react';
import { useAuthStore } from '../state/authStore';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/admin',            label: 'Dashboard',   icon: LayoutDashboard, end: true },
  { to: '/admin/students',   label: 'Students',     icon: Users },
  { to: '/admin/ledgers',    label: 'Ledgers',      icon: FileText },
  { to: '/admin/payments',   label: 'Payments',     icon: CreditCard },
  { to: '/admin/receipts',   label: 'Receipts',     icon: Receipt },
  { to: '/admin/audit-logs', label: 'Audit Logs',   icon: History },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  const Nav = () => (
    <nav aria-label="Admin navigation" className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
              isActive
                ? 'bg-blue-500/15 text-blue-400'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-400 rounded-r-full"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}
                aria-hidden="true"
                style={{ width: '1.125rem', height: '1.125rem' }}
              />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const Sidebar = () => (
    <div className="flex flex-col h-full" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
          aria-hidden="true"
        >
          <GraduationCap style={{ width: '1rem', height: '1rem', color: '#fff' }} />
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm leading-none truncate">Vidya School</p>
          <p className="text-slate-500 text-xs mt-0.5">Admin Portal</p>
        </div>
      </div>

      <Nav />

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-white/5 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
            aria-hidden="true"
          >
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-xs font-medium truncate">{user?.name}</p>
            <p className="text-slate-500 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors duration-150"
          aria-label="Sign out"
        >
          <LogOut style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="admin-root min-h-screen flex">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-56 min-h-screen fixed left-0 top-0 bottom-0 z-30"
        style={{ background: '#0c1520' }}
        aria-label="Sidebar"
      >
        <Sidebar />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="relative flex flex-col w-56 min-h-screen z-10 animate-slide-left"
            style={{ background: '#0c1520' }}
          >
            <button
              className="absolute top-4 right-3 text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation menu"
            >
              <X style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main id="main-content" className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Topbar */}
        <header
          className="sticky top-0 z-40 flex items-center gap-3 px-5 py-3.5 border-b"
          style={{ background: 'rgba(240,244,248,0.9)', backdropFilter: 'blur(12px)', borderColor: '#e2e8f0' }}
        >
          <button
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
          >
            <Menu style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <span>Welcome back,</span>
            <span className="font-semibold text-slate-800">{user?.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium tabular"
              style={{ background: '#eff6ff', color: '#1d4ed8' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"
                aria-hidden="true"
                style={{ animation: 'none' }}
              />
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </header>

        <div className="flex-1 p-5 lg:p-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
