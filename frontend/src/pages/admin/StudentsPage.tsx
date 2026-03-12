import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Edit2, UserCheck, UserX, GraduationCap, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentService } from '../../services/studentService';
import { PageLoader } from '../../components/Spinner';
import Pagination from '../../components/Pagination';
import { StudentBadge } from '../../components/StatusBadge';
import Modal from '../../components/Modal';

interface Student {
  id: string;
  name: string;
  admissionNumber: string;
  class: string;
  section: string;
  status: 'ACTIVE' | 'INACTIVE';
  admissionDate: string;
  parent: { name: string; email: string; phone: string };
}

const CLASSES  = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const SECTIONS = ['A','B','C','D','E'];

export default function StudentsPage() {
  const [students, setStudents]     = useState<Student[]>([]);
  const [total, setTotal]           = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter]   = useState('');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState<Student | null>(null);
  const [submitting, setSubmitting]       = useState(false);

  const [form, setForm] = useState({
    name: '', admissionNumber: '', class: '', section: '',
    parentName: '', parentEmail: '', parentPhone: '', admissionDate: '',
  });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await studentService.getAll({
        page, limit: 10,
        search: search || undefined,
        status: statusFilter || undefined,
        class: classFilter || undefined,
      });
      const d = res.data.data;
      setStudents(d.students);
      setTotal(d.total);
      setTotalPages(d.totalPages);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, [page, statusFilter, classFilter]);
  useEffect(() => {
    const t = setTimeout(fetchStudents, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await studentService.create(form);
      toast.success('Student added successfully!');
      setShowAddModal(false);
      setForm({ name: '', admissionNumber: '', class: '', section: '', parentName: '', parentEmail: '', parentPhone: '', admissionDate: '' });
      fetchStudents();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to add student';
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setSubmitting(true);
    try {
      await studentService.update(showEditModal.id, { name: form.name, class: form.class, section: form.section });
      toast.success('Student updated!');
      setShowEditModal(null);
      fetchStudents();
    } catch { toast.error('Failed to update'); }
    finally { setSubmitting(false); }
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await studentService.updateStatus(id, status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      toast.success('Status updated!');
      fetchStudents();
    } catch { toast.error('Failed to update status'); }
  };

  const openEdit = (s: Student) => {
    setForm({
      name: s.name, admissionNumber: s.admissionNumber,
      class: s.class, section: s.section,
      parentName: s.parent.name, parentEmail: s.parent.email,
      parentPhone: s.parent.phone || '',
      admissionDate: s.admissionDate?.split('T')[0] || '',
    });
    setShowEditModal(s);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Students</h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>{total} total students</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Plus style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
          Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '1rem' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ width: '1rem', height: '1rem', color: '#94a3b8' }}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or admission number…"
              className="input pl-9"
              aria-label="Search students"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="select pr-8 min-w-[130px]"
              aria-label="Filter by status"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} aria-hidden="true" />
          </div>
          <div className="relative">
            <select
              value={classFilter}
              onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
              className="select pr-8 min-w-[120px]"
              aria-label="Filter by class"
            >
              <option value="">All Classes</option>
              {CLASSES.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#e8edf2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <PageLoader />
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16" style={{ color: '#94a3b8' }}>
            <GraduationCap style={{ width: '3rem', height: '3rem', opacity: 0.3, marginBottom: '0.75rem' }} aria-hidden="true" />
            <p className="font-medium">No students found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Student</th>
                    <th className="table-th">Adm. No.</th>
                    <th className="table-th">Class</th>
                    <th className="table-th">Parent</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="table-row">
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0"
                            style={{ background: '#eff6ff', color: '#2563eb' }}
                            aria-hidden="true"
                          >
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: '#0f172a' }}>{s.name}</p>
                            <p className="text-xs" style={{ color: '#94a3b8' }}>
                              {new Date(s.admissionDate).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="table-td" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#475569' }}>
                        {s.admissionNumber}
                      </td>
                      <td className="table-td">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold"
                          style={{ background: '#eff6ff', color: '#1d4ed8' }}
                        >
                          Class {s.class} – {s.section}
                        </span>
                      </td>
                      <td className="table-td">
                        <p className="font-medium" style={{ color: '#1e293b' }}>{s.parent?.name}</p>
                        <p className="text-xs" style={{ color: '#94a3b8' }}>{s.parent?.phone}</p>
                      </td>
                      <td className="table-td"><StudentBadge status={s.status} /></td>
                      <td className="table-td">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/admin/student/${s.id}`}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#3b82f6' }}
                            title="View student"
                            aria-label={`View ${s.name}`}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <Eye style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                          </Link>
                          <button
                            onClick={() => openEdit(s)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: '#64748b' }}
                            title="Edit student"
                            aria-label={`Edit ${s.name}`}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            <Edit2 style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                          </button>
                          <button
                            onClick={() => handleStatus(s.id, s.status)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: s.status === 'ACTIVE' ? '#ef4444' : '#16a34a' }}
                            title={s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            aria-label={s.status === 'ACTIVE' ? `Deactivate ${s.name}` : `Activate ${s.name}`}
                            onMouseEnter={(e) => (e.currentTarget.style.background = s.status === 'ACTIVE' ? '#fef2f2' : '#f0fdf4')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                          >
                            {s.status === 'ACTIVE'
                              ? <UserX style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />
                              : <UserCheck style={{ width: '1rem', height: '1rem' }} aria-hidden="true" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} limit={10} />
          </>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Student" size="xl">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#2563eb' }}>
                Student Information
              </p>
            </div>
            <div>
              <label className="label" htmlFor="add-name">Full Name *</label>
              <input id="add-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="label" htmlFor="add-adm">Admission Number *</label>
              <input id="add-adm" className="input" value={form.admissionNumber} onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })} required />
            </div>
            <div>
              <label className="label" htmlFor="add-class">Class *</label>
              <div className="relative">
                <select id="add-class" className="select pr-8" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} required>
                  <option value="">Select class</option>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} aria-hidden="true" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="add-section">Section *</label>
              <div className="relative">
                <select id="add-section" className="select pr-8" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} required>
                  <option value="">Select section</option>
                  {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} aria-hidden="true" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="add-date">Admission Date *</label>
              <input id="add-date" type="date" className="input" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} required />
            </div>

            <div className="col-span-2 mt-2">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#2563eb' }}>
                Parent Information
              </p>
            </div>
            <div>
              <label className="label" htmlFor="add-pname">Parent Name *</label>
              <input id="add-pname" className="input" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} required />
            </div>
            <div>
              <label className="label" htmlFor="add-pemail">Parent Email *</label>
              <input id="add-pemail" type="email" className="input" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} required />
            </div>
            <div>
              <label className="label" htmlFor="add-pphone">Parent Phone *</label>
              <input id="add-pphone" type="tel" className="input" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} required />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" /> Saving…</>
                : 'Add Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!showEditModal} onClose={() => setShowEditModal(null)} title="Edit Student">
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label className="label" htmlFor="edit-name">Full Name</label>
            <input id="edit-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="edit-class">Class</label>
              <div className="relative">
                <select id="edit-class" className="select pr-8" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })}>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} aria-hidden="true" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="edit-section">Section</label>
              <div className="relative">
                <select id="edit-section" className="select pr-8" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
                  {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} aria-hidden="true" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowEditModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 justify-center">
              {submitting ? 'Saving…' : 'Update Student'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
