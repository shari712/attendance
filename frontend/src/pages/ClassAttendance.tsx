import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Save, 
  Camera, 
  Download, 
  Search,
  Sparkles,
  Briefcase
} from 'lucide-react';

interface Student {
  id: string;
  name: string;
  register_number: string;
  department?: string;
  section?: string;
  face_registration_status?: boolean;
}

interface TimetableSlot {
  id: string;
  class_id: string;
  day: string;
  period_number: number;
  start_time: string;
  end_time: string;
  subjects?: { name: string; code: string };
  staff?: { name: string };
  classes?: { name: string };
}

const ClassAttendance: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [attendanceMap, setAttendanceMap] = useState<Record<string, 'present' | 'absent' | 'od'>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load students & timetable
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        const [studs, tt, todayAtt] = await Promise.all([
          api.get('/students/'),
          api.get('/timetable/'),
          api.get('/attendance/today').catch(() => []),
        ]);

        setStudents(studs || []);
        setTimetable(tt || []);

        if (tt && tt.length > 0) {
          setSelectedSlotId(tt[0].id);
        }

        // Initialize attendance map
        const initialMap: Record<string, 'present' | 'absent' | 'od'> = {};
        (studs || []).forEach((s: Student) => {
          initialMap[s.id] = 'absent';
        });

        // Overlay any recorded attendance
        (todayAtt || []).forEach((a: any) => {
          if (a.student_id && a.status) {
            const normalized = a.status.toLowerCase() === 'late' ? 'od' : a.status.toLowerCase();
            initialMap[a.student_id] = normalized;
          }
        });

        setAttendanceMap(initialMap);
      } catch (err) {
        console.error('Error loading attendance data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const activeSlot = useMemo(() => {
    return timetable.find((t) => t.id === selectedSlotId);
  }, [timetable, selectedSlotId]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => 
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.register_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

  // Quick stats
  const total = students.length;
  const presentCount = Object.values(attendanceMap).filter((v) => v === 'present').length;
  const odCount = Object.values(attendanceMap).filter((v) => v === 'od').length;
  const absentCount = total - presentCount - odCount;
  const attendanceRate = total > 0 ? Math.round(((presentCount + odCount) / total) * 100) : 0;

  const setStudentStatus = (id: string, status: 'present' | 'absent' | 'od') => {
    setAttendanceMap((prev) => ({ ...prev, [id]: status }));
  };

  const markAll = (status: 'present' | 'absent' | 'od') => {
    const newMap: Record<string, 'present' | 'absent' | 'od'> = {};
    students.forEach((s) => {
      newMap[s.id] = status;
    });
    setAttendanceMap(newMap);
  };

  const handleSaveAttendance = async () => {
    if (!selectedSlotId) {
      alert('Please select a timetable period slot first.');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const items = Object.entries(attendanceMap).map(([student_id, status]) => ({
        student_id,
        timetable_id: selectedSlotId,
        date: selectedDate,
        status,
      }));

      await api.post('/attendance/manual-mark', { items });
      setSaveMessage('Attendance recorded and saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to record attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Student Name', 'Register Number', 'Date', 'Subject', 'Period', 'Status'],
      ...students.map((s) => [
        s.name,
        s.register_number,
        selectedDate,
        activeSlot?.subjects?.name || 'Class',
        activeSlot ? `Period ${activeSlot.period_number}` : '1',
        attendanceMap[s.id] || 'absent',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Class Attendance Sheet</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
              Live Session
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Mark, review, and synchronize classroom attendance records for today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const path = role === 'CLASS_ADVISOR' ? '/advisor/period-attendance' : '/staff/period-attendance';
              navigate(path);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-semibold border border-blue-200 transition-all cursor-pointer"
          >
            <Camera size={16} />
            <span>AI Face Scanner</span>
          </button>

          <button
            onClick={handleSaveAttendance}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save Attendance'}</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Control & Selector Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
        {/* Date Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400" />
            <span>Session Date</span>
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Timetable Slot Selector */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
            <Clock size={13} className="text-slate-400" />
            <span>Active Period / Subject</span>
          </label>
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            {timetable.length === 0 ? (
              <option value="">No timetable slots scheduled</option>
            ) : (
              timetable.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  Period {slot.period_number} ({slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}) : {slot.subjects?.name || 'Subject'} [{slot.day}]
                </option>
              ))
            )}
          </select>
        </div>

        {/* Export Button */}
        <div className="flex sm:justify-end pt-4 sm:pt-0">
          <button
            onClick={exportCSV}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Total Enrolled</div>
            <div className="text-xl font-bold text-slate-900">{total}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Present</div>
            <div className="text-xl font-bold text-slate-900">{presentCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Briefcase size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">On Duty (OD)</div>
            <div className="text-xl font-bold text-purple-900">{odCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            <XCircle size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Absent</div>
            <div className="text-xl font-bold text-slate-900">{absentCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Turnout Rate</div>
            <div className="text-xl font-bold text-slate-900">{attendanceRate}%</div>
          </div>
        </div>
      </div>

      {/* Roster & Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => markAll('present')}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
            >
              Mark All Present
            </button>
            <button
              onClick={() => markAll('absent')}
              className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
            >
              Mark All Absent
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <span className="text-xs">Loading class roster...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No students found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5">Student</th>
                  <th className="py-3 px-4">Register Number</th>
                  <th className="py-3 px-4">Biometrics</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Quick Mark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudents.map((s) => {
                  const status = attendanceMap[s.id] || 'absent';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                            {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 text-xs">{s.name}</div>
                            <div className="text-[11px] text-slate-400">{s.department || 'Computer Science'}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {s.register_number}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {s.face_registration_status ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Face Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <AlertCircle size={11} /> Unregistered
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                            status === 'present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : status === 'od'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {status === 'od' ? 'On Duty (OD)' : status}
                        </span>
                      </td>

                      <td className="py-3 px-5 text-right">
                        <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                          <button
                            onClick={() => setStudentStatus(s.id, 'present')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                              status === 'present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-emerald-700'
                            }`}
                            title="Mark Present"
                          >
                            P
                          </button>
                          <button
                            onClick={() => setStudentStatus(s.id, 'od')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                              status === 'od'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-purple-700'
                            }`}
                            title="Mark On Duty (OD)"
                          >
                            OD
                          </button>
                          <button
                            onClick={() => setStudentStatus(s.id, 'absent')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                              status === 'absent'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-red-700'
                            }`}
                            title="Mark Absent"
                          >
                            A
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassAttendance;
