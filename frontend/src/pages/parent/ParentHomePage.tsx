import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, ArrowRight, GraduationCap, ChevronRight } from 'lucide-react';
import { studentService } from '../../services/studentService';
import { PageLoader } from '../../components/Spinner';
import { useAuthStore } from '../../state/authStore';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function ParentHomePage() {
  const [children, setChildren] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]   = useState(true);
  const { user }                = useAuthStore();

  useEffect(() => {
    studentService.getChildren()
      .then((r) => setChildren(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const pendingCount = children.filter((c) => {
    const ledgers = (c as { ledgers?: { status: string }[] }).ledgers || [];
    return ledgers.some((l) => l.status === 'UNPAID' || l.status === 'PARTIAL');
  }).length;

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome card */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 60%, #7c3aed 100%)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: '#c4b5fd' }}>{getGreeting()}</p>
            <h1 className="text-xl font-bold mt-0.5" style={{ color: '#fff' }}>{firstName}!</h1>
            <p className="text-sm mt-1" style={{ color: '#a78bfa' }}>
              Vidya School · Parent Portal
            </p>
          </div>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            aria-hidden="true"
          >
            <GraduationCap style={{ width: '1.5rem', height: '1.5rem', color: '#fff' }} />
          </div>
        </div>

        <div className="flex gap-6 mt-5 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <div>
            <p className="text-2xl font-bold tabular" style={{ color: '#fff' }}>{children.length}</p>
            <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>Children</p>
          </div>
          <div>
            <p
              className="text-2xl font-bold tabular"
              style={{ color: pendingCount > 0 ? '#fca5a5' : '#86efac' }}
            >
              {pendingCount}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#a78bfa' }}>Pending Dues</p>
          </div>
        </div>
      </div>

      {/* Pending dues alert */}
      {pendingCount > 0 && (
        <div
          className="flex items-center gap-3 rounded-xl p-4"
          role="alert"
          style={{ background: '#fff7ed', border: '1px solid #fed7aa' }}
        >
          <AlertCircle
            style={{ width: '1.25rem', height: '1.25rem', color: '#ea580c', flexShrink: 0 }}
            aria-hidden="true"
          />
          <p className="text-sm flex-1" style={{ color: '#9a3412' }}>
            <strong>{pendingCount}</strong> {pendingCount === 1 ? 'child has' : 'children have'} pending fee payments.
          </p>
          <Link
            to="/parent/children"
            className="text-sm font-semibold flex items-center gap-1 whitespace-nowrap"
            style={{ color: '#ea580c' }}
          >
            Pay now <ArrowRight style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Children list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold" style={{ color: '#1e1b4b' }}>Your Children</h2>
          <Link
            to="/parent/children"
            className="text-sm font-semibold flex items-center gap-0.5"
            style={{ color: '#7c3aed' }}
          >
            See all <ChevronRight style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
          </Link>
        </div>

        {children.length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{ background: '#fff', border: '1px solid #e9d5ff' }}
          >
            <GraduationCap
              style={{ width: '2.5rem', height: '2.5rem', color: '#ddd6fe', margin: '0 auto 0.75rem' }}
              aria-hidden="true"
            />
            <p className="text-sm" style={{ color: '#8b5cf6' }}>No children registered yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((child) => {
              const c = child as {
                id: string; name: string; class: string; section: string;
                admissionNumber: string; status: string;
                ledgers: { id: string; month: number; year: number; totalAmount: number; status: string }[];
              };
              const pendingLedger = c.ledgers?.find((l) => l.status === 'UNPAID' || l.status === 'PARTIAL');
              const initials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

              return (
                <Link
                  key={c.id}
                  to={`/parent/student/${c.id}/ledger`}
                  className="flex items-center gap-4 rounded-2xl p-4 transition-all"
                  style={{
                    background: '#fff',
                    border: '1px solid #e9d5ff',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                  aria-label={`View fee ledger for ${c.name}`}
                >
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff' }}
                    aria-hidden="true"
                  >
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold" style={{ color: '#1e1b4b' }}>{c.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#7c3aed' }}>
                      Class {c.class} – {c.section}
                    </p>
                  </div>

                  {/* Status pill */}
                  <div className="flex-shrink-0 text-right">
                    {pendingLedger ? (
                      <div>
                        <span
                          className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: '#fef2f2', color: '#b91c1c' }}
                        >
                          Due {MONTHS[pendingLedger.month - 1]}
                        </span>
                        <p className="text-sm font-bold mt-0.5 tabular" style={{ color: '#dc2626' }}>
                          ₹{Number(pendingLedger.totalAmount).toLocaleString('en-IN')}
                        </p>
                      </div>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: '#16a34a' }}
                      >
                        <CheckCircle style={{ width: '0.875rem', height: '0.875rem' }} aria-hidden="true" />
                        Paid
                      </span>
                    )}
                  </div>

                  <ChevronRight
                    style={{ width: '1rem', height: '1rem', color: '#c4b5fd', flexShrink: 0 }}
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
