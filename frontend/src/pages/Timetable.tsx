import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  CalendarDays
} from 'lucide-react';

interface TimetableItem {
  id: string;
  class_id: string;
  subject_id: string;
  faculty_id: string;
  faculty_name?: string;
  day: string;
  period_number: number;
  start_time: string;
  end_time: string;
  room?: string;
  subjects?: {
    name: string;
    code: string;
  };
  staff?: {
    name: string;
  };
  classes?: {
    name: string;
  };
}

interface ClassSubjectMapping {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  faculty_id: string;
  faculty_name: string;
}

interface MetaOptions {
  classes: Array<{ id: string; name: string; department?: string; section?: string }>;
  subjects: Array<{ id: string; name: string; code: string }>;
  faculty: Array<{ id: string; name: string; department?: string }>;
  class_subjects_map?: Record<string, ClassSubjectMapping[]>;
  period_timings?: Record<number, { start_time: string; end_time: string }>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DEFAULT_PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: '09:30', end: '10:20' },
  2: { start: '10:20', end: '11:10' },
  3: { start: '11:25', end: '12:15' },
  4: { start: '12:15', end: '13:05' },
  5: { start: '14:00', end: '14:50' },
  6: { start: '14:50', end: '15:40' },
  7: { start: '15:40', end: '16:30' },
  8: { start: '16:30', end: '17:20' },
};

