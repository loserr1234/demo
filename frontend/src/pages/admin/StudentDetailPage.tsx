import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Phone, Mail, Calendar, FileText, IndianRupee } from 'lucide-react';
import { studentService } from '../../services/studentService';
import { ledgerService } from '../../services/ledgerService';
import { PageLoader } from '../../components/Spinner';
import { StudentBadge, LedgerBadge } from '../../components/StatusBadge';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Record<string, unknown> | null>(null);
  const [ledgers, setLedgers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      studentService.getById(id),
      ledgerService.getByStudent(id),
    ]).then(([sRes, lRes]) => {
      setStudent(sRes.data.data);
      setLedgers(lRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!student) return <div className="card text-center py-12 text-gray-500">Student not found</div>;

  const s = student as {
    name: string; admissionNumber: string; class: string; section: string;
    status: 'ACTIVE' | 'INACTIVE'; admissionDate: string;
    parent: { name: string; email: string; phone: string };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link to="/admin/students" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{s.name}</h1>
          <p className="text-gray-500 text-sm">{s.admissionNumber}</p>
        </div>
        <div className="ml-auto"><StudentBadge status={s.status} /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Info */}
        <div className="space-y-5">
          <div className="card">
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                {s.name.charAt(0)}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{s.name}</h2>
                <p className="text-sm text-gray-500">Class {s.class} - {s.section}</p>
              </div>
            </div>
            <div className="space-y-3">
              <InfoRow icon={FileText} label="Admission No." value={s.admissionNumber} />
              <InfoRow icon={Calendar} label="Admission Date" value={new Date(s.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })} />
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" /> Parent Details
            </h3>
            <div className="space-y-3">
              <InfoRow icon={User} label="Name" value={s.parent?.name} />
              <InfoRow icon={Mail} label="Email" value={s.parent?.email} />
              <InfoRow icon={Phone} label="Phone" value={s.parent?.phone || 'N/A'} />
            </div>
          </div>
        </div>

        {/* Ledgers */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Fee Ledgers</h3>
              <span className="text-sm text-gray-500">{ledgers.length} entries</span>
            </div>
            {ledgers.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <IndianRupee className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No ledger entries yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ledgers.map((l) => {
                  const ledger = l as { id: string; month: number; year: number; baseAmount: number; lateFee: number; totalAmount: number; totalPaid: number; remaining: number; status: string; dueDate: string };
                  return (
                    <Link
                      key={ledger.id}
                      to={`/admin/ledger/${ledger.id}`}
                      className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
                    >
                      <div className="w-12 h-12 bg-blue-50 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-600">{MONTHS[ledger.month - 1]}</span>
                        <span className="text-xs text-blue-400">{ledger.year}</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-800">{MONTHS[ledger.month - 1]} {ledger.year}</p>
                          <LedgerBadge status={ledger.status as 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED'} />
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-gray-500">
                          <span>Base: ₹{ledger.baseAmount.toLocaleString('en-IN')}</span>
                          {ledger.lateFee > 0 && <span className="text-red-500">Late: ₹{ledger.lateFee}</span>}
                          <span>Total: ₹{ledger.totalAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">₹{ledger.totalPaid.toLocaleString('en-IN')}</p>
                        {ledger.remaining > 0 && (
                          <p className="text-xs text-red-500">₹{ledger.remaining.toLocaleString('en-IN')} due</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-700 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
