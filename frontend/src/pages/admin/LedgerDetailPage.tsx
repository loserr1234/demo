import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Receipt, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { ledgerService } from '../../services/ledgerService';
import { paymentService } from '../../services/paymentService';
import { PageLoader } from '../../components/Spinner';
import { LedgerBadge, PaymentBadge } from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function LedgerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ledger, setLedger] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ paymentMethod: 'CASH', referenceNumber: '', paymentDate: '' });
  const [submitting, setSubmitting] = useState(false);

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
  if (!ledger) return <div className="card text-center py-12">Ledger not found</div>;

  const l = ledger as {
    id: string; month: number; year: number; baseAmount: number; lateFee: number;
    totalAmount: number; status: string; dueDate: string;
    student: { id: string; name: string; admissionNumber: string; class: string; section: string; parent: { name: string; email: string } };
    payments: Array<{ id: string; amountPaid: number; paymentMethod: string; source: string; paymentDate: string; status: string; referenceNumber?: string; receipt?: { receiptNumber: string; receiptUrl: string } }>;
  };
  const totalPaid = l.payments.filter(p => p.status === 'SUCCESS').reduce((s, p) => s + p.amountPaid, 0);
  const remaining = l.totalAmount - totalPaid;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/admin/ledgers" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ledger — {MONTHS[l.month - 1]} {l.year}</h1>
          <Link to={`/admin/student/${l.student?.id}`} className="text-blue-600 hover:underline text-sm">
            {l.student?.name}
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <LedgerBadge status={l.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} />
          {l.status !== 'PAID' && l.status !== 'WAIVED' && (
            <button onClick={() => setShowPayModal(true)} className="btn-success">
              <CreditCard className="w-4 h-4" /> Record Payment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fee Breakdown */}
        <div className="lg:col-span-1 space-y-5">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Fee Breakdown</h3>
            <div className="space-y-3">
              <FeeRow label="Base Fee" value={`₹${l.baseAmount.toLocaleString('en-IN')}`} />
              <FeeRow label="Late Fee" value={l.lateFee > 0 ? `₹${l.lateFee}` : '—'} valueClass={l.lateFee > 0 ? 'text-red-500' : 'text-gray-300'} />
              <div className="border-t border-gray-100 pt-3">
                <FeeRow label="Total Amount" value={`₹${l.totalAmount.toLocaleString('en-IN')}`} bold />
                <FeeRow label="Total Paid" value={`₹${totalPaid.toLocaleString('en-IN')}`} valueClass="text-emerald-600" bold />
                <FeeRow label="Remaining" value={remaining > 0 ? `₹${remaining.toLocaleString('en-IN')}` : '—'} valueClass={remaining > 0 ? 'text-red-500 font-bold' : 'text-gray-300'} />
              </div>
              <div className="border-t border-gray-100 pt-3">
                <FeeRow label="Due Date" value={new Date(l.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Student</h3>
            <p className="font-medium text-gray-800">{l.student?.name}</p>
            <p className="text-sm text-gray-500 mt-1">Class {l.student?.class} - {l.student?.section}</p>
            <p className="text-xs text-gray-400 mt-0.5">{l.student?.admissionNumber}</p>
            <p className="text-sm text-gray-500 mt-3 font-medium">{l.student?.parent?.name}</p>
            <p className="text-xs text-gray-400">{l.student?.parent?.email}</p>
          </div>
        </div>

        {/* Payment History */}
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-5">Payment History</h3>
            {l.payments.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No payments recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {l.payments.map((p) => (
                  <div key={p.id} className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-blue-100 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.status === 'SUCCESS' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      {p.status === 'SUCCESS' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Clock className="w-5 h-5 text-red-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-gray-800">₹{p.amountPaid.toLocaleString('en-IN')}</p>
                        <PaymentBadge status={p.status} />
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500">
                        <span>{p.paymentMethod}</span>
                        <span>•</span>
                        <span>{p.source}</span>
                        {p.referenceNumber && <><span>•</span><span className="font-mono">{p.referenceNumber}</span></>}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      {p.receipt && (
                        <a
                          href={`http://localhost:5000${p.receipt.receiptUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-2"
                        >
                          <Receipt className="w-3 h-3" /> {p.receipt.receiptNumber}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Payment Modal */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Record Manual Payment">
        <div className="mb-4 p-3 bg-blue-50 rounded-xl">
          <p className="text-sm text-blue-700">Amount to collect: <span className="font-bold">₹{remaining.toLocaleString('en-IN')}</span></p>
        </div>
        <form onSubmit={handleManualPayment} className="space-y-4">
          <div>
            <label className="label">Payment Method *</label>
            <div className="relative">
              <select className="select pr-8" value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })} required>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="BANK">Bank Transfer</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="label">Reference Number</label>
            <input className="input" value={payForm.referenceNumber} onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })} placeholder="Transaction ID, cheque no., etc." />
          </div>
          <div>
            <label className="label">Payment Date</label>
            <input type="date" className="input" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowPayModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-success flex-1 justify-center">
              {submitting ? 'Recording...' : `Record ₹${remaining.toLocaleString('en-IN')}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function FeeRow({ label, value, bold, valueClass }: { label: string; value: string; bold?: boolean; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : ''} ${valueClass || 'text-gray-700'}`}>{value}</span>
    </div>
  );
}
