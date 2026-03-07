import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, AlertCircle, TrendingUp,
  IndianRupee, ArrowUpRight, FileText, CreditCard
} from 'lucide-react';
import { studentService } from '../../services/studentService';
import { PageLoader } from '../../components/Spinner';

interface Stats {
  totalStudents: number;
  activeStudents: number;
  totalParents: number;
  unpaidLedgers: number;
  revenueThisMonth: number;
  totalRevenue: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentService.getStats()
      .then((r) => setStats(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const now = new Date();

  const statCards = [
    {
      label: 'Total Students',
      value: stats?.totalStudents || 0,
      sub: `${stats?.activeStudents || 0} active`,
      icon: GraduationCap,
      color: 'from-blue-500 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      link: '/admin/students',
    },
    {
      label: 'Parents',
      value: stats?.totalParents || 0,
      sub: 'registered',
      icon: Users,
      color: 'from-violet-500 to-violet-600',
      bg: 'bg-violet-50',
      text: 'text-violet-600',
      link: '/admin/students',
    },
    {
      label: 'Pending Fees',
      value: stats?.unpaidLedgers || 0,
      sub: 'ledgers unpaid',
      icon: AlertCircle,
      color: 'from-amber-500 to-orange-500',
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      link: '/admin/ledgers',
    },
    {
      label: `Revenue (${MONTHS[now.getMonth()]})`,
      value: `₹${((stats?.revenueThisMonth || 0) / 1000).toFixed(1)}K`,
      sub: `Total: ₹${((stats?.totalRevenue || 0) / 1000).toFixed(1)}K`,
      icon: TrendingUp,
      color: 'from-emerald-500 to-emerald-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      link: '/admin/payments',
    },
  ];

  const quickActions = [
    { label: 'Add Student', desc: 'Enroll a new student', icon: GraduationCap, to: '/admin/students', color: 'bg-blue-600', },
    { label: 'Record Payment', desc: 'Manual cash/UPI/bank payment', icon: IndianRupee, to: '/admin/payments', color: 'bg-emerald-600', },
    { label: 'View Ledgers', desc: 'Manage fee ledgers', icon: FileText, to: '/admin/ledgers', color: 'bg-violet-600', },
    { label: 'All Payments', desc: 'Transaction history', icon: CreditCard, to: '/admin/payments', color: 'bg-amber-600', },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/admin/students" className="btn-primary">
          <Users className="w-4 h-4" />
          Add Student
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {statCards.map((s) => (
          <Link key={s.label} to={s.link} className="stat-card group hover:border-blue-200 transition-all duration-200 hover:shadow-lg">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 ${s.bg} rounded-2xl flex items-center justify-center`}>
                <s.icon className={`w-6 h-6 ${s.text}`} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{s.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {quickActions.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                >
                  <div className={`w-10 h-10 ${a.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <a.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{a.label}</p>
                    <p className="text-xs text-gray-400">{a.desc}</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="lg:col-span-2 space-y-5">
          {/* School Info */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Vidya School</h2>
                <p className="text-blue-200 text-sm mt-1">Academic Year 2024-25</p>
                <div className="flex gap-6 mt-4">
                  <div>
                    <p className="text-2xl font-bold text-white">{stats?.totalStudents || 0}</p>
                    <p className="text-blue-200 text-xs">Total Students</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">₹{((stats?.totalRevenue || 0) / 100000).toFixed(2)}L</p>
                    <p className="text-blue-200 text-xs">Total Revenue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats?.unpaidLedgers || 0}</p>
                    <p className="text-blue-200 text-xs">Pending Dues</p>
                  </div>
                </div>
              </div>
              <GraduationCap className="w-20 h-20 text-white/10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100">
              <AlertCircle className="w-8 h-8 text-amber-500 mb-3" />
              <p className="text-2xl font-bold text-amber-700">{stats?.unpaidLedgers || 0}</p>
              <p className="text-sm text-amber-600 font-medium">Overdue Ledgers</p>
              <Link to="/admin/ledgers?status=UNPAID" className="text-xs text-amber-500 hover:text-amber-700 mt-2 inline-flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="card bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100">
              <TrendingUp className="w-8 h-8 text-emerald-500 mb-3" />
              <p className="text-2xl font-bold text-emerald-700">
                ₹{((stats?.revenueThisMonth || 0) / 1000).toFixed(1)}K
              </p>
              <p className="text-sm text-emerald-600 font-medium">This Month</p>
              <Link to="/admin/payments" className="text-xs text-emerald-500 hover:text-emerald-700 mt-2 inline-flex items-center gap-1">
                View all <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
