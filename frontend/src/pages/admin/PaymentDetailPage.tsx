import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Download, ExternalLink } from 'lucide-react';
import { paymentService } from '../../services/paymentService';
import { PageLoader } from '../../components/Spinner';
import { PaymentBadge, LedgerBadge } from '../../components/StatusBadge';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const BASE = 'http://localhost:5000';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    paymentService.getById(id)
      .then((r) => setPayment(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!payment) return <div className="card text-center py-12">Payment not found</div>;

  const p = payment as {
    id: string; amountPaid: number; paymentMethod: string; source: string;
    paymentDate: string; status: string; referenceNumber?: string; gatewayPaymentId?: string;
    receipt?: { receiptNumber: string; receiptUrl: string; generatedAt: string };
    ledger: {
      id: string; month: number; year: number; totalAmount: number; status: string;
      student: { id: string; name: string; admissionNumber: string; class: string; section: string };
    };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/admin/payments" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Details</h1>
          <p className="text-gray-500 text-sm font-mono">{p.id.slice(0, 20)}...</p>
        </div>
        <div className="ml-auto"><PaymentBadge status={p.status} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-5">Payment Information</h3>
          <div className="space-y-4">
            <Row label="Amount Paid" value={`₹${p.amountPaid.toLocaleString('en-IN')}`} highlight />
            <Row label="Method" value={p.paymentMethod} />
            <Row label="Source" value={p.source} />
            <Row label="Date" value={new Date(p.paymentDate).toLocaleString('en-IN')} />
            {p.referenceNumber && <Row label="Reference" value={p.referenceNumber} mono />}
            {p.gatewayPaymentId && <Row label="Gateway ID" value={p.gatewayPaymentId} mono />}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Student & Ledger</h3>
            <div className="space-y-3">
              <Link to={`/admin/student/${p.ledger?.student?.id}`} className="block">
                <Row label="Student" value={p.ledger?.student?.name} link />
              </Link>
              <Row label="Admission No." value={p.ledger?.student?.admissionNumber} mono />
              <Row label="Class" value={`Class ${p.ledger?.student?.class} - ${p.ledger?.student?.section}`} />
              <div className="pt-2 border-t border-gray-100">
                <Link to={`/admin/ledger/${p.ledger?.id}`}>
                  <Row label="Ledger Period" value={`${MONTHS[(p.ledger?.month || 1) - 1]} ${p.ledger?.year}`} link />
                </Link>
                <div className="flex justify-between items-center py-1 mt-1">
                  <span className="text-sm text-gray-500">Ledger Status</span>
                  <LedgerBadge status={p.ledger?.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} />
                </div>
              </div>
            </div>
          </div>

          {p.receipt && (
            <div className="card border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-800">Receipt Generated</h3>
                  <p className="text-sm text-emerald-600 font-mono">{p.receipt.receiptNumber}</p>
                </div>
              </div>
              <p className="text-xs text-emerald-600 mb-3">
                Generated: {new Date(p.receipt.generatedAt).toLocaleString('en-IN')}
              </p>
              <div className="flex gap-3">
                <a href={`${BASE}${p.receipt.receiptUrl}`} target="_blank" rel="noopener noreferrer"
                  className="btn-secondary flex-1 justify-center text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                  <ExternalLink className="w-4 h-4" /> View
                </a>
                <a href={`${BASE}${p.receipt.receiptUrl}`} download
                  className="btn-success flex-1 justify-center">
                  <Download className="w-4 h-4" /> Download
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight, mono, link }: { label: string; value: string; highlight?: boolean; mono?: boolean; link?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm ${highlight ? 'font-bold text-gray-900 text-base' : ''} ${mono ? 'font-mono text-gray-600' : 'font-medium text-gray-700'} ${link ? 'text-blue-600 hover:underline' : ''}`}>
        {value}
      </span>
    </div>
  );
}
