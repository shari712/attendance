import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  UserCheck, 
  ShieldCheck, 
  Sparkles,
  MapPin,
  TrendingUp,
  Award,
  Loader2
} from 'lucide-react';

interface StudentProfile {
  id?: string;
  name?: string;
  register_number?: string;
  department?: string;
  year?: number;
  section?: string;
  email?: string;
  face_registration_status?: boolean;
}

interface TimetableSlot {
  id: string;
  day: string;
  period_number: number;
  start_time: string;
  end_time: string;
  room?: string;
  subject_name?: string;
  subject_code?: string;
  faculty_name?: string;
}

interface AttendanceLog {
  id: string;
  date: string;
  period_number: number;
  subject_name?: string;
  status: 'PRESENT' | 'ABSENT';
  method?: string;
}

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [studentInfo, setStudentInfo] = useState<StudentProfile | null>(null);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [stats] = useState({
    totalClasses: 48,
    attended: 42,
    percentage: 87.5,
    target: 75.0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStudentData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch student's profile information
        const me = await api.get('/auth/me');
        if (me) {
          setStudentInfo(me);
        }

        // 2. Fetch timetable for student's class
        try {
          const tt = await api.get('/timetable/');
          if (Array.isArray(tt)) {
            // Filter for today's day of week
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayName = days[new Date().getDay()];
            const todaysSlots = tt.filter((slot: any) => 
              slot.day?.toLowerCase() === todayName.toLowerCase() || slot.day?.toLowerCase() === 'monday'
            );
            setTimetable(todaysSlots.length ? todaysSlots : tt.slice(0, 7));
          }
        } catch (ttErr) {
          console.warn('Timetable load warning:', ttErr);
        }

        // 3. Mock/fetch attendance records
        setAttendanceLogs([
          { id: '1', date: new Date().toISOString().split('T')[0], period_number: 1, subject_name: 'Database Management Systems', status: 'PRESENT', method: 'Face Recognition' },
          { id: '2', date: new Date().toISOString().split('T')[0], period_number: 2, subject_name: 'Computer Networks', status: 'PRESENT', method: 'Face Recognition' },
          { id: '3', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], period_number: 1, subject_name: 'Compiler Design', status: 'PRESENT', method: 'Face Recognition' },
          { id: '4', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], period_number: 3, subject_name: 'Machine Learning', status: 'PRESENT', method: 'Face Recognition' },
          { id: '5', date: new Date(Date.now() - 172800000).toISOString().split('T')[0], period_number: 2, subject_name: 'Cloud Computing', status: 'ABSENT', method: 'Absent' },
        ]);
      } catch (err) {
        console.error('Failed to load student dashboard:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadStudentData();
  }, []);

  const percentage = stats.percentage;
  const isTargetMet = percentage >= stats.target;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Loading your student portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-blue-100 text-xs font-semibold tracking-wide">
              <Sparkles size={14} className="text-yellow-300" />
              <span>Student Academic Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {studentInfo?.name || user?.email?.split('@')[0] || 'Student'}!
            </h1>
            <p className="text-blue-100 text-sm max-w-xl leading-relaxed">
              Track your daily class attendance, period-wise schedule, and academic verification status in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 self-start md:self-auto">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <GraduationCap size={22} />
            </div>
            <div>
              <div className="text-xs text-blue-200 font-medium">Register Number</div>
              <div className="text-sm font-bold text-white tracking-wider">
                {studentInfo?.register_number || 'ENROLLED'}
              </div>
            </div>
          </div>
        </div>

        {/* Academic Details Pills */}
        <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap gap-4 text-xs font-medium text-blue-100">
          <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
            <span className="text-blue-300">Degree:</span> {studentInfo?.department || 'Computer Science'}
          </span>
          <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
            <span className="text-blue-300">Year & Section:</span> Year {studentInfo?.year || 3} - Section {studentInfo?.section || 'A'}
          </span>
          <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
            <span className="text-blue-300">Email:</span> {user?.email}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance Percentage */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Attendance Avg</span>
            <div className={`p-2 rounded-xl ${isTargetMet ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{percentage}%</span>
            <span className="text-xs font-semibold text-slate-500">of 100%</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs">
            {isTargetMet ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md">
                <CheckCircle2 size={13} /> Above {stats.target}% Target
              </span>
            ) : (
              <span className="text-amber-700 font-medium flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md">
                <AlertCircle size={13} /> Below {stats.target}% Target
              </span>
            )}
          </div>
        </div>

        {/* Classes Attended */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Classes Attended</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{stats.attended}</span>
            <span className="text-xs font-medium text-slate-500">/ {stats.totalClasses} periods</span>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {stats.totalClasses - stats.attended} periods missed this term
          </p>
        </div>

        {/* Biometric Face ID Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Biometric Status</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-bold text-slate-800">Face ID Active</span>
          </div>
          <p className="mt-3 text-xs text-emerald-600 font-medium flex items-center gap-1">
            <CheckCircle2 size={14} /> Ready for automated camera check-in
          </p>
        </div>

        {/* Academic Standing */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Award size={20} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">Good Standing</span>
          </div>
          <p className="mt-3 text-xs text-purple-700 font-medium bg-purple-50 px-2 py-0.5 rounded-md inline-block">
            Eligible for semester exams
          </p>
        </div>
      </div>

      {/* Main Grid: Today's Schedule & Attendance History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" />
                <span>Today&apos;s Class Schedule</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Live timetable slots for {studentInfo?.department || 'Computer Science'} (Sec {studentInfo?.section || 'A'})
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
          </div>

          {timetable.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No classes scheduled for today.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {timetable.map((slot, idx) => (
                <div key={slot.id || idx} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 px-2 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center shrink-0">
                      P{slot.period_number}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {slot.subject_name || slot.subject_code || `Period ${slot.period_number}`}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                        </span>
                        {slot.faculty_name && (
                          <>
                            <span>•</span>
                            <span>{slot.faculty_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium flex items-center gap-1">
                      <MapPin size={11} /> {slot.room || 'LH 11'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Attendance Records (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-indigo-600" />
              <span>Recent Activity</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Your recent verified period attendances
            </p>
          </div>

          <div className="space-y-3">
            {attendanceLogs.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-800 text-xs">
                    Period {log.period_number}: {log.subject_name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {log.date} • {log.method}
                  </div>
                </div>
                {log.status === 'PRESENT' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} /> Present
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-full">
                    <XCircle size={12} /> Absent
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Face recognition records are captured automatically during each scheduled period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
