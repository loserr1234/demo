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

const METHOD_COLORS: Record<string, string> = {
  RAZORPAY: 'bg-blue-50 text-blue-600',
  CASH: 'bg-emerald-50 text-emerald-600',
  UPI: 'bg-violet-50 text-violet-600',
  BANK: 'bg-amber-50 text-amber-600',
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetch = async () => {
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

  useEffect(() => { fetch(); }, [page, statusFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} total transactions</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex gap-3">
          {['', 'SUCCESS', 'FAILED'].map((s) => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === s ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08)' }}>
        {loading ? <PageLoader /> : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <IndianRupee className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No payments found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
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
                  {payments.map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="table-td">
                        <p className="font-semibold text-gray-900">{p.ledger?.student?.name}</p>
                        <p className="text-xs text-gray-400">{p.ledger?.student?.admissionNumber}</p>
                      </td>
                      <td className="table-td font-medium">
                        {MONTHS[(p.ledger?.month || 1) - 1]} {p.ledger?.year}
                      </td>
                      <td className="table-td">
                        <span className="font-bold text-gray-900">₹{p.amountPaid.toLocaleString('en-IN')}</span>
                      </td>
                      <td className="table-td">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${METHOD_COLORS[p.paymentMethod] || 'bg-gray-50 text-gray-600'}`}>
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="table-td text-xs text-gray-500">{p.source}</td>
                      <td className="table-td text-xs">{new Date(p.paymentDate).toLocaleDateString('en-IN')}</td>
                      <td className="table-td"><PaymentBadge status={p.status} /></td>
                      <td className="table-td text-xs font-mono text-gray-500">{p.receipt?.receiptNumber || '—'}</td>
                      <td className="table-td">
                        <Link to={`/admin/payment/${p.id}`} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors inline-flex">
                          <Eye className="w-4 h-4" />
                        </Link>
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
    </div>
  );
}
