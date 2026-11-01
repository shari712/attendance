import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  ClipboardCheck, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  MapPin, 
  Camera,
  Edit3,
  Save,
  X,
  Building
} from 'lucide-react';

interface ScheduleSlot {
  id: string;
  period_number: number;
  start_time: string;
  end_time: string;
  room?: string;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
  subjects?: {
    code: string;
    name: string;
  };
  staff?: {
    name: string;
  };
}

const Dashboard: React.FC = () => {
  const { user, role } = useAuth();
  const periodAttendanceUrl = role === 'CLASS_ADVISOR' ? '/advisor/period-attendance' : '/staff/period-attendance';
  const [stats, setStats] = useState<any>(null);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable Form Data
  const [editForm, setEditForm] = useState({
    total_students: 48,
    class_attendance_percentage: 89.2,
    target_attendance: 85.0,
    class_name: 'III Year / V Semester M.Tech CSE',
    section: 'A',
    lecture_hall: 'CH LH 11',
    today_schedule: [] as ScheduleSlot[]
  });

  const fetchData = async () => {
    try {
      const [statsData, timetableData] = await Promise.all([
        api.get('/dashboard/stats').catch(() => null),
        api.get('/timetable/').catch(() => [])
      ]);

      let resolvedTimetable = timetableData || [];
      if (resolvedTimetable.length === 0) {
        const { data: dbSlots } = await supabase
          .from('timetable')
          .select('id, day, period_number, start_time, end_time, room, subjects(name, code), staff(name)')
          .order('period_number', { ascending: true });
        if (dbSlots && dbSlots.length > 0) {
          resolvedTimetable = dbSlots;
        }
      }

      let enrolledTotal = statsData?.total_students;
      if (!enrolledTotal) {
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });
        enrolledTotal = count || 48;
      }

      setStats({
        ...statsData,
        total_students: enrolledTotal,
        class_attendance_percentage: statsData?.class_attendance_percentage || 89.2,
      });

      // Filter timetable for today
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayDay = days[new Date().getDay()];
      const displayDay = todayDay === 'Sunday' ? 'Monday' : todayDay;
      const todaySlots = (resolvedTimetable || [])
        .filter((slot: any) => slot.day?.toLowerCase() === displayDay.toLowerCase())
        .sort((a: any, b: any) => a.period_number - b.period_number);

      const resolvedSlots: ScheduleSlot[] = todaySlots.length > 0 ? todaySlots : (resolvedTimetable || []).slice(0, 7);
      setTodaySchedule(resolvedSlots);

      // Populate edit form
      const totalStudents = enrolledTotal || 48;
      const classAvg = statsData?.class_attendance_percentage || 89.2;
      const targetAtt = statsData?.target_attendance || 85.0;
      const cName = statsData?.class_info?.name || 'III Year / V Semester M.Tech CSE';
      const cSec = statsData?.class_info?.section || 'A';
      const lHall = statsData?.class_info?.lecture_hall || (resolvedSlots[0]?.room || 'CH LH 11');

      setEditForm({
        total_students: totalStudents,
        class_attendance_percentage: classAvg,
        target_attendance: targetAtt,
        class_name: cName,
        section: cSec,
        lecture_hall: lHall,
        today_schedule: resolvedSlots.map((s) => ({
          ...s,
          subject_name: s.subjects?.name || s.subject_name || '',
          faculty_name: s.staff?.name || s.faculty_name || '',
          start_time: s.start_time ? s.start_time.slice(0, 5) : '09:30',
          end_time: s.end_time ? s.end_time.slice(0, 5) : '10:20',
          room: s.room || lHall
        }))
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartEditing = () => {
    const totalStudents = stats?.total_students || 48;
    const classAvg = stats?.class_attendance_percentage || 89.2;
    const targetAtt = stats?.target_attendance || 85.0;
    const cName = stats?.class_info?.name || 'III Year / V Semester M.Tech CSE';
    const cSec = stats?.class_info?.section || 'A';
    const lHall = stats?.class_info?.lecture_hall || (todaySchedule[0]?.room || 'CH LH 11');

    setEditForm({
      total_students: totalStudents,
      class_attendance_percentage: classAvg,
      target_attendance: targetAtt,
      class_name: cName,
      section: cSec,
      lecture_hall: lHall,
      today_schedule: todaySchedule.map((s) => ({
        ...s,
        subject_name: s.subjects?.name || s.subject_name || '',
        faculty_name: s.staff?.name || s.faculty_name || '',
        start_time: s.start_time ? s.start_time.slice(0, 5) : '09:30',
        end_time: s.end_time ? s.end_time.slice(0, 5) : '10:20',
        room: s.room || lHall
      }))
    });
    setIsEditing(true);
    setSaveSuccess(false);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setSaveSuccess(false);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        total_students: Number(editForm.total_students),
        class_attendance_percentage: Number(editForm.class_attendance_percentage),
        target_attendance: Number(editForm.target_attendance),
        class_name: editForm.class_name,
        section: editForm.section,
        lecture_hall: editForm.lecture_hall,
        today_schedule: editForm.today_schedule.map((s) => ({
          id: s.id,
          period_number: Number(s.period_number),
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room || editForm.lecture_hall,
          subject_name: s.subject_name,
          faculty_name: s.faculty_name
        }))
      };

      const updated = await api.put('/dashboard/advisor-config', payload);
      if (updated) {
        setStats(updated);
      }
      await fetchData();
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save dashboard updates.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleSlotChange = (index: number, field: keyof ScheduleSlot, value: any) => {
    setEditForm((prev) => {
      const updated = [...prev.today_schedule];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return { ...prev, today_schedule: updated };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Loading your attendance dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center max-w-lg mx-auto my-8">
        <AlertTriangle className="text-red-500 w-8 h-8 mx-auto mb-2" />
        <h3 className="font-bold text-red-900">Unable to load dashboard</h3>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = daysOfWeek[new Date().getDay()];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Save Success Alert */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 text-emerald-800 text-sm font-semibold">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <span>Dashboard changes saved to Supabase successfully!</span>
          </div>
          <button 
            onClick={() => setSaveSuccess(false)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Edit Mode Notice Banner */}
      {isEditing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-blue-900 text-xs font-semibold">
            <Sparkles size={16} className="text-blue-600" />
            <span>Edit Mode Active: Make your changes below, then click &quot;Save Changes&quot; to update the database.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelEditing}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-medium text-blue-100">
              <Sparkles size={14} className="text-blue-300" />
              <span>Smart Attendance System • Odd Semester 2026-27</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {stats?.advisor_name || user?.email?.split('@')[0] || 'Class Advisor'}!
            </h1>
            <p className="text-blue-100 text-sm max-w-xl">
              Class: <span className="font-semibold text-white">{isEditing ? editForm.class_name : (stats?.class_info?.name || 'III Year / V Semester M.Tech CSE')}</span> • 
              Lecture Hall: <span className="font-semibold text-white">{isEditing ? editForm.lecture_hall : (stats?.class_info?.lecture_hall || 'CH LH 11')}</span> • 
              Today is <span className="font-semibold text-white">{todayName}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Clear Edit Dashboard Button */}
            {!isEditing ? (
              <button
                onClick={handleStartEditing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-blue-700 text-sm font-bold shadow-lg shadow-black/10 hover:bg-blue-50 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <Edit3 size={16} />
                <span>Edit Dashboard</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancelEditing}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-all cursor-pointer"
                >
                  <X size={16} />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <Save size={16} />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </>
            )}

            <Link
              to={periodAttendanceUrl}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-all"
            >
              <Camera size={16} />
              <span>Take Attendance</span>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/2 -top-10 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Top Stat Cards - Exactly 2 Cards (CLASSES ASSIGNED and TOTAL SUBJECTS Removed) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Total Students / Class Strength */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Students</span>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={24} />
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Total Enrolled / Strength</label>
              <input
                type="number"
                min="1"
                max="200"
                value={editForm.total_students}
                onChange={(e) => setEditForm({ ...editForm, total_students: Number(e.target.value) })}
                className="w-full text-2xl font-extrabold text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">Class capacity and active enrolled roster</p>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-extrabold text-slate-900">{stats?.total_students || 48}</span>
                <span className="text-sm font-semibold text-slate-500">Enrolled (Strength: {stats?.total_students || 48})</span>
              </div>
              <p className="text-xs text-slate-500 mt-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>{stats?.class_info?.name || 'III Year M.Tech CSE'} • Section {stats?.class_info?.section || 'A'}</span>
              </p>
            </div>
          )}
        </div>

        {/* Card 2: Class Average Attendance & Target */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class Avg Attendance</span>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ClipboardCheck size={24} />
            </div>
          </div>

          {isEditing ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Class Avg (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={editForm.class_attendance_percentage}
                  onChange={(e) => setEditForm({ ...editForm, class_attendance_percentage: Number(e.target.value) })}
                  className="w-full text-xl font-extrabold text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={editForm.target_attendance}
                  onChange={(e) => setEditForm({ ...editForm, target_attendance: Number(e.target.value) })}
                  className="w-full text-xl font-extrabold text-slate-900 border border-slate-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-extrabold text-slate-900">
                  {stats?.class_attendance_percentage ? `${stats.class_attendance_percentage}%` : '89.2%'}
                </span>
                <span className="text-sm font-semibold text-emerald-600">Active Status</span>
              </div>
              <p className="text-xs text-slate-500 mt-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Target attendance: {stats?.target_attendance ? `${stats.target_attendance}%` : '85%'}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Balanced Main Content Layout (Schedule + Class Details) without Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="text-blue-600" size={18} />
                <span>Today&apos;s Class Schedule ({todayName})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEditing ? 'Directly adjust periods, timings, subjects, and classroom locations below:' : 'All 7 periods scheduled for III Year / V Sem M.Tech CSE'}
              </p>
            </div>
            <Link
              to="/advisor/timetable"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline"
            >
              <span>Full Week</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="space-y-3">
            {todaySchedule.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No classes scheduled for today.
              </div>
            ) : (
              (isEditing ? editForm.today_schedule : todaySchedule).map((slot, idx) => {
                const subCode = slot.subjects?.code || slot.subject_code || `P${slot.period_number}`;
                const subName = slot.subjects?.name || slot.subject_name || 'Subject Session';
                const facultyName = slot.staff?.name || slot.faculty_name || 'Assigned Faculty';
                const sTime = slot.start_time ? slot.start_time.slice(0, 5) : '09:30';
                const eTime = slot.end_time ? slot.end_time.slice(0, 5) : '10:20';

                return (
                  <div
                    key={slot.id || idx}
                    className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/60 hover:bg-blue-50/30 hover:border-blue-100 transition-all"
                  >
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                              P{slot.period_number}
                            </span>
                            <span className="text-xs font-bold text-slate-700">Period {slot.period_number}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Clock size={12} className="text-slate-400" />
                            <input
                              type="time"
                              value={slot.start_time}
                              onChange={(e) => handleScheduleSlotChange(idx, 'start_time', e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                            />
                            <span>to</span>
                            <input
                              type="time"
                              value={slot.end_time}
                              onChange={(e) => handleScheduleSlotChange(idx, 'end_time', e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Subject</label>
                            <input
                              type="text"
                              value={slot.subject_name}
                              onChange={(e) => handleScheduleSlotChange(idx, 'subject_name', e.target.value)}
                              placeholder="Subject Name"
                              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Faculty / Teacher</label>
                            <input
                              type="text"
                              value={slot.faculty_name}
                              onChange={(e) => handleScheduleSlotChange(idx, 'faculty_name', e.target.value)}
                              placeholder="Faculty Name"
                              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Room / Location</label>
                            <input
                              type="text"
                              value={slot.room}
                              onChange={(e) => handleScheduleSlotChange(idx, 'room', e.target.value)}
                              placeholder="e.g. CH LH 11"
                              className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-xs flex flex-col items-center justify-center shrink-0 shadow-xs">
                            <span className="text-[10px] font-medium opacity-80 leading-none">P</span>
                            <span className="text-sm font-extrabold leading-none mt-0.5">{slot.period_number}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold">
                                {subCode}
                              </span>
                              <h4 className="text-xs font-bold text-slate-800">
                                {subName}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                              <span className="font-medium text-slate-700">{facultyName}</span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} className="text-slate-400" />
                                {sTime} - {eTime}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin size={12} className="text-slate-400" />
                                {slot.room || 'CH LH 11'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <Link
                          to={periodAttendanceUrl}
                          className="self-end sm:self-center px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white text-xs font-semibold transition-all shrink-0 border border-blue-200/60"
                        >
                          Mark Attendance
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Class Academic Details (Balanced Layout) */}
        <div>
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-md border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Building size={14} />
                <span>Class Details</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>Active</span>
              </span>
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Class Name</label>
                  <input
                    type="text"
                    value={editForm.class_name}
                    onChange={(e) => setEditForm({ ...editForm, class_name: e.target.value })}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Section</label>
                  <input
                    type="text"
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Lecture Hall / Room</label>
                  <input
                    type="text"
                    value={editForm.lecture_hall}
                    onChange={(e) => setEditForm({ ...editForm, lecture_hall: e.target.value })}
                    className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-base font-extrabold text-white">
                  {stats?.class_info?.name || 'III Year / V Semester M.Tech CSE'}
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">
                  {stats?.class_info?.degree || 'M.Tech Computer Science & Engineering'}
                </p>
                
                <div className="mt-5 pt-4 border-t border-slate-700/60 space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Class Section:</span>
                    <span className="font-semibold text-white">Section {stats?.class_info?.section || 'A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Lecture Hall:</span>
                    <span className="font-semibold text-white">{stats?.class_info?.lecture_hall || 'CH LH 11'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Strength:</span>
                    <span className="font-semibold text-white">{stats?.total_students || 48} Students</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Target Attendance:</span>
                    <span className="font-semibold text-emerald-400">{stats?.target_attendance || 85}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Weekly Sessions:</span>
                    <span className="font-semibold text-white">42 Slots (Mon - Sat)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Academic Year:</span>
                    <span className="font-semibold text-white">{stats?.class_info?.academic_year || '2026-2027'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