const Timetable: React.FC = () => {
  const { role } = useAuth();
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [options, setOptions] = useState<MetaOptions>({ classes: [], subjects: [], faculty: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    class_id: '',
    class_name: '',
    subject_id: '',
    subject_name: '',
    faculty_id: '',
    faculty_name: '',
    day: 'Monday',
    period_number: 1,
    start_time: '09:30',
    end_time: '10:20',
    room: 'CH LH 11',
  });

  const canManage = role === 'CLASS_ADVISOR' || role === 'STAFF';

  // Load data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [ttData, opts] = await Promise.all([
        api.get('/timetable/'),
        api.get('/timetable/options').catch(() => ({ classes: [], subjects: [], faculty: [] })),
      ]);
      setTimetable(ttData || []);
      setOptions(opts || { classes: [], subjects: [], faculty: [] });

      setFormData((prev) => {
        const defaultClass = prev.class_id || opts?.classes?.[0]?.id || '';
        const defaultClassObj = opts?.classes?.find((c: any) => c.id === defaultClass);
        const defaultSubject = prev.subject_id || opts?.subjects?.[0]?.id || '';
        const defaultSubjectObj = opts?.subjects?.find((s: any) => s.id === defaultSubject);
        const defaultFaculty = prev.faculty_id || opts?.faculty?.[0]?.id || '';
        const defaultFacultyObj = opts?.faculty?.find((f: any) => f.id === defaultFaculty);
        return {
          ...prev,
          class_id: defaultClass,
          class_name: prev.class_name || defaultClassObj?.name || (opts?.classes?.[0]?.name || ''),
          subject_id: defaultSubject,
          subject_name: prev.subject_name || (defaultSubjectObj ? `${defaultSubjectObj.code} - ${defaultSubjectObj.name}` : (opts?.subjects?.[0] ? `${opts.subjects[0].code} - ${opts.subjects[0].name}` : '')),
          faculty_id: defaultFaculty,
          faculty_name: prev.faculty_name || defaultFacultyObj?.name || (opts?.faculty?.[0]?.name || ''),
        };
      });
    } catch (err) {
      console.error('Failed to load timetable:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Timetable
  const filteredTimetable = useMemo(() => {
    return timetable.filter((item) => {
      const matchesDay = selectedDay === 'ALL' || item.day.toLowerCase() === selectedDay.toLowerCase();
      const matchesClass = selectedClassId === 'ALL' || item.class_id === selectedClassId;
      return matchesDay && matchesClass;
    });
  }, [timetable, selectedDay, selectedClassId]);

  // Handle period number change to auto-fill times as a convenience
  const handlePeriodChange = (periodNum: number) => {
    const times = DEFAULT_PERIOD_TIMES[periodNum] || { start: '09:30', end: '10:20' };
    setFormData((prev) => ({
      ...prev,
      period_number: periodNum,
      start_time: times.start,
      end_time: times.end,
    }));
    setFormError(null);
  };

  // Open modal with pre-filled day & period (New Slot)
  const openSetModal = (day?: string, period?: number) => {
    setEditingSlotId(null);
    const pNum = period || 1;
    const times = DEFAULT_PERIOD_TIMES[pNum] || { start: '09:30', end: '10:20' };
    const defaultClassObj = options.classes[0];
    const defaultSubjectObj = options.subjects[0];
    const defaultFacultyObj = options.faculty[0];

    setFormData((prev) => ({
      ...prev,
      day: day || prev.day || 'Monday',
      period_number: pNum,
      start_time: times.start,
      end_time: times.end,
      class_id: prev.class_id || defaultClassObj?.id || '',
      class_name: prev.class_name || defaultClassObj?.name || '',
      subject_id: prev.subject_id || defaultSubjectObj?.id || '',
      subject_name: prev.subject_name || (defaultSubjectObj ? `${defaultSubjectObj.code} - ${defaultSubjectObj.name}` : ''),
      faculty_id: prev.faculty_id || defaultFacultyObj?.id || '',
      faculty_name: prev.faculty_name || defaultFacultyObj?.name || '',
    }));
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal to edit existing slot
  const openEditModal = (item: TimetableItem) => {
    setEditingSlotId(item.id);
    const classObj = options.classes.find((c) => c.id === item.class_id);
    const subObj = options.subjects.find((s) => s.id === item.subject_id);
    const facultyObj = options.faculty.find((f) => f.id === item.faculty_id);

    setFormData({
      class_id: item.class_id,
      class_name: item.classes?.name || classObj?.name || '',
      subject_id: item.subject_id,
      subject_name: item.subjects ? `${item.subjects.code} - ${item.subjects.name}` : (subObj ? `${subObj.code} - ${subObj.name}` : ''),
      faculty_id: item.faculty_id,
      faculty_name: item.faculty_name || item.staff?.name || facultyObj?.name || '',
      day: item.day,
      period_number: item.period_number,
      start_time: item.start_time ? item.start_time.slice(0, 5) : '09:00',
      end_time: item.end_time ? item.end_time.slice(0, 5) : '10:00',
      room: item.room || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Submit timetable entry (Create or Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.class_name && !formData.class_id) {
      setFormError('Please provide a target class.');
      return;
    }
    if (!formData.subject_name && !formData.subject_id) {
      setFormError('Please provide a subject.');
      return;
    }
    if (!formData.faculty_name && !formData.faculty_id) {
      setFormError('Please provide a faculty / teacher.');
      return;
    }

    // Match typed values with known options if possible
    const matchedClass = options.classes.find(
      (c) => c.id === formData.class_id || c.name.toLowerCase() === formData.class_name.trim().toLowerCase()
    );
    const matchedSub = options.subjects.find(
      (s) =>
        s.id === formData.subject_id ||
        `${s.code} - ${s.name}`.toLowerCase() === formData.subject_name.trim().toLowerCase() ||
        s.name.toLowerCase() === formData.subject_name.trim().toLowerCase()
    );
    const matchedFaculty = options.faculty.find(
      (f) => f.id === formData.faculty_id || f.name.toLowerCase() === formData.faculty_name.trim().toLowerCase()
    );

    const resolvedClassId = matchedClass ? matchedClass.id : formData.class_id;
    const resolvedSubjectId = matchedSub ? matchedSub.id : formData.subject_id;
    const resolvedFacultyId = matchedFaculty ? matchedFaculty.id : formData.faculty_id;

    // Check duplicate slot excluding current item
    if (resolvedClassId) {
      const isDuplicate = timetable.some(
        (item) =>
          item.id !== editingSlotId &&
          item.class_id === resolvedClassId &&
          item.day.toLowerCase() === formData.day.toLowerCase() &&
          Number(item.period_number) === Number(formData.period_number)
      );
      if (isDuplicate) {
        setFormError(`A timetable slot already exists for this class on ${formData.day}, Period ${formData.period_number}.`);
        return;
      }
    }

    setFormSubmitting(true);
    setFormError(null);

    const payload = {
      class_id: resolvedClassId || null,
      class_name: formData.class_name.trim(),
      subject_id: resolvedSubjectId || null,
      subject_name: formData.subject_name.trim(),
      faculty_id: resolvedFacultyId || null,
      faculty_name: formData.faculty_name.trim() || (matchedFaculty ? matchedFaculty.name : 'Assigned Faculty'),
      day: formData.day,
      period_number: Number(formData.period_number),
      start_time: formData.start_time,
      end_time: formData.end_time,
      room: formData.room,
    };

    try {
      if (editingSlotId) {
        await api.put(`/timetable/${editingSlotId}`, payload);
      } else {
        await api.post('/timetable/', payload);
      }
      await fetchData();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || (editingSlotId ? 'Failed to update timetable slot.' : 'Failed to save timetable slot.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete slot
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this timetable slot?')) return;
    try {
      await api.delete(`/timetable/${id}`);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete slot.');
    }
  };

  // Group by day
  const timetableByDay = useMemo(() => {
    const grouped: Record<string, TimetableItem[]> = {};
    DAYS.forEach((d) => (grouped[d] = []));

    filteredTimetable.forEach((item) => {
      const day = item.day.charAt(0).toUpperCase() + item.day.slice(1).toLowerCase();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(item);
    });

    Object.keys(grouped).forEach((d) => {
      grouped[d].sort((a, b) => a.period_number - b.period_number);
    });

    return grouped;
  }, [filteredTimetable]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Academic Timetable</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
              {timetable.length} Slots
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure periods, faculty assignments, and classroom schedule.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => openSetModal()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all cursor-pointer"
            >
              <Plus size={18} />
              <span>Set Timetable Slot</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter & Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Day Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedDay('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedDay === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Week
          </button>
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedDay === d
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Class Filter if multiple */}
        {options.classes.length > 1 && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-400 font-medium">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-slate-700"
            >
              <option value="ALL">All Classes</option>
              {options.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Timetable Weekly Matrix / View */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-slate-600 font-medium text-sm">Loading timetable schedule...</div>
        </div>
      ) : timetable.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4">
            <CalendarDays size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No Schedule Configured</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            There are no timetable slots set for this class yet. Start setting periods to enable automated attendance tracking.
          </p>
          {canManage && (
            <button
              onClick={() => openSetModal()}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-md shadow-blue-500/20"
            >
              <Plus size={16} />
              <span>Set First Period</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {(selectedDay === 'ALL' ? DAYS : [selectedDay]).map((day) => {
            const daySlots = timetableByDay[day] || [];
            return (
              <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Day Header */}
                <div className="bg-slate-50/90 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <h3 className="font-bold text-sm text-slate-800 tracking-wide uppercase">{day}</h3>
                    <span className="text-xs text-slate-400 font-medium">({daySlots.length} periods)</span>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => openSetModal(day)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>Add Period</span>
                    </button>
                  )}
                </div>

                {/* Periods Grid */}
                <div className="p-5">
                  {daySlots.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center">
                      <Clock size={20} className="mb-2 text-slate-300" />
                      <span>No classes scheduled for {day}</span>
                      {canManage && (
                        <button
                          onClick={() => openSetModal(day)}
                          className="mt-2 text-blue-600 hover:underline font-semibold"
                        >
                          + Set a slot
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {daySlots.map((item) => (
                        <div
                          key={item.id}
                          className="group relative bg-slate-50/70 hover:bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md rounded-2xl p-4 transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Period Header */}
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                                Period {item.period_number}
                              </span>

                              <div className="flex items-center text-[11px] text-slate-500 font-medium">
                                <Clock size={12} className="mr-1 text-slate-400" />
                                <span>{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</span>
                              </div>
                            </div>

                            {/* Subject & Code */}
                            <h4 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-blue-600 transition-colors">
                              {item.subjects?.name || 'Subject'}
                            </h4>
                            <div className="text-xs font-mono font-semibold text-slate-500 mt-0.5">
                              {item.subjects?.code || '—'}
                            </div>

                            {/* Faculty & Room details */}
                            <div className="mt-4 pt-3 border-t border-slate-200/70 space-y-1.5 text-xs text-slate-600">
                              <div className="flex items-center gap-2">
                                <User size={13} className="text-slate-400 flex-shrink-0" />
                                <span className="font-medium text-slate-700 truncate">
                                  {item.faculty_name || item.staff?.name || 'Faculty Member'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <MapPin size={13} className="text-slate-400 flex-shrink-0" />
                                <span>{item.room || 'Room 301'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Actions (for advisors/staff) */}
                          {canManage && (
                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditModal(item)}
                                className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                                title="Edit slot"
                              >
                                <Edit2 size={13} />
                                <span className="text-[11px]">Edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                                title="Remove slot"
                              >
                                <Trash2 size={13} />
                                <span className="text-[11px]">Delete</span>
                              </button>
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

      {/* Set Timetable Slot Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="text-blue-600" size={20} />
                  <span>{editingSlotId ? 'Edit Timetable Slot' : 'Set Timetable Slot'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingSlotId ? 'Update scheduled subject, period, or classroom.' : 'Schedule subject, assigned teacher, and classroom location.'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Class */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Class * <span className="text-[10px] font-normal text-slate-400">(type custom name or pick suggestion)</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="target-class-options"
                    value={formData.class_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = options.classes.find((c) => c.name.toLowerCase() === val.toLowerCase());
                      setFormData({
                        ...formData,
                        class_name: val,
                        class_id: matched ? matched.id : '',
                      });
                    }}
                    placeholder="e.g. CSE - Year 3 - Sec A"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                  />
                  <datalist id="target-class-options">
                    {options.classes.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                {/* Day */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Day *</label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Period Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Period Number *</label>
                  <select
                    value={formData.period_number}
                    onChange={(e) => handlePeriodChange(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                      <option key={num} value={num}>Period {num}</option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject * <span className="text-[10px] font-normal text-slate-400">(type custom subject or pick suggestion)</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="subject-options"
                    value={formData.subject_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = options.subjects.find(
                        (s) => `${s.code} - ${s.name}`.toLowerCase() === val.toLowerCase() || s.name.toLowerCase() === val.toLowerCase()
                      );
                      setFormData({
                        ...formData,
                        subject_name: val,
                        subject_id: matched ? matched.id : '',
                      });
                    }}
                    placeholder="e.g. CS301 - Database Management Systems"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                  />
                  <datalist id="subject-options">
                    {options.subjects.map((sub) => (
                      <option key={sub.id} value={`${sub.code} - ${sub.name}`} />
                    ))}
                  </datalist>
                </div>

                {/* Faculty / Teacher */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Faculty / Teacher * <span className="text-[10px] font-normal text-slate-400">(type custom faculty or pick suggestion)</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="faculty-options"
                    value={formData.faculty_name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = options.faculty.find((f) => f.name.toLowerCase() === val.toLowerCase());
                      setFormData({
                        ...formData,
                        faculty_name: val,
                        faculty_id: matched ? matched.id : '',
                      });
                    }}
                    placeholder="e.g. Prof. Alan Turing"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                  />
                  <datalist id="faculty-options">
                    {options.faculty.map((f) => (
                      <option key={f.id} value={f.name} />
                    ))}
                  </datalist>
                </div>

                {/* Start Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* End Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Room */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Room / Hall Location</label>
                  <input
                    type="text"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    placeholder="e.g. Room 302, Lab 4"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {formSubmitting
                    ? (editingSlotId ? 'Saving...' : 'Scheduling...')
                    : (editingSlotId ? 'Save Changes' : 'Set Timetable Slot')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timetable;
