import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, GraduationCap, AlertCircle, TrendingUp,
  ArrowUpRight, FileText, CreditCard, IndianRupee
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
      value: stats?.totalStudents ?? 0,
      sub: `${stats?.activeStudents ?? 0} active`,
      icon: GraduationCap,
      iconBg: '#eff6ff',
      iconColor: '#2563eb',
      link: '/admin/students',
    },
    {
      label: 'Registered Parents',
      value: stats?.totalParents ?? 0,
      sub: 'accounts',
      icon: Users,
      iconBg: '#f5f3ff',
      iconColor: '#7c3aed',
      link: '/admin/students',
    },
    {
      label: 'Pending Dues',
      value: stats?.unpaidLedgers ?? 0,
      sub: 'unpaid ledgers',
      icon: AlertCircle,
      iconBg: '#fff7ed',
      iconColor: '#ea580c',
      link: '/admin/ledgers?status=UNPAID',
    },
    {
      label: `Revenue — ${MONTHS[now.getMonth()]}`,
      value: `₹${((stats?.revenueThisMonth ?? 0) / 1000).toFixed(1)}K`,
      sub: `₹${((stats?.totalRevenue ?? 0) / 100000).toFixed(2)}L all time`,
      icon: TrendingUp,
      iconBg: '#f0fdf4',
      iconColor: '#16a34a',
      link: '/admin/payments',
    },
  ];

  const quickActions = [
    { label: 'Add Student',     desc: 'Enroll a new student',          icon: GraduationCap, to: '/admin/students',  accent: '#2563eb' },
    { label: 'Record Payment',  desc: 'Manual cash / UPI / bank',       icon: IndianRupee,   to: '/admin/ledgers',   accent: '#16a34a' },
    { label: 'View Ledgers',    desc: 'Manage fee ledgers',             icon: FileText,      to: '/admin/ledgers',   accent: '#7c3aed' },
    { label: 'All Payments',    desc: 'Transaction history',            icon: CreditCard,    to: '/admin/payments',  accent: '#0891b2' },
  ];

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link to="/admin/students" className="btn-primary flex-shrink-0">
          <Users style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
          Add Student
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Link key={s.label} to={s.link} className="stat-card group" aria-label={`${s.label}: ${s.value}`}>
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: s.iconBg }}
                aria-hidden="true"
              >
                <s.icon style={{ width: '1.125rem', height: '1.125rem', color: s.iconColor }} />
              </div>
              <ArrowUpRight
                style={{ width: '1rem', height: '1rem', color: '#cbd5e1' }}
                className="group-hover:text-blue-400 transition-colors"
                aria-hidden="true"
              />
            </div>
            <p className="text-2xl font-bold tabular" style={{ color: '#0f172a' }}>{s.value}</p>
            <p className="text-sm font-medium mt-0.5" style={{ color: '#334155' }}>{s.label}</p>
            <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{s.sub}</p>
          </Link>
        ))}
      </div>

      {/* Lower row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick actions */}
        <div className="card">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#64748b' }}>
            Quick Actions
          </h2>
          <nav className="space-y-1" aria-label="Quick actions">
            {quickActions.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                style={{ textDecoration: 'none', color: 'inherit' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: a.accent }}
                  aria-hidden="true"
                >
                  <a.icon style={{ width: '1rem', height: '1rem', color: '#fff' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#1e293b' }}>{a.label}</p>
                  <p className="text-xs" style={{ color: '#94a3b8' }}>{a.desc}</p>
                </div>
                <ArrowUpRight
                  style={{ width: '0.875rem', height: '0.875rem', color: '#cbd5e1', flexShrink: 0 }}
                  aria-hidden="true"
                />
              </Link>
            ))}
          </nav>
        </div>

        {/* Summary panel */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
          {/* Revenue summary */}
          <div
            className="sm:col-span-3 rounded-xl px-6 py-5"
            style={{ background: '#0c1520', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                  Academic Year 2024–25
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#f1f5f9' }}>
                  Vidya School
                </p>
                <div className="flex gap-8 mt-4">
                  <div>
                    <p className="text-xl font-bold tabular" style={{ color: '#fff' }}>
                      {stats?.totalStudents ?? 0}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Students</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular" style={{ color: '#fff' }}>
                      ₹{((stats?.totalRevenue ?? 0) / 100000).toFixed(2)}L
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Total Revenue</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold tabular" style={{ color: stats?.unpaidLedgers ? '#f87171' : '#4ade80' }}>
                      {stats?.unpaidLedgers ?? 0}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>Pending Dues</p>
                  </div>
                </div>
              </div>
              <GraduationCap
                style={{ width: '4rem', height: '4rem', color: 'rgba(255,255,255,0.06)', flexShrink: 0 }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Overdue ledgers */}
          <div className="stat-card">
            <AlertCircle
              style={{ width: '1.5rem', height: '1.5rem', color: '#ea580c', marginBottom: '0.75rem' }}
              aria-hidden="true"
            />
            <p className="text-2xl font-bold tabular" style={{ color: '#c2410c' }}>
              {stats?.unpaidLedgers ?? 0}
            </p>
            <p className="text-sm font-medium mt-0.5" style={{ color: '#9a3412' }}>Overdue Ledgers</p>
            <Link
              to="/admin/ledgers?status=UNPAID"
              className="inline-flex items-center gap-1 text-xs mt-2"
              style={{ color: '#ea580c' }}
            >
              View all <ArrowUpRight style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
            </Link>
          </div>

          {/* This month */}
          <div className="stat-card">
            <TrendingUp
              style={{ width: '1.5rem', height: '1.5rem', color: '#16a34a', marginBottom: '0.75rem' }}
              aria-hidden="true"
            />
            <p className="text-2xl font-bold tabular" style={{ color: '#15803d' }}>
              ₹{((stats?.revenueThisMonth ?? 0) / 1000).toFixed(1)}K
            </p>
            <p className="text-sm font-medium mt-0.5" style={{ color: '#166534' }}>
              {MONTHS[now.getMonth()]} Revenue
            </p>
            <Link
              to="/admin/payments"
              className="inline-flex items-center gap-1 text-xs mt-2"
              style={{ color: '#16a34a' }}
            >
              View all <ArrowUpRight style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
            </Link>
          </div>

          {/* Active students */}
          <div className="stat-card">
            <GraduationCap
              style={{ width: '1.5rem', height: '1.5rem', color: '#2563eb', marginBottom: '0.75rem' }}
              aria-hidden="true"
            />
            <p className="text-2xl font-bold tabular" style={{ color: '#1d4ed8' }}>
              {stats?.activeStudents ?? 0}
            </p>
            <p className="text-sm font-medium mt-0.5" style={{ color: '#1e40af' }}>Active Students</p>
            <Link
              to="/admin/students"
              className="inline-flex items-center gap-1 text-xs mt-2"
              style={{ color: '#2563eb' }}
            >
              View all <ArrowUpRight style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
