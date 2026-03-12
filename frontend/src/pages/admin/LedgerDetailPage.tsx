import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Receipt as ReceiptIcon, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { ledgerService } from '../../services/ledgerService';
import { paymentService } from '../../services/paymentService';
import { PageLoader } from '../../components/Spinner';
import { LedgerBadge, PaymentBadge } from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function LedgerDetailPage() {
  const { id }                        = useParams<{ id: string }>();
  const [ledger, setLedger]           = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]         = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm]           = useState({ paymentMethod: 'CASH', referenceNumber: '', paymentDate: '' });
  const [submitting, setSubmitting]     = useState(false);

  const fetchLedger = () => {
    if (!id) return;
    setLoading(true);
    ledgerService.getById(id)
      .then((r) => setLedger(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLedger(); }, [id]);

  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledger) return;
    setSubmitting(true);
    try {
      await paymentService.recordManual({
        ledgerId: (ledger as { id: string }).id,
        ...payForm,
        paymentDate: payForm.paymentDate || undefined,
      });
      toast.success('Payment recorded successfully!');
      setShowPayModal(false);
      fetchLedger();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to record payment';
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  if (loading) return <PageLoader />;
  if (!ledger) return (
    <div className="card text-center py-12" style={{ color: '#94a3b8' }}>Ledger not found</div>
  );

  const l = ledger as {
    id: string; month: number; year: number; baseAmount: number; lateFee: number;
    totalAmount: number; status: string; dueDate: string;
    student: { id: string; name: string; admissionNumber: string; class: string; section: string; parent: { name: string; email: string } };
    payments: Array<{
      id: string; amountPaid: number; paymentMethod: string; source: string;
      paymentDate: string; status: string; referenceNumber?: string;
      receipt?: { receiptNumber: string; receiptUrl: string };
    }>;
  };
  const totalPaid = l.payments.filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + Number(p.amountPaid), 0);
  const remaining = Number(l.totalAmount) - totalPaid;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          to="/admin/ledgers"
          className="p-2 rounded-xl transition-colors flex-shrink-0"
          style={{ color: '#64748b' }}
          aria-label="Back to ledgers"
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
        >
          <ArrowLeft style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden="true" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>
            {MONTHS[l.month - 1]} {l.year}
          </h1>
          <Link
            to={`/admin/student/${l.student?.id}`}
            className="text-sm hover:underline"
            style={{ color: '#2563eb' }}
          >
            {l.student?.name}
          </Link>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <LedgerBadge status={l.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} />
          {l.status !== 'PAID' && l.status !== 'WAIVED' && (
            <button onClick={() => setShowPayModal(true)} className="btn-success">
              <CreditCard style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Fee breakdown */}
          <div className="card">
            <h3 className="font-semibold mb-4" style={{ color: '#0f172a' }}>Fee Breakdown</h3>
            <div className="space-y-2.5">
              <FeeRow label="Base Fee" value={`₹${Number(l.baseAmount).toLocaleString('en-IN')}`} />
              <FeeRow
                label="Late Fee"
                value={Number(l.lateFee) > 0 ? `₹${Number(l.lateFee)}` : '—'}
                valueStyle={Number(l.lateFee) > 0 ? { color: '#ef4444', fontWeight: 500 } : { color: '#cbd5e1' }}
              />
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.625rem', marginTop: '0.25rem' }}>
                <FeeRow label="Total Amount"  value={`₹${Number(l.totalAmount).toLocaleString('en-IN')}`} bold />
                <FeeRow label="Total Paid"    value={`₹${totalPaid.toLocaleString('en-IN')}`}               valueStyle={{ color: '#16a34a', fontWeight: 600 }} />
                <FeeRow
                  label="Remaining"
                  value={remaining > 0 ? `₹${remaining.toLocaleString('en-IN')}` : '—'}
                  valueStyle={remaining > 0 ? { color: '#ef4444', fontWeight: 700 } : { color: '#cbd5e1' }}
                />
              </div>
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.625rem' }}>
                <FeeRow
                  label="Due Date"
                  value={new Date(l.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                />
              </div>
            </div>
          </div>

          {/* Student info */}
          <div className="card">
            <h3 className="font-semibold mb-3" style={{ color: '#0f172a' }}>Student</h3>
            <p className="font-semibold" style={{ color: '#1e293b' }}>{l.student?.name}</p>
            <p className="text-sm mt-1" style={{ color: '#64748b' }}>
              Class {l.student?.class} – {l.student?.section}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
              {l.student?.admissionNumber}
            </p>
            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
              <p className="text-sm font-medium" style={{ color: '#374151' }}>{l.student?.parent?.name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{l.student?.parent?.email}</p>
            </div>
          </div>
        </div>

        {/* Right column — payment history */}
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="font-semibold mb-5" style={{ color: '#0f172a' }}>Payment History</h3>
            {l.payments.length === 0 ? (
              <div className="text-center py-10" style={{ color: '#94a3b8' }}>
                <Clock style={{ width: '2.5rem', height: '2.5rem', opacity: 0.3, margin: '0 auto 0.5rem' }} aria-hidden="true" />
                <p>No payments recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {l.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-4 p-4 rounded-xl"
                    style={{ border: '1px solid #f1f5f9' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#bfdbfe')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#f1f5f9')}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: p.status === 'SUCCESS' ? '#f0fdf4' : '#fef2f2' }}
                      aria-hidden="true"
                    >
                      {p.status === 'SUCCESS'
                        ? <CheckCircle style={{ width: '1.25rem', height: '1.25rem', color: '#16a34a' }} />
                        : <Clock style={{ width: '1.25rem', height: '1.25rem', color: '#ef4444' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold tabular" style={{ color: '#0f172a' }}>
                          ₹{Number(p.amountPaid).toLocaleString('en-IN')}
                        </p>
                        <PaymentBadge status={p.status} />
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs" style={{ color: '#64748b' }}>
                        <span>{p.paymentMethod}</span>
                        <span>·</span>
                        <span>{p.source}</span>
                        {p.referenceNumber && (
                          <>
                            <span>·</span>
                            <span style={{ fontFamily: 'var(--font-mono)' }}>{p.referenceNumber}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>
                        {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {p.receipt && (
                        <button
                          onClick={() => paymentService.openReceipt(p.id).catch(() => toast.error('Failed to open receipt'))}
                          className="inline-flex items-center gap-1 text-xs mt-2"
                          style={{ color: '#3b82f6' }}
                          aria-label={`View receipt ${p.receipt.receiptNumber}`}
                        >
                          <ReceiptIcon style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
                          {p.receipt.receiptNumber}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual payment modal */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Record Manual Payment">
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
        >
          Amount to collect: <span className="font-bold">₹{remaining.toLocaleString('en-IN')}</span>
        </div>
        <form onSubmit={handleManualPayment} className="space-y-4">
          <div>
            <label className="label" htmlFor="pay-method">Payment Method *</label>
            <div className="relative">
              <select
                id="pay-method"
                className="select pr-8"
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                required
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank Transfer</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} aria-hidden="true" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="pay-ref">Reference Number</label>
            <input
              id="pay-ref"
              className="input"
              value={payForm.referenceNumber}
              onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
              placeholder="Transaction ID, cheque no., etc."
            />
          </div>
          <div>
            <label className="label" htmlFor="pay-date">Payment Date</label>
            <input
              id="pay-date"
              type="date"
              className="input"
              value={payForm.paymentDate}
              onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowPayModal(false)} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-success flex-1 justify-center">
              {submitting ? 'Recording…' : `Record ₹${remaining.toLocaleString('en-IN')}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function FeeRow({
  label,
  value,
  bold,
  valueStyle,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-sm" style={{ color: bold ? '#0f172a' : '#64748b', fontWeight: bold ? 600 : 400 }}>
        {label}
      </span>
      <span
        className="text-sm tabular"
        style={{ color: '#374151', fontWeight: bold ? 700 : 400, ...valueStyle }}
      >
        {value}
      </span>
    </div>
  );
}
