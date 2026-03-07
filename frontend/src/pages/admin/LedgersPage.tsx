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

export default function LedgersPage() {
  const [searchParams] = useSearchParams();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [editLedger, setEditLedger] = useState<Ledger | null>(null);
  const [editForm, setEditForm] = useState({ baseAmount: '', lateFee: '', status: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetch = async () => {
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

  useEffect(() => { fetch(); }, [page, statusFilter]);

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
      fetch();
    } catch { toast.error('Update failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Ledgers</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} total entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          {['', 'UNPAID', 'PARTIAL', 'PAID', 'WAIVED'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                statusFilter === s
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08)' }}>
        {loading ? <PageLoader /> : ledgers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FileText className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No ledgers found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
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
                        <p className="font-semibold text-gray-900">{l.student?.name}</p>
                        <p className="text-xs text-gray-400">Class {l.student?.class}-{l.student?.section}</p>
                      </td>
                      <td className="table-td font-medium">{MONTHS[l.month-1].slice(0,3)} {l.year}</td>
                      <td className="table-td">₹{l.baseAmount.toLocaleString('en-IN')}</td>
                      <td className="table-td">
                        {l.lateFee > 0 ? <span className="text-red-500 font-medium">₹{l.lateFee}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="table-td font-semibold">₹{l.totalAmount.toLocaleString('en-IN')}</td>
                      <td className="table-td text-emerald-600 font-medium">₹{l.totalPaid.toLocaleString('en-IN')}</td>
                      <td className="table-td">
                        {l.remaining > 0
                          ? <span className="text-red-500 font-medium">₹{l.remaining.toLocaleString('en-IN')}</span>
                          : <span className="text-emerald-500">—</span>}
                      </td>
                      <td className="table-td text-xs">{new Date(l.dueDate).toLocaleDateString('en-IN')}</td>
                      <td className="table-td"><LedgerBadge status={l.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} /></td>
                      <td className="table-td">
                        <div className="flex items-center gap-2">
                          <Link to={`/admin/ledger/${l.id}`} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <button onClick={() => openEdit(l)} disabled={l.status === 'PAID'} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30">
                            <Edit2 className="w-4 h-4" />
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
            <label className="label">Base Amount (₹)</label>
            <input type="number" className="input" value={editForm.baseAmount} onChange={(e) => setEditForm({ ...editForm, baseAmount: e.target.value })} />
          </div>
          <div>
            <label className="label">Late Fee (₹)</label>
            <input type="number" className="input" value={editForm.lateFee} onChange={(e) => setEditForm({ ...editForm, lateFee: e.target.value })} />
          </div>
          <div>
            <label className="label">Status</label>
            <div className="relative">
              <select className="select pr-8" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="UNPAID">UNPAID</option>
                <option value="PARTIAL">PARTIAL</option>
                <option value="WAIVED">WAIVED</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditLedger(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? 'Saving...' : 'Update Ledger'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
