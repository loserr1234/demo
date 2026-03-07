import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle, ArrowRight, GraduationCap } from 'lucide-react';
import { studentService } from '../../services/studentService';
import { PageLoader } from '../../components/Spinner';
import { useAuthStore } from '../../state/authStore';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ParentHomePage() {
  const [children, setChildren] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    studentService.getChildren()
      .then((r) => setChildren(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const pendingCount = children.filter((c) => {
    const ledgers = (c as { ledgers?: { status: string }[] }).ledgers || [];
    return ledgers.some((l) => l.status === 'UNPAID' || l.status === 'PARTIAL');
  }).length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="rounded-3xl p-8 text-white" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Good {getTimeOfDay()}, {user?.name?.split(' ')[0]}!</h1>
            <p className="text-emerald-100">Manage your children's fee payments with ease.</p>
            <div className="flex gap-6 mt-5">
              <div>
                <p className="text-3xl font-bold">{children.length}</p>
                <p className="text-emerald-200 text-sm">Children</p>
              </div>
              <div>
                <p className="text-3xl font-bold">{pendingCount}</p>
                <p className="text-emerald-200 text-sm">Pending Dues</p>
              </div>
            </div>
          </div>
          <GraduationCap className="w-24 h-24 text-white/10" />
        </div>
      </div>

      {/* Alerts */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            You have <strong>{pendingCount}</strong> {pendingCount === 1 ? 'child' : 'children'} with pending fee payments.
          </p>
          <Link to="/parent/children" className="ml-auto text-sm font-semibold text-amber-600 hover:text-amber-800 flex items-center gap-1 whitespace-nowrap">
            Pay now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Children Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Children</h2>
        {children.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No children registered</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {children.map((child) => {
              const c = child as {
                id: string; name: string; class: string; section: string;
                admissionNumber: string; status: string;
                ledgers: { id: string; month: number; year: number; totalAmount: number; status: string }[];
              };
              const pendingLedger = c.ledgers?.find((l) => l.status === 'UNPAID' || l.status === 'PARTIAL');
              return (
                <Link
                  key={c.id}
                  to={`/parent/student/${c.id}/ledger`}
                  className="card-hover group"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">{c.name}</h3>
                      <p className="text-sm text-gray-500">Class {c.class} - {c.section}</p>
                      <p className="text-xs text-gray-400 font-mono">{c.admissionNumber}</p>
                    </div>
                  </div>
                  {pendingLedger ? (
                    <div className="flex items-center justify-between bg-red-50 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <div>
                          <p className="text-xs font-semibold text-red-600">
                            {MONTHS[pendingLedger.month - 1]} due
                          </p>
                          <p className="text-sm font-bold text-red-700">₹{pendingLedger.totalAmount.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-lg font-semibold">
                        {pendingLedger.status}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-3">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <p className="text-sm text-emerald-600 font-medium">All fees paid</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">View fee history</span>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
