import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Receipt, CheckCircle,
  AlertTriangle, ExternalLink, IndianRupee
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ledgerService } from '../../services/ledgerService';
import { studentService } from '../../services/studentService';
import { paymentService } from '../../services/paymentService';
import { PageLoader } from '../../components/Spinner';
import { LedgerBadge } from '../../components/StatusBadge';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const BASE = 'http://localhost:5000';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function StudentLedgerPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Record<string, unknown> | null>(null);
  const [ledgers, setLedgers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  const fetchData = () => {
    if (!id) return;
    Promise.all([
      studentService.getChildren().then((r) => r.data.data.find((c: { id: string }) => c.id === id)),
      ledgerService.getForParentStudent(id),
    ]).then(([studentData, ledgerRes]) => {
      setStudent(studentData);
      setLedgers(ledgerRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [id]);

  const handlePay = async (ledgerId: string) => {
    setPayingId(ledgerId);
    try {
      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve();
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const res = await paymentService.createOrder(ledgerId);
      const { orderId, amount, keyId } = res.data.data;

      const options = {
        key: keyId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        name: 'Vidya School',
        description: 'Fee Payment',
        order_id: orderId,
        handler: async (_response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          toast.success('Payment successful! Receipt will be generated shortly.');
          setTimeout(() => {
            fetchData();
            setPayingId(null);
          }, 2000);
        },
        prefill: {
          name: (student as { name: string })?.name || '',
        },
        theme: { color: '#059669' },
        modal: {
          ondismiss: () => setPayingId(null),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Payment initiation failed';
      toast.error(msg);
      setPayingId(null);
    }
  };

  if (loading) return <PageLoader />;

  const s = student as { name: string; class: string; section: string; admissionNumber: string } | null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/parent/children" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{s?.name}</h1>
          <p className="text-gray-500 text-sm">Class {s?.class} - {s?.section} · {s?.admissionNumber}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Ledgers', value: ledgers.length, color: 'text-blue-600', bg: 'bg-blue-50' },
          {
            label: 'Pending',
            value: ledgers.filter((l) => {
              const ledger = l as { status: string };
              return ledger.status === 'UNPAID' || ledger.status === 'PARTIAL';
            }).length,
            color: 'text-red-600', bg: 'bg-red-50'
          },
          {
            label: 'Paid',
            value: ledgers.filter((l) => (l as { status: string }).status === 'PAID').length,
            color: 'text-emerald-600', bg: 'bg-emerald-50'
          },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Ledger List */}
      {ledgers.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No fee records available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ledgers.map((item) => {
            const l = item as {
              id: string; month: number; year: number;
              baseAmount: number; lateFee: number; totalAmount: number;
              totalPaid: number; remaining: number; status: string; dueDate: string;
              payments: Array<{
                id: string; amountPaid: number; paymentDate: string; paymentMethod: string;
                receipt?: { id: string; receiptNumber: string; receiptUrl: string };
              }>;
            };
            const isPending = l.status === 'UNPAID' || l.status === 'PARTIAL';
            const isOverdue = isPending && new Date() > new Date(l.dueDate);

            return (
              <div key={l.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                isPending ? (isOverdue ? 'border-red-200' : 'border-amber-200') : 'border-gray-100'
              }`} style={{ boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06)' }}>
                {/* Ledger Header */}
                <div className={`px-6 py-4 flex items-center justify-between ${
                  isPending
                    ? isOverdue
                      ? 'bg-red-50'
                      : 'bg-amber-50'
                    : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white rounded-xl flex flex-col items-center justify-center shadow-sm">
                      <span className="text-xs font-bold text-gray-700">{MONTHS[l.month - 1].slice(0, 3)}</span>
                      <span className="text-xs text-gray-400">{l.year}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{MONTHS[l.month - 1]} {l.year}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isOverdue && (
                          <span className="flex items-center gap-1 text-xs text-red-600">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                        <span className="text-xs text-gray-500">Due: {new Date(l.dueDate).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <LedgerBadge status={l.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} />
                    {isPending && (
                      <button
                        onClick={() => handlePay(l.id)}
                        disabled={payingId === l.id}
                        className="btn-primary text-sm"
                        style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                      >
                        {payingId === l.id ? (
                          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                        ) : (
                          <><CreditCard className="w-4 h-4" /> Pay ₹{l.remaining.toLocaleString('en-IN')}</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Ledger Body */}
                <div className="px-6 py-4">
                  <div className="flex gap-6 text-sm mb-4">
                    <div>
                      <span className="text-gray-400">Base Fee</span>
                      <p className="font-semibold text-gray-800">₹{l.baseAmount.toLocaleString('en-IN')}</p>
                    </div>
                    {l.lateFee > 0 && (
                      <div>
                        <span className="text-gray-400">Late Fee</span>
                        <p className="font-semibold text-red-600">₹{l.lateFee}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-400">Total</span>
                      <p className="font-bold text-gray-900">₹{l.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Paid</span>
                      <p className="font-semibold text-emerald-600">₹{l.totalPaid.toLocaleString('en-IN')}</p>
                    </div>
                    {l.remaining > 0 && (
                      <div>
                        <span className="text-gray-400">Remaining</span>
                        <p className="font-bold text-red-600">₹{l.remaining.toLocaleString('en-IN')}</p>
                      </div>
                    )}
                  </div>

                  {/* Payments */}
                  {l.payments.length > 0 && (
                    <div className="space-y-2">
                      {l.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-emerald-700">₹{p.amountPaid.toLocaleString('en-IN')} paid</p>
                              <p className="text-xs text-emerald-600">{p.paymentMethod} · {new Date(p.paymentDate).toLocaleDateString('en-IN')}</p>
                            </div>
                          </div>
                          {p.receipt && (
                            <div className="flex gap-2">
                              <a href={`${BASE}${p.receipt.receiptUrl}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium">
                                <Receipt className="w-3 h-3" /> {p.receipt.receiptNumber}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
