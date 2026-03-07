import { useEffect, useState } from 'react';
import { History, User, Calendar } from 'lucide-react';
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

const ACTION_COLORS: Record<string, string> = {
  UPDATE_STUDENT: 'bg-blue-50 text-blue-700',
  MANUAL_PAYMENT: 'bg-emerald-50 text-emerald-700',
  UPDATE_LEDGER: 'bg-violet-50 text-violet-700',
  STUDENT_STATUS_ACTIVE: 'bg-emerald-50 text-emerald-700',
  STUDENT_STATUS_INACTIVE: 'bg-red-50 text-red-700',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditLog | null>(null);

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
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-500 text-sm mt-0.5">{total} total entries</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08)' }}>
            {loading ? <PageLoader /> : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <History className="w-12 h-12 mb-3 opacity-30" />
                <p>No audit logs found</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {logs.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className={`px-5 py-4 flex items-start gap-4 cursor-pointer hover:bg-blue-50/30 transition-colors ${selected?.id === l.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${ACTION_COLORS[l.action] || 'bg-gray-100 text-gray-600'}`}>
                            {l.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-400">{l.entityType} · {l.entityId.slice(0, 8)}...</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{l.user?.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(l.createdAt).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} limit={20} />
              </>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div>
          {selected ? (
            <div className="card sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Log Details</h3>
              <div className="space-y-3 text-sm">
                <Detail label="Action" value={selected.action} />
                <Detail label="Entity" value={selected.entityType} />
                <Detail label="By" value={selected.user?.name} />
                <Detail label="Email" value={selected.user?.email} />
                <Detail label="Role" value={selected.user?.role} />
                <Detail label="Time" value={new Date(selected.createdAt).toLocaleString('en-IN')} />
              </div>
              {selected.newValue && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">New Values</p>
                  <pre className="text-xs bg-gray-50 rounded-xl p-3 overflow-auto max-h-40 text-gray-600">
                    {JSON.stringify(selected.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-10 text-gray-400">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a log to see details</p>
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
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-700 mt-0.5">{value}</p>
    </div>
  );
}
