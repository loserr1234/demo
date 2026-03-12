import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentService } from '../../services/paymentService';
import { PageLoader } from '../../components/Spinner';
import Pagination from '../../components/Pagination';
import { PaymentBadge } from '../../components/StatusBadge';

interface Payment {
  id: string; amountPaid: number; paymentMethod: string; source: string;
  paymentDate: string; status: string; referenceNumber?: string;
  receipt?: { receiptNumber: string };
  ledger: { student: { name: string; admissionNumber: string }; month: number; year: number };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const METHOD_STYLES: Record<string, { bg: string; color: string }> = {
  RAZORPAY: { bg: '#eff6ff', color: '#1d4ed8' },
  CASH:     { bg: '#f0fdf4', color: '#15803d' },
  UPI:      { bg: '#f5f3ff', color: '#6d28d9' },
  BANK:     { bg: '#fff7ed', color: '#c2410c' },
};

const STATUS_FILTERS = [
  { value: '',        label: 'All' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILED',  label: 'Failed' },
];

export default function PaymentsPage() {
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await paymentService.getAll({ page, limit: 10, status: statusFilter || undefined });
      const d = res.data.data;
      setPayments(d.payments);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { toast.error('Failed to load payments'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPayments(); }, [page, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Payments</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>{total} total transactions</p>
        </div>
      </div>

      <div className="card" style={{ padding: '1rem' }}>
        <div className="flex gap-2" role="group" aria-label="Filter by status">
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
        {loading ? <PageLoader /> : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#94a3b8' }}>
            <IndianRupee style={{ width: '3rem', height: '3rem', opacity: 0.3, marginBottom: '0.75rem' }} aria-hidden="true" />
            <p className="font-medium">No payments found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Student</th>
                    <th className="table-th">Period</th>
                    <th className="table-th">Amount</th>
                    <th className="table-th">Method</th>
                    <th className="table-th">Source</th>
                    <th className="table-th">Date</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Receipt</th>
                    <th className="table-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const methodStyle = METHOD_STYLES[p.paymentMethod] || { bg: '#f8fafc', color: '#475569' };
                    return (
                      <tr key={p.id} className="table-row">
                        <td className="table-td">
                          <p className="font-semibold" style={{ color: '#0f172a' }}>{p.ledger?.student?.name}</p>
                          <p className="text-xs" style={{ color: '#94a3b8' }}>{p.ledger?.student?.admissionNumber}</p>
                        </td>
                        <td className="table-td font-medium" style={{ color: '#334155' }}>
                          {MONTHS[(p.ledger?.month || 1) - 1]} {p.ledger?.year}
                        </td>
                        <td className="table-td font-bold tabular" style={{ color: '#0f172a' }}>
                          ₹{Number(p.amountPaid).toLocaleString('en-IN')}
                        </td>
                        <td className="table-td">
                          <span
                            className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold"
                            style={{ background: methodStyle.bg, color: methodStyle.color }}
                          >
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="table-td text-xs" style={{ color: '#64748b' }}>{p.source}</td>
                        <td className="table-td text-xs" style={{ color: '#64748b' }}>
                          {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="table-td"><PaymentBadge status={p.status} /></td>
                        <td className="table-td text-xs" style={{ fontFamily: 'var(--font-mono)', color: '#64748b' }}>
                          {p.receipt?.receiptNumber || '—'}
                        </td>
                        <td className="table-td">
                          <Link
                            to={`/admin/payment/${p.id}`}
                            className="p-2 rounded-lg transition-colors inline-flex"
                            style={{ color: '#3b82f6' }}
                            aria-label="View payment details"
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <Eye style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} limit={10} />
          </>
        )}
      </div>
    </div>
  );
}
