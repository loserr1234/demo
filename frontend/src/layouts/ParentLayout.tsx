import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Users, LogOut, GraduationCap } from 'lucide-react';
import { useAuthStore } from '../state/authStore';
import { authService } from '../services/authService';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/parent',          label: 'Home',        icon: Home,  end: true },
  { to: '/parent/children', label: 'My Children', icon: Users },
];

export default function ParentLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authService.logout(); } catch { /* ignore */ }
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="parent-root min-h-screen flex flex-col" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-violet-700 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-5 py-4"
        style={{
          background: 'rgba(247,245,240,0.92)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}
            aria-hidden="true"
          >
            <GraduationCap style={{ width: '1rem', height: '1rem', color: '#fff' }} />
          </div>
          <div>
            <p className="text-sm font-bold leading-none" style={{ color: '#3b0764' }}>Vidya School</p>
            <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>Parent Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold" style={{ color: '#1e1b4b' }}>{user?.name}</p>
            <p className="text-xs" style={{ color: '#7c3aed' }}>Parent Account</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: '#f5f3ff', color: '#5b21b6' }}
            aria-label="Sign out of your account"
          >
            <LogOut style={{ width: '0.875rem', height: '0.875rem' }} aria-hidden="true" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main
        id="main-content"
        className="flex-1 px-4 pt-6 pb-28 max-w-lg mx-auto w-full"
        style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom))' }}
      >
        <Outlet />
      </main>

      {/* Bottom Tab Bar (mobile-first) */}
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors touch-action-manipulation ${
                isActive ? '' : ''
              }`
            }
            aria-label={label}
            style={{ touchAction: 'manipulation' }}
          >
            {({ isActive }) => (
              <>
                <div
                  className="w-12 h-7 rounded-full flex items-center justify-center transition-colors"
                  style={{ background: isActive ? '#ede9fe' : 'transparent' }}
                  aria-hidden="true"
                >
                  <Icon
                    style={{
                      width: '1.125rem', height: '1.125rem',
                      color: isActive ? '#5b21b6' : '#94a3b8',
                    }}
                    aria-hidden="true"
                  />
                </div>
                <span
                  className="text-xs font-semibold"
                  style={{ color: isActive ? '#5b21b6' : '#94a3b8' }}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
