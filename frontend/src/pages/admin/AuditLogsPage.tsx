import { useEffect, useState } from 'react';
import { History, User, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentService } from '../../services/studentService';
import { PageLoader } from '../../components/Spinner';
import Pagination from '../../components/Pagination';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user: { name: string; email: string; role: string };
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

const ACTION_STYLE: Record<string, { bg: string; color: string }> = {
  UPDATE_STUDENT:          { bg: '#eff6ff', color: '#1d4ed8' },
  MANUAL_PAYMENT:          { bg: '#f0fdf4', color: '#15803d' },
  UPDATE_LEDGER:           { bg: '#f5f3ff', color: '#6d28d9' },
  STUDENT_STATUS_ACTIVE:   { bg: '#f0fdf4', color: '#15803d' },
  STUDENT_STATUS_INACTIVE: { bg: '#fef2f2', color: '#b91c1c' },
};

export default function AuditLogsPage() {
  const [logs, setLogs]             = useState<AuditLog[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<AuditLog | null>(null);

  useEffect(() => {
    setLoading(true);
    studentService.getAuditLogs({ page, limit: 20 })
      .then((r) => {
        const d = r.data.data;
        setLogs(d.logs);
        setTotal(d.total);
        setTotalPages(d.totalPages);
      })
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Audit Logs</h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>{total} total entries</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Log list */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e8edf2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {loading ? <PageLoader /> : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16" style={{ color: '#94a3b8' }}>
                <History style={{ width: '3rem', height: '3rem', opacity: 0.3, marginBottom: '0.75rem' }} aria-hidden="true" />
                <p>No audit logs found</p>
              </div>
            ) : (
              <>
                <div style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {logs.map((l) => {
                    const actionStyle = ACTION_STYLE[l.action] || { bg: '#f8fafc', color: '#475569' };
                    const isSelected = selected?.id === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setSelected(l)}
                        className="w-full text-left px-5 py-4 flex items-start gap-4 transition-colors"
                        style={{
                          background: isSelected ? '#f8fbff' : 'transparent',
                          borderBottom: '1px solid #f8fafc',
                        }}
                        aria-pressed={isSelected}
                        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = '#f8fbff')}
                        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                      >
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: '#f1f5f9' }}
                          aria-hidden="true"
                        >
                          <User style={{ width: '1rem', height: '1rem', color: '#64748b' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                              style={{ background: actionStyle.bg, color: actionStyle.color }}
                            >
                              {l.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs" style={{ color: '#94a3b8' }}>
                              {l.entityType} · {l.entityId.slice(0, 8)}…
                            </span>
                          </div>
                          <p className="text-sm mt-1" style={{ color: '#334155' }}>{l.user?.name}</p>
                          <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#94a3b8' }}>
                            <Clock style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
                            {new Date(l.createdAt).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} limit={20} />
              </>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {selected ? (
            <div className="card sticky top-24">
              <h3 className="font-semibold mb-4" style={{ color: '#0f172a' }}>Log Details</h3>
              <div className="space-y-3">
                <Detail label="Action" value={selected.action} />
                <Detail label="Entity" value={selected.entityType} />
                <Detail label="By" value={selected.user?.name} />
                <Detail label="Email" value={selected.user?.email} />
                <Detail label="Role" value={selected.user?.role} />
                <Detail label="Time" value={new Date(selected.createdAt).toLocaleString('en-IN')} />
              </div>
              {selected.newValue && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748b' }}>
                    New Values
                  </p>
                  <pre
                    className="text-xs rounded-xl p-3 overflow-auto max-h-40"
                    style={{ background: '#f8fafc', color: '#475569', fontFamily: 'var(--font-mono)' }}
                  >
                    {JSON.stringify(selected.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-10" style={{ color: '#94a3b8' }}>
              <History style={{ width: '2rem', height: '2rem', margin: '0 auto 0.5rem', opacity: 0.3 }} aria-hidden="true" />
              <p className="text-sm">Select a log to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: '#94a3b8' }}>{label}</p>
      <p className="text-sm font-medium mt-0.5" style={{ color: '#334155' }}>{value}</p>
    </div>
  );
}
