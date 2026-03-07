import { useEffect, useState } from 'react';
import { Receipt, Download, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import apiClient from '../../services/apiClient';
import { PageLoader } from '../../components/Spinner';
import Pagination from '../../components/Pagination';

interface ReceiptItem {
  id: string;
  receiptNumber: string;
  receiptUrl: string;
  generatedAt: string;
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
const BASE = 'http://localhost:5000';

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.get('/payments', { params: { page, limit: 10, status: 'SUCCESS' } })
      .then((r) => {
        const payments = r.data.data.payments.filter((p: { receipt?: unknown }) => p.receipt);
        setReceipts(payments.map((p: {
          id: string; receipt: { id: string; receiptNumber: string; receiptUrl: string; generatedAt: string };
          amountPaid: number; paymentMethod: string; paymentDate: string;
          ledger: { month: number; year: number; student: { name: string; admissionNumber: string } };
        }) => ({
          ...p.receipt,
          payment: {
            amountPaid: p.amountPaid,
            paymentMethod: p.paymentMethod,
            paymentDate: p.paymentDate,
            ledger: p.ledger,
          }
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
        <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
        <p className="text-gray-500 text-sm mt-0.5">All generated payment receipts</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08)' }}>
        {loading ? <PageLoader /> : receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Receipt className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium">No receipts found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-th">Receipt No.</th>
                    <th className="table-th">Student</th>
                    <th className="table-th">Period</th>
                    <th className="table-th">Amount</th>
                    <th className="table-th">Method</th>
                    <th className="table-th">Generated</th>
                    <th className="table-th">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className="table-row">
                      <td className="table-td font-mono text-sm text-blue-600 font-semibold">{r.receiptNumber}</td>
                      <td className="table-td">
                        <p className="font-semibold text-gray-900">{r.payment?.ledger?.student?.name}</p>
                        <p className="text-xs text-gray-400">{r.payment?.ledger?.student?.admissionNumber}</p>
                      </td>
                      <td className="table-td">{MONTHS[(r.payment?.ledger?.month || 1) - 1]} {r.payment?.ledger?.year}</td>
                      <td className="table-td font-bold text-gray-900">₹{r.payment?.amountPaid.toLocaleString('en-IN')}</td>
                      <td className="table-td text-sm text-gray-600">{r.payment?.paymentMethod}</td>
                      <td className="table-td text-xs">{new Date(r.generatedAt).toLocaleDateString('en-IN')}</td>
                      <td className="table-td">
                        <div className="flex gap-2">
                          <a href={`${BASE}${r.receiptUrl}`} target="_blank" rel="noopener noreferrer"
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Open">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <a href={`${BASE}${r.receiptUrl}`} download
                            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="Download">
                            <Download className="w-4 h-4" />
                          </a>
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
