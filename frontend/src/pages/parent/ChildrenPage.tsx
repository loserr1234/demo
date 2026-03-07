import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { studentService } from '../../services/studentService';
import { PageLoader } from '../../components/Spinner';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ChildrenPage() {
  const [children, setChildren] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentService.getChildren()
      .then((r) => setChildren(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Children</h1>
        <p className="text-gray-500 text-sm mt-0.5">{children.length} registered</p>
      </div>

      {children.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No children registered</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {children.map((child) => {
            const c = child as {
              id: string; name: string; class: string; section: string;
              admissionNumber: string; admissionDate: string;
              ledgers: { id: string; month: number; year: number; totalAmount: number; status: string }[];
            };
            const pending = c.ledgers?.filter((l) => l.status === 'UNPAID' || l.status === 'PARTIAL');
            return (
              <div key={c.id} className="card">
                <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{c.name}</h3>
                    <p className="text-gray-500 text-sm">Class {c.class} - Section {c.section}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{c.admissionNumber}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Admission Date</span>
                    <span className="font-medium text-gray-700">{new Date(c.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Pending Dues</span>
                    <span className={`font-semibold ${pending?.length > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {pending?.length || 0} months
                    </span>
                  </div>
                </div>

                {pending?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {pending.slice(0, 2).map((l) => (
                      <div key={l.id} className="flex items-center justify-between bg-red-50 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium text-red-700">{MONTHS[l.month - 1]} {l.year}</span>
                        </div>
                        <span className="font-bold text-red-700">₹{l.totalAmount.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}

                {pending?.length === 0 && (
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-3 mb-4">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-emerald-600 font-medium">All fees up to date</span>
                  </div>
                )}

                <Link
                  to={`/parent/student/${c.id}/ledger`}
                  className="btn-primary w-full justify-center"
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                >
                  View Fee History <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
