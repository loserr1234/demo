import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Download, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentService } from '../../services/paymentService';
import { PageLoader } from '../../components/Spinner';
import { PaymentBadge, LedgerBadge } from '../../components/StatusBadge';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PaymentDetailPage() {
  const { id }                      = useParams<{ id: string }>();
  const [payment, setPayment]       = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!id) return;
    paymentService.getById(id)
      .then((r) => setPayment(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!payment) return (
    <div className="card text-center py-12" style={{ color: '#94a3b8' }}>Payment not found</div>
  );

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
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          to="/admin/payments"
          className="p-2 rounded-xl transition-colors flex-shrink-0"
          style={{ color: '#64748b' }}
          aria-label="Back to payments"
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
          <ArrowLeft style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Payment Details</h1>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
            {p.id.slice(0, 20)}…
          </p>
        </div>
        <div className="flex-shrink-0">
          <PaymentBadge status={p.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payment info */}
        <div className="card">
          <h3 className="font-semibold mb-5" style={{ color: '#0f172a' }}>Payment Information</h3>
          <div className="space-y-3">
            <Row label="Amount Paid" value={`₹${Number(p.amountPaid).toLocaleString('en-IN')}`} highlight />
            <Row label="Method"      value={p.paymentMethod} />
            <Row label="Source"      value={p.source} />
            <Row label="Date"        value={new Date(p.paymentDate).toLocaleString('en-IN')} />
            {p.referenceNumber  && <Row label="Reference"  value={p.referenceNumber}  mono />}
            {p.gatewayPaymentId && <Row label="Gateway ID" value={p.gatewayPaymentId} mono />}
          </div>
        </div>

        <div className="space-y-4">
          {/* Student & ledger */}
          <div className="card">
            <h3 className="font-semibold mb-4" style={{ color: '#0f172a' }}>Student & Ledger</h3>
            <div className="space-y-2.5">
              <Link to={`/admin/student/${p.ledger?.student?.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                <Row label="Student" value={p.ledger?.student?.name} link />
              </Link>
              <Row label="Admission No." value={p.ledger?.student?.admissionNumber} mono />
              <Row label="Class" value={`Class ${p.ledger?.student?.class} – ${p.ledger?.student?.section}`} />
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.625rem', marginTop: '0.25rem' }}>
                <Link to={`/admin/ledger/${p.ledger?.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <Row label="Ledger Period" value={`${MONTHS[(p.ledger?.month || 1) - 1]} ${p.ledger?.year}`} link />
                </Link>
                <div className="flex justify-between items-center py-1 mt-1">
                  <span className="text-sm" style={{ color: '#64748b' }}>Ledger Status</span>
                  <LedgerBadge status={p.ledger?.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} />
                </div>
              </div>
            </div>
          </div>

          {/* Receipt card */}
          {p.receipt && (
            <div
              className="card"
              style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: '#dcfce7' }}
                  aria-hidden="true"
                >
                  <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: '#16a34a' }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '#15803d' }}>Receipt Generated</h3>
                  <p className="text-sm" style={{ color: '#16a34a', fontFamily: 'var(--font-mono)' }}>
                    {p.receipt.receiptNumber}
                  </p>
                </div>
              </div>
              <p className="text-xs mb-3" style={{ color: '#15803d' }}>
                Generated: {new Date(p.receipt.generatedAt).toLocaleString('en-IN')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => paymentService.openReceipt(p.id).catch(() => toast.error('Failed to open receipt'))}
                  className="btn-secondary flex-1 justify-center"
                  style={{ color: '#15803d', borderColor: '#86efac' }}
                >
                  <ExternalLink style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                  View
                </button>
                <button
                  onClick={() => paymentService.downloadReceipt(p.id, `${p.receipt!.receiptNumber}.pdf`).catch(() => toast.error('Failed to download receipt'))}
                  className="btn-success flex-1 justify-center"
                >
                  <Download style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                  Download
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  mono,
  link,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
  link?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm" style={{ color: '#64748b' }}>{label}</span>
      <span
        className={highlight ? 'text-xl font-bold tabular' : 'text-sm font-medium'}
        style={{
          color: highlight ? '#0f172a' : link ? '#2563eb' : '#374151',
          fontFamily: mono ? 'var(--font-mono)' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
