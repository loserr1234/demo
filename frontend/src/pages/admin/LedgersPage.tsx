import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, FileText, ChevronDown, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ledgerService } from '../../services/ledgerService';
import { PageLoader } from '../../components/Spinner';
import Pagination from '../../components/Pagination';
import { LedgerBadge } from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface Ledger {
  id: string; month: number; year: number; baseAmount: number; lateFee: number;
  totalAmount: number; totalPaid: number; remaining: number; status: string; dueDate: string;
  student: { name: string; admissionNumber: string; class: string; section: string };
}

const STATUS_FILTERS = [
  { value: '',        label: 'All' },
  { value: 'UNPAID',  label: 'Unpaid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PAID',    label: 'Paid' },
  { value: 'WAIVED',  label: 'Waived' },
];

export default function LedgersPage() {
  const [searchParams] = useSearchParams();
  const [ledgers, setLedgers]       = useState<Ledger[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [editLedger, setEditLedger]     = useState<Ledger | null>(null);
  const [editForm, setEditForm]         = useState({ baseAmount: '', lateFee: '', status: '' });
  const [submitting, setSubmitting]     = useState(false);

  const fetchLedgers = async () => {
    setLoading(true);
    try {
      const res = await ledgerService.getAll({ page, limit: 10, status: statusFilter || undefined });
      const d = res.data.data;
      setLedgers(d.ledgers);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { toast.error('Failed to load ledgers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLedgers(); }, [page, statusFilter]);

  const openEdit = (l: Ledger) => {
    if (l.status === 'PAID') { toast.error('Cannot edit a paid ledger'); return; }
    setEditForm({ baseAmount: String(l.baseAmount), lateFee: String(l.lateFee), status: l.status });
    setEditLedger(l);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLedger) return;
    setSubmitting(true);
    try {
      await ledgerService.update(editLedger.id, {
        baseAmount: parseFloat(editForm.baseAmount),
        lateFee: parseFloat(editForm.lateFee),
        status: editForm.status,
      });
      toast.success('Ledger updated!');
      setEditLedger(null);
      fetchLedgers();
    } catch { toast.error('Update failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Fee Ledgers</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>{total} total entries</p>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              aria-pressed={statusFilter === f.value}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: statusFilter === f.value ? '#2563eb' : '#f1f5f9',
                color: statusFilter === f.value ? '#fff' : '#475569',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e8edf2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {loading ? <PageLoader /> : ledgers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#94a3b8' }}>
            <FileText style={{ width: '3rem', height: '3rem', opacity: 0.3, marginBottom: '0.75rem' }} aria-hidden="true" />
            <p className="font-medium">No ledgers found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Student</th>
                    <th className="table-th">Period</th>
                    <th className="table-th">Base Fee</th>
                    <th className="table-th">Late Fee</th>
                    <th className="table-th">Total</th>
                    <th className="table-th">Paid</th>
                    <th className="table-th">Remaining</th>
                    <th className="table-th">Due Date</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgers.map((l) => (
                    <tr key={l.id} className="table-row">
                      <td className="table-td">
                        <p className="font-semibold" style={{ color: '#0f172a' }}>{l.student?.name}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>Class {l.student?.class}–{l.student?.section}</p>
                      </td>
                      <td className="table-td font-medium" style={{ color: '#334155' }}>
                        {MONTHS[l.month - 1].slice(0, 3)} {l.year}
                      </td>
                      <td className="table-td tabular" style={{ color: '#374151' }}>₹{Number(l.baseAmount).toLocaleString('en-IN')}</td>
                      <td className="table-td tabular">
                        {Number(l.lateFee) > 0
                          ? <span style={{ color: '#ef4444', fontWeight: 500 }}>₹{Number(l.lateFee)}</span>
                          : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td className="table-td font-semibold tabular" style={{ color: '#0f172a' }}>₹{Number(l.totalAmount).toLocaleString('en-IN')}</td>
                      <td className="table-td tabular" style={{ color: '#16a34a', fontWeight: 500 }}>₹{Number(l.totalPaid).toLocaleString('en-IN')}</td>
                      <td className="table-td tabular">
                        {Number(l.remaining) > 0
                          ? <span style={{ color: '#ef4444', fontWeight: 500 }}>₹{Number(l.remaining).toLocaleString('en-IN')}</span>
                          : <span style={{ color: '#86efac' }}>—</span>}
                      </td>
                      <td className="table-td text-xs" style={{ color: '#64748b' }}>
                        {new Date(l.dueDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="table-td"><LedgerBadge status={l.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} /></td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/admin/ledger/${l.id}`}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#3b82f6' }}
                            aria-label="View ledger details"
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <Eye style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                          </Link>
                          <button
                            onClick={() => openEdit(l)}
                            disabled={l.status === 'PAID'}
                            className="p-2 rounded-lg transition-colors disabled:opacity-30"
                            style={{ color: '#64748b' }}
                            aria-label="Edit ledger"
                            onMouseEnter={(e) => !l.status.includes('PAID') && (e.currentTarget.style.background = '#f1f5f9')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <Edit2 style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} limit={10} />
          </>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={!!editLedger} onClose={() => setEditLedger(null)} title="Edit Ledger">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="label" htmlFor="edit-base">Base Amount (₹)</label>
            <input id="edit-base" type="number" className="input" value={editForm.baseAmount} onChange={(e) => setEditForm({ ...editForm, baseAmount: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="edit-late">Late Fee (₹)</label>
            <input id="edit-late" type="number" className="input" value={editForm.lateFee} onChange={(e) => setEditForm({ ...editForm, lateFee: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="edit-status">Status</label>
            <div className="relative">
              <select id="edit-status" className="select pr-8" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partial</option>
                <option value="WAIVED">Waived</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} aria-hidden="true" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditLedger(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? 'Saving…' : 'Update Ledger'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
