import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Receipt, CheckCircle,
  AlertTriangle, ExternalLink, IndianRupee, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ledgerService } from '../../services/ledgerService';
import { studentService } from '../../services/studentService';
import { paymentService } from '../../services/paymentService';
import { PageLoader } from '../../components/Spinner';
import { LedgerBadge } from '../../components/StatusBadge';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function StudentLedgerPage() {
  const { id }                          = useParams<{ id: string }>();
  const [student, setStudent]           = useState<Record<string, unknown> | null>(null);
  const [ledgers, setLedgers]           = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]           = useState(true);
  const [payingId, setPayingId]         = useState<string | null>(null);
  const [pollingId, setPollingId]       = useState<string | null>(null);
  const pollingRef                      = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimeoutRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  useEffect(() => () => { stopPolling(); }, []);

  const stopPolling = () => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (pollingTimeoutRef.current) { clearTimeout(pollingTimeoutRef.current); pollingTimeoutRef.current = null; }
    setPollingId(null);
  };

  const startPolling = (ledgerId: string, studentId: string) => {
    setPollingId(ledgerId);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await ledgerService.getForParentStudent(studentId);
        const updated = (res.data.data as Array<{ id: string; status: string }>).find((l) => l.id === ledgerId);
        if (updated?.status === 'PAID') {
          stopPolling();
          toast.success('Payment confirmed! Receipt has been generated.');
          fetchData();
        }
      } catch { /* ignore */ }
    }, 3000);

    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling();
      toast('Payment received. Your ledger will update within the hour. Contact admin if it doesn\'t.', {
        icon: '⏳', duration: 8000,
      });
      fetchData();
    }, 30000);
  };

  const handlePay = async (ledgerId: string) => {
    setPayingId(ledgerId);
    try {
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = reject;
          document.body.appendChild(s);
        });
      }
      const res = await paymentService.createOrder(ledgerId);
      const { orderId, amount, keyId } = res.data.data;
      const studentId = id!;
      const options = {
        key: keyId,
        amount: Math.round(amount * 100),
        currency: 'INR',
        name: 'Vidya School',
        description: 'Fee Payment',
        order_id: orderId,
        handler: () => { setPayingId(null); startPolling(ledgerId, studentId); },
        prefill: {
          name: (student as { name: string })?.name || '',
          contact: (student as { parent?: { phone?: string } })?.parent?.phone || '9999999999',
          email: '',
        },
        theme: { color: '#5b21b6' },
        modal: { ondismiss: () => setPayingId(null) },
      };
      new window.Razorpay(options).open();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Payment initiation failed';
      toast.error(msg);
      setPayingId(null);
    }
  };

  if (loading) return <PageLoader />;

  const s = student as { name: string; class: string; section: string; admissionNumber: string } | null;

  const totalLedgers  = ledgers.length;
  const pendingCount  = ledgers.filter((l) => ['UNPAID','PARTIAL'].includes((l as { status: string }).status)).length;
  const paidCount     = ledgers.filter((l) => (l as { status: string }).status === 'PAID').length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/parent/children"
          className="p-2 rounded-xl transition-colors flex-shrink-0"
          style={{ color: '#7c3aed' }}
          aria-label="Back to children"
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f3ff')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '')}
        >
          <ArrowLeft style={{ width: '1.25rem', height: '1.25rem' }} aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1e1b4b' }}>{s?.name}</h1>
          <p className="text-sm" style={{ color: '#7c3aed' }}>
            Class {s?.class} – {s?.section} · <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>{s?.admissionNumber}</span>
          </p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',   value: totalLedgers, bg: '#f5f3ff', color: '#5b21b6' },
          { label: 'Pending', value: pendingCount,  bg: '#fef2f2', color: '#b91c1c' },
          { label: 'Paid',    value: paidCount,     bg: '#f0fdf4', color: '#15803d' },
        ].map((chip) => (
          <div
            key={chip.label}
            className="rounded-2xl p-4 text-center"
            style={{ background: chip.bg }}
          >
            <p className="text-2xl font-bold tabular" style={{ color: chip.color }}>{chip.value}</p>
            <p className="text-xs mt-1" style={{ color: chip.color, opacity: 0.75 }}>{chip.label}</p>
          </div>
        ))}
      </div>

      {/* Ledger list */}
      {ledgers.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: '#fff', border: '1px solid #e9d5ff' }}
        >
          <IndianRupee
            style={{ width: '3rem', height: '3rem', color: '#ddd6fe', margin: '0 auto 0.75rem' }}
            aria-hidden="true"
          />
          <p style={{ color: '#8b5cf6' }}>No fee records available</p>
        </div>
      ) : (
        <div className="space-y-3">
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

            let borderColor = '#e9d5ff';
            if (isPending) borderColor = isOverdue ? '#fecaca' : '#fde68a';

            return (
              <div
                key={l.id}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: '#fff',
                  border: `1px solid ${borderColor}`,
                  boxShadow: '0 1px 4px rgba(91,33,182,0.05)',
                }}
              >
                {/* Ledger header */}
                <div
                  className="flex items-center justify-between px-5 py-4"
                  style={{
                    background: isPending
                      ? isOverdue ? '#fef2f2' : '#fffbeb'
                      : '#f9fafb',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                      style={{ background: '#fff', border: '1px solid #e5e7eb' }}
                      aria-hidden="true"
                    >
                      <span className="text-xs font-bold" style={{ color: '#374151', lineHeight: 1 }}>
                        {MONTHS[l.month - 1].slice(0, 3)}
                      </span>
                      <span className="text-xs" style={{ color: '#9ca3af', lineHeight: 1.4 }}>{l.year}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold" style={{ color: '#1e1b4b' }}>{MONTHS[l.month - 1]} {l.year}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {isOverdue && (
                          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#dc2626' }}>
                            <AlertTriangle style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
                            Overdue
                          </span>
                        )}
                        <span className="text-xs" style={{ color: '#9ca3af' }}>
                          Due {new Date(l.dueDate).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <LedgerBadge status={l.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} />
                    {isPending && (
                      pollingId === l.id ? (
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm"
                          style={{ background: '#f5f3ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border-2 animate-spin flex-shrink-0"
                            style={{ borderColor: '#ddd6fe', borderTopColor: '#7c3aed' }}
                            aria-hidden="true"
                          />
                          Processing…
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePay(l.id)}
                          disabled={payingId === l.id || pollingId !== null}
                          className="btn-parent-primary"
                          style={{ width: 'auto', padding: '0.625rem 1rem', fontSize: '0.875rem', borderRadius: '0.75rem' }}
                        >
                          {payingId === l.id ? (
                            <>
                              <span
                                className="w-4 h-4 rounded-full border-2 animate-spin flex-shrink-0"
                                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                                aria-hidden="true"
                              />
                              Processing…
                            </>
                          ) : (
                            <>
                              <CreditCard style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                              Pay ₹{Number(l.remaining).toLocaleString('en-IN')}
                            </>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Ledger body */}
                <div className="px-5 py-4">
                  <div className="flex gap-5 text-sm mb-4 flex-wrap">
                    <div>
                      <span className="text-xs block" style={{ color: '#9ca3af' }}>Base Fee</span>
                      <p className="font-semibold tabular" style={{ color: '#1e1b4b' }}>₹{Number(l.baseAmount).toLocaleString('en-IN')}</p>
                    </div>
                    {Number(l.lateFee) > 0 && (
                      <div>
                        <span className="text-xs block" style={{ color: '#9ca3af' }}>Late Fee</span>
                        <p className="font-semibold tabular" style={{ color: '#dc2626' }}>₹{Number(l.lateFee)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-xs block" style={{ color: '#9ca3af' }}>Total</span>
                      <p className="font-bold tabular" style={{ color: '#1e1b4b' }}>₹{Number(l.totalAmount).toLocaleString('en-IN')}</p>
                    </div>
                    <div>
                      <span className="text-xs block" style={{ color: '#9ca3af' }}>Paid</span>
                      <p className="font-semibold tabular" style={{ color: '#15803d' }}>₹{Number(l.totalPaid).toLocaleString('en-IN')}</p>
                    </div>
                    {Number(l.remaining) > 0 && (
                      <div>
                        <span className="text-xs block" style={{ color: '#9ca3af' }}>Remaining</span>
                        <p className="font-bold tabular" style={{ color: '#dc2626' }}>₹{Number(l.remaining).toLocaleString('en-IN')}</p>
                      </div>
                    )}
                  </div>

                  {l.payments.length > 0 && (
                    <div className="space-y-2">
                      {l.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl px-4 py-3"
                          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle style={{ width: '1rem', height: '1rem', color: '#16a34a', flexShrink: 0 }} aria-hidden="true" />
                            <div>
                              <p className="text-sm font-semibold tabular" style={{ color: '#15803d' }}>
                                ₹{Number(p.amountPaid).toLocaleString('en-IN')} paid
                              </p>
                              <p className="text-xs" style={{ color: '#16a34a' }}>
                                {p.paymentMethod} · {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                              </p>
                            </div>
                          </div>
                          {p.receipt && (
                            <button
                              onClick={() => paymentService.openReceipt(p.id)}
                              className="inline-flex items-center gap-1 text-xs font-medium"
                              style={{ color: '#5b21b6' }}
                              aria-label={`View receipt ${p.receipt.receiptNumber}`}
                            >
                              <Receipt style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
                              {p.receipt.receiptNumber}
                              <ExternalLink style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {l.payments.length === 0 && !isPending && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: '#9ca3af' }}>
                      <Clock style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                      No payment records
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
