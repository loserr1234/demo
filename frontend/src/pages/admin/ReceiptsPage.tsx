import { useEffect, useState } from 'react';
import { Receipt, Download, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../services/apiClient';
import { paymentService } from '../../services/paymentService';
import { PageLoader } from '../../components/Spinner';
import Pagination from '../../components/Pagination';

interface ReceiptItem {
  id: string;
  receiptNumber: string;
  receiptUrl: string;
  generatedAt: string;
  paymentId: string;
  payment: {
    amountPaid: number;
    paymentMethod: string;
    paymentDate: string;
    ledger: {
      month: number;
      year: number;
      student: { name: string; admissionNumber: string };
    };
  };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ReceiptsPage() {
  const [receipts, setReceipts]     = useState<ReceiptItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/payments', { params: { page, limit: 10, status: 'SUCCESS' } })
      .then((r) => {
        const payments = r.data.data.payments.filter((p: { receipt?: unknown }) => p.receipt);
        setReceipts(payments.map((p: {
          id: string;
          receipt: { id: string; receiptNumber: string; receiptUrl: string; generatedAt: string };
          amountPaid: number; paymentMethod: string; paymentDate: string;
          ledger: { month: number; year: number; student: { name: string; admissionNumber: string } };
        }) => ({
          ...p.receipt,
          paymentId: p.id,
          payment: {
            amountPaid: p.amountPaid,
            paymentMethod: p.paymentMethod,
            paymentDate: p.paymentDate,
            ledger: p.ledger,
          },
        })));
        setTotal(r.data.data.total);
        setTotalPages(r.data.data.totalPages);
      })
      .catch(() => toast.error('Failed to load receipts'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Receipts</h1>
        <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>All generated payment receipts</p>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e8edf2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {loading ? <PageLoader /> : receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#94a3b8' }}>
            <Receipt style={{ width: '3rem', height: '3rem', opacity: 0.3, marginBottom: '0.75rem' }} aria-hidden="true" />
            <p className="font-medium">No receipts found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Receipt No.</th>
                    <th className="table-th">Student</th>
                    <th className="table-th">Period</th>
                    <th className="table-th">Amount</th>
                    <th className="table-th">Method</th>
                    <th className="table-th">Generated</th>
                    <th className="table-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className="table-row">
                      <td className="table-td font-semibold" style={{ fontFamily: 'var(--font-mono)', color: '#2563eb', fontSize: '0.8125rem' }}>
                        {r.receiptNumber}
                      </td>
                      <td className="table-td">
                        <p className="font-semibold" style={{ color: '#0f172a' }}>{r.payment?.ledger?.student?.name}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{r.payment?.ledger?.student?.admissionNumber}</p>
                      </td>
                      <td className="table-td" style={{ color: '#334155' }}>
                        {MONTHS[(r.payment?.ledger?.month || 1) - 1]} {r.payment?.ledger?.year}
                      </td>
                      <td className="table-td font-bold tabular" style={{ color: '#0f172a' }}>
                        ₹{Number(r.payment?.amountPaid).toLocaleString('en-IN')}
                      </td>
                      <td className="table-td text-sm" style={{ color: '#475569' }}>{r.payment?.paymentMethod}</td>
                      <td className="table-td text-xs" style={{ color: '#64748b' }}>
                        {new Date(r.generatedAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="table-td">
                        <div className="flex gap-1">
                          <button
                            onClick={() => paymentService.openReceipt(r.paymentId).catch(() => toast.error('Failed to open'))}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#3b82f6' }}
                            title="Open receipt"
                            aria-label={`Open receipt ${r.receiptNumber}`}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <ExternalLink style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => paymentService.downloadReceipt(r.paymentId, `${r.receiptNumber}.pdf`).catch(() => toast.error('Failed to download'))}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#16a34a' }}
                            title="Download receipt"
                            aria-label={`Download receipt ${r.receiptNumber}`}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <Download style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
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
    </div>
  );
}
