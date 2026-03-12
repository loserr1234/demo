import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../state/authStore';

export default function LoginPage() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const navigate                  = useNavigate();
  const { login }                 = useAuthStore();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill all fields'); return; }
    setError(null);
    setLoading(true);
    try {
      const res  = await authService.login(email, password);
      const data = res.data.data;

      if (data.mustChangePassword) {
        toast('Please change your temporary password', { icon: '🔑' });
        return;
      }

      login(data.user);
      toast.success(`Welcome, ${data.user.name}!`);
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/parent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ fontFamily: "'DM Sans', sans-serif", background: '#f8fafc' }}
    >
      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-12 relative overflow-hidden"
        style={{ background: '#0c1520' }}
      >
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          aria-hidden="true"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
        {/* Glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-10 blur-3xl pointer-events-none"
          aria-hidden="true"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
        />

        <div className="relative">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-8"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}
            aria-hidden="true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white leading-tight">Vidya School</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            School management & fee collection portal for administrators and parents.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { n: '500+', label: 'Active Students' },
            { n: '98%',  label: 'Collection Rate' },
            { n: '24×7', label: 'Parent Access' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-4">
              <span
                className="text-xl font-bold tabular"
                style={{ color: '#3b82f6', minWidth: '3.5rem' }}
              >{s.n}</span>
              <span className="text-slate-400 text-sm">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: '#0c1520' }}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <span className="font-bold text-slate-900">Vidya School</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900" style={{ textWrap: 'balance' }}>
            Sign in to your account
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">
            Enter your credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  style={{ width: '1rem', height: '1rem' }}
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com…"
                  className="input pl-9"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  style={{ width: '1rem', height: '1rem' }}
                  aria-hidden="true"
                />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-9 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass
                    ? <EyeOff style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                    : <Eye style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                  }
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="px-4 py-3 rounded-lg text-sm font-medium animate-slide-up"
                style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-sm mt-2"
            >
              {loading ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin flex-shrink-0"
                    aria-hidden="true"
                  />
                  Signing in…
                </>
              ) : (
                <>Sign In <ArrowRight style={{ width: '1rem', height: '1rem' }} aria-hidden="true" /></>
              )}
            </button>
          </form>

          {/* Demo creds */}
          <div
            className="mt-8 p-4 rounded-xl space-y-1.5"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Demo credentials</p>
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Admin:</span>{' '}
              admin@school.com / admin@123
            </p>
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Parent:</span>{' '}
              parent1@test.com / parent@123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
