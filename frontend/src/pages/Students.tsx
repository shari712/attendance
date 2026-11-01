import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { 
  Users, 
  UserPlus, 
  Search, 
  Camera, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Edit3, 
  X, 
  Upload, 
  ChevronDown,
  Mail,
  GraduationCap,
  Sparkles,
  LayoutGrid,
  List
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  register_number: string;
  email?: string;
  department?: string;
  year?: number;
  section?: string;
  parent_name?: string;
  parent_mobile?: string;
  face_registration_status?: boolean;
  created_at?: string;
}

const Students: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedStudentForFace, setSelectedStudentForFace] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    register_number: '',
    email: '',
    department: 'Computer Science',
    year: 3,
    section: 'A',
    parent_name: '',
    parent_mobile: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Face registration file upload
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [faceUploading, setFaceUploading] = useState(false);
  const [faceMessage, setFaceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch students
  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const data = await api.get('/students/');
      setStudents(data || []);
    } catch (err: any) {
      console.error('Failed to load students:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesSearch = 
        (s.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.register_number?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.email?.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDept = departmentFilter === 'ALL' || s.department === departmentFilter;
      const matchesStatus = 
        statusFilter === 'ALL' || 
        (statusFilter === 'REGISTERED' && s.face_registration_status) ||
        (statusFilter === 'PENDING' && !s.face_registration_status);

      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [students, searchQuery, departmentFilter, statusFilter]);

  // Unique departments
  const departments = useMemo(() => {
    const list = Array.from(new Set(students.map((s) => s.department).filter(Boolean)));
    return list.length ? list : ['Computer Science', 'Information Technology', 'Electronics & Communication'];
  }, [students]);

  // Quick stats
  const totalCount = students.length;
  const verifiedCount = students.filter((s) => s.face_registration_status).length;
  const pendingCount = totalCount - verifiedCount;
  const verifiedPercentage = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  // Handle Create / Edit submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingStudent) {
        await api.put(`/students/${editingStudent.id}`, formData);
      } else {
        await api.post('/students/', formData);
      }
      await fetchStudents();
      setIsAddModalOpen(false);
      setEditingStudent(null);
      setFormData({
        name: '',
        register_number: '',
        email: '',
        department: 'Computer Science',
        year: 3,
        section: 'A',
        parent_name: '',
        parent_mobile: '',
      });
    } catch (err: any) {
      setFormError(err.message || 'Failed to save student.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name || '',
      register_number: student.register_number || '',
      email: student.email || '',
      department: student.department || 'Computer Science',
      year: student.year || 3,
      section: student.section || 'A',
      parent_name: student.parent_name || '',
      parent_mobile: student.parent_mobile || '',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Delete Confirmation
  const handleDeleteClick = (student: Student) => {
    setStudentToDelete(student);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    try {
      await api.delete(`/students/${studentToDelete.id}`);
      await fetchStudents();
      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete student.');
    }
  };

  // Handle Face Upload
  const handleFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaceFile(file);
      setFacePreview(URL.createObjectURL(file));
      setFaceMessage(null);
    }
  };

  const handleFaceUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faceFile || !selectedStudentForFace) return;

    setFaceUploading(true);
    setFaceMessage(null);

    try {
      const data = new FormData();
      data.append('student_id', selectedStudentForFace.id);
      data.append('file', faceFile);

      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/api/students/register-face`, {
        method: 'POST',
        body: data,
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.detail || 'Face registration failed.');
      }

      setFaceMessage({ type: 'success', text: 'Face registered and verified successfully!' });
      await fetchStudents();
      setTimeout(() => {
        setIsFaceModalOpen(false);
        setFaceFile(null);
        setFacePreview(null);
        setFaceMessage(null);
      }, 1400);
    } catch (err: any) {
      setFaceMessage({ type: 'error', text: err.message || 'Face detection failed.' });
    } finally {
      setFaceUploading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Students Directory</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
              {totalCount} Total
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage student records, enrollment details, and biometric facial registration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingStudent(null);
              setFormData({
                name: '',
                register_number: '',
                email: '',
                department: 'Computer Science',
                year: 3,
                section: 'A',
                parent_name: '',
                parent_mobile: '',
              });
              setFormError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all cursor-pointer"
          >
            <UserPlus size={18} />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Enrolled</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Face Verified</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5 flex items-baseline gap-2">
              <span>{verifiedCount}</span>
              <span className="text-xs font-medium text-emerald-600">({verifiedPercentage}%)</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Biometrics</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{pendingCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Departments</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{departments.length}</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, roll no, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center flex-wrap gap-3 w-full md:w-auto">
          {/* Department Filter */}
          <div className="relative">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="appearance-none text-xs font-medium pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-slate-700"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none text-xs font-medium pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-slate-700"
            >
              <option value="ALL">All Status</option>
              <option value="REGISTERED">Verified Face</option>
              <option value="PENDING">Pending Face</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Layout Toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              title="Table View"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              title="Card Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table / Grid Content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-slate-600 font-medium text-sm">Loading student directory...</div>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Students Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            {searchQuery || departmentFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No students match your active filters. Try adjusting your search criteria.'
              : 'Start by adding your first student to configure facial attendance.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setDepartmentFilter('ALL');
              setStatusFilter('ALL');
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
          >
            <UserPlus size={16} />
            <span>Add Student Now</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Student</th>
                  <th className="py-3.5 px-4">Register No</th>
                  <th className="py-3.5 px-4">Class / Section</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Face Status</th>
                  <th className="py-3.5 px-5 text-right">Option Set</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
                          {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                            {s.name}
                          </div>
                          <div className="text-xs text-slate-400">{s.department || 'General'}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                        {s.register_number}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      <div>Year {s.year || 3} • Sec {s.section || 'A'}</div>
                      <div className="text-[11px] text-slate-400">Sem 6</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 truncate max-w-[160px]">
                        <Mail size={13} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate">{s.email || '—'}</span>
                      </div>
                      {s.parent_mobile && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Parent: {s.parent_mobile}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {s.face_registration_status ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          Registered
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={13} className="text-amber-500" />
                          Pending
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedStudentForFace(s);
                            setFaceFile(null);
                            setFacePreview(null);
                            setFaceMessage(null);
                            setIsFaceModalOpen(true);
                          }}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all inline-flex items-center gap-1.5 ${
                            s.face_registration_status 
                              ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' 
                              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-semibold'
                          }`}
                          title="Register or update facial biometrics"
                        >
                          <Camera size={13} />
                          <span>{s.face_registration_status ? 'Re-scan' : 'Set Face'}</span>
                        </button>

                        <button
                          onClick={() => handleEditClick(s)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit details"
                        >
                          <Edit3 size={15} />
                        </button>

                        <button
                          onClick={() => handleDeleteClick(s)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete student"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStudents.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-sm">
                      {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 leading-snug">{s.name}</h4>
                      <span className="font-mono text-xs text-slate-500">{s.register_number}</span>
                    </div>
                  </div>

                  {s.face_registration_status ? (
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600" title="Face Registered">
                      <CheckCircle2 size={18} />
                    </span>
                  ) : (
                    <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600" title="Face Pending">
                      <Clock size={18} />
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Department:</span>
                    <span className="font-medium text-slate-700">{s.department || 'General'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Class & Section:</span>
                    <span className="font-medium text-slate-700">Year {s.year || 3} - Sec {s.section || 'A'}</span>
                  </div>
                  <div className="flex justify-between truncate">
                    <span className="text-slate-400">Email:</span>
                    <span className="font-medium text-slate-700 truncate max-w-[150px]">{s.email || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setSelectedStudentForFace(s);
                    setFaceFile(null);
                    setFacePreview(null);
                    setFaceMessage(null);
                    setIsFaceModalOpen(true);
                  }}
                  className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Camera size={14} />
                  <span>{s.face_registration_status ? 'Update Face' : 'Set Face Biometrics'}</span>
                </button>

                <div className="flex items-center">
                  <button
                    onClick={() => handleEditClick(s)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                    title="Edit"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(s)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingStudent ? 'Edit Student Details' : 'Add New Student'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set information and credentials for classroom attendance.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Register Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.register_number}
                    onChange={(e) => setFormData({ ...formData, register_number: e.target.value })}
                    placeholder="e.g. 21CS045"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (Login ID) *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@college.edu"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2 p-3 bg-blue-50/80 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-blue-700">
                    <Sparkles size={14} />
                    <span>Automatic Student Login Access</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Saving this student will automatically create their Supabase Auth student account with the initial default password. Only students enrolled here by the Class Advisor will be granted student login access.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Year</label>
                    <select
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value={1}>1st</option>
                      <option value={2}>2nd</option>
                      <option value={3}>3rd</option>
                      <option value={4}>4th</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Section</label>
                    <select
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="A">Sec A</option>
                      <option value="B">Sec B</option>
                      <option value="C">Sec C</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Name</label>
                  <input
                    type="text"
                    value={formData.parent_name}
                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                    placeholder="Guardian name"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Mobile</label>
                  <input
                    type="text"
                    value={formData.parent_mobile}
                    onChange={(e) => setFormData({ ...formData, parent_mobile: e.target.value })}
                    placeholder="+91 9876543210"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingStudent ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Face Biometric Registration Modal */}
      {isFaceModalOpen && selectedStudentForFace && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Camera className="text-blue-600" size={20} />
                  <span>Set Facial Biometrics</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target: <strong className="text-slate-700">{selectedStudentForFace.name}</strong> ({selectedStudentForFace.register_number})
                </p>
              </div>
              <button
                onClick={() => setIsFaceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFaceUploadSubmit} className="p-6 space-y-4">
              {faceMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    faceMessage.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-red-50 border border-red-200 text-red-600'
                  }`}
                >
                  {faceMessage.type === 'success' ? <CheckCircle2 size={16} /> : <X size={16} />}
                  <span>{faceMessage.text}</span>
                </div>
              )}

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-6 text-center transition-all bg-slate-50/50">
                {facePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={facePreview}
                      alt="Face Preview"
                      className="w-40 h-40 object-cover rounded-2xl shadow-md mx-auto border-2 border-blue-500"
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-blue-300 rounded-2xl pointer-events-none animate-pulse"></div>
                    <button
                      type="button"
                      onClick={() => {
                        setFaceFile(null);
                        setFacePreview(null);
                      }}
                      className="mt-3 text-xs text-red-600 hover:underline block mx-auto"
                    >
                      Remove and choose another
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
                      <Upload size={24} />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Select clear student portrait</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Front-facing image with good lighting. Format: JPG, PNG.
                    </p>
                    <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-xs hover:bg-slate-50 cursor-pointer">
                      <span>Browse Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFaceFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 bg-blue-50/60 p-3 rounded-xl border border-blue-100 flex items-start gap-2">
                <Sparkles size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <span>
                  The AI model will extract a 128-dimensional facial embedding vector and associate it with this student for automated camera attendance.
                </span>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFaceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!faceFile || faceUploading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 disabled:opacity-40 transition-all flex items-center gap-2"
                >
                  {faceUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Analyzing Face...</span>
                    </>
                  ) : (
                    <span>Register Face</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-6 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Delete Student?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Are you sure you want to remove <strong className="text-slate-800">{studentToDelete.name}</strong> ({studentToDelete.register_number})? All linked attendance and face data will be permanently removed.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 transition-all"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;
