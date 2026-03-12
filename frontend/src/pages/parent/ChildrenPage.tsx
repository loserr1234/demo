import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import { studentService } from '../../services/studentService';
import { PageLoader } from '../../components/Spinner';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ChildrenPage() {
  const [children, setChildren] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    studentService.getChildren()
      .then((r) => setChildren(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#1e1b4b' }}>My Children</h1>
        <p className="text-sm mt-0.5" style={{ color: '#7c3aed' }}>
          {children.length} {children.length === 1 ? 'child' : 'children'} registered
        </p>
      </div>

      {children.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: '#fff', border: '1px solid #e9d5ff' }}
        >
          <GraduationCap
            style={{ width: '3rem', height: '3rem', color: '#ddd6fe', margin: '0 auto 0.75rem' }}
            aria-hidden="true"
          />
          <p style={{ color: '#8b5cf6' }}>No children registered</p>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map((child) => {
            const c = child as {
              id: string; name: string; class: string; section: string;
              admissionNumber: string; admissionDate: string;
              ledgers: { id: string; month: number; year: number; totalAmount: number; status: string }[];
            };
            const pending  = c.ledgers?.filter((l) => l.status === 'UNPAID' || l.status === 'PARTIAL') ?? [];
            const initials = c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

            return (
              <div
                key={c.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e9d5ff', boxShadow: '0 1px 4px rgba(91,33,182,0.06)' }}
              >
                {/* Card header */}
                <div
                  className="flex items-center gap-4 px-5 py-4"
                  style={{ background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)' }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff' }}
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg" style={{ color: '#1e1b4b' }}>{c.name}</h3>
                    <p className="text-sm" style={{ color: '#6d28d9' }}>Class {c.class} – Section {c.section}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#a78bfa', fontFamily: 'var(--font-mono)' }}>
                      {c.admissionNumber}
                    </p>
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{
                      background: pending.length > 0 ? '#fef2f2' : '#f0fdf4',
                      color: pending.length > 0 ? '#b91c1c' : '#15803d',
                    }}
                  >
                    {pending.length > 0 ? `${pending.length} due` : 'Paid'}
                  </span>
                </div>

                {/* Card body */}
                <div className="px-5 py-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span style={{ color: '#6b7280' }}>Admission Date</span>
                    <span className="font-medium" style={{ color: '#1e1b4b' }}>
                      {new Date(c.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {pending.length > 0 ? (
                    <div className="space-y-2">
                      {pending.slice(0, 2).map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between rounded-xl px-3 py-2.5"
                          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
                        >
                          <div className="flex items-center gap-2">
                            <AlertCircle style={{ width: '1rem', height: '1rem', color: '#ef4444' }} aria-hidden="true" />
                            <span className="text-sm font-medium" style={{ color: '#dc2626' }}>
                              {MONTHS[l.month - 1]} {l.year}
                            </span>
                          </div>
                          <span className="font-bold tabular" style={{ color: '#dc2626' }}>
                            ₹{Number(l.totalAmount).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                      {pending.length > 2 && (
                        <p className="text-xs text-center pt-1" style={{ color: '#9ca3af' }}>
                          +{pending.length - 2} more pending
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                    >
                      <CheckCircle style={{ width: '1rem', height: '1rem', color: '#16a34a' }} aria-hidden="true" />
                      <span className="text-sm font-medium" style={{ color: '#15803d' }}>
                        All fees up to date
                      </span>
                    </div>
                  )}

                  <Link
                    to={`/parent/student/${c.id}/ledger`}
                    className="btn-parent-primary"
                    style={{ marginTop: '0.25rem' }}
                  >
                    View Fee History
                    <ChevronRight style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
