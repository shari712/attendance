import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  Download, 
  CheckCircle2, 
  XCircle, 
  ChevronDown,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

interface AttendanceLog {
  id: string;
  student_id: string;
  timetable_id: string;
  date: string;
  status: 'present' | 'absent' | 'od';
  check_in_time?: string;
  check_out_time?: string;
  students?: {
    name: string;
    register_number: string;
  };
  timetable?: {
    period_number: number;
    subjects?: {
      name: string;
      code: string;
    };
  };
}

const AttendanceHistory: React.FC = () => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const { data: attData } = await supabase
          .from('attendance')
          .select(`
            id,
            student_id,
            timetable_id,
            date,
            status,
            check_in_time,
            check_out_time,
            students (
              name,
              register_number
            ),
            timetable (
              period_number,
              subjects (
                name,
                code
              )
            )
          `)
          .order('date', { ascending: false });

        if (attData && attData.length > 0) {
          setLogs(attData as any);
        } else {
          const data = await api.get('/attendance/history').catch(() => []);
          setLogs(data || []);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const studentName = log.students?.name?.toLowerCase() || '';
      const regNo = log.students?.register_number?.toLowerCase() || '';
      const subjectName = log.timetable?.subjects?.name?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();

      const matchesSearch = studentName.includes(query) || regNo.includes(query) || subjectName.includes(query);
      const matchesStatus = statusFilter === 'ALL' || log.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesDate = !dateFilter || log.date === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [logs, searchQuery, statusFilter, dateFilter]);

  // Statistics
  const totalCount = logs.length;
  const presentCount = logs.filter((l) => l.status === 'present').length;
  const absentCount = logs.filter((l) => l.status === 'absent').length;
  const presentRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const exportCSV = () => {
    const rows = [
      ['Date', 'Student Name', 'Register Number', 'Subject', 'Period', 'Status', 'Check-in Time'],
      ...filteredLogs.map((l) => [
        l.date,
        l.students?.name || 'Student',
        l.students?.register_number || '—',
        l.timetable?.subjects?.name || 'Class',
        l.timetable ? `Period ${l.timetable.period_number}` : '—',
        l.status,
        l.check_in_time ? new Date(l.check_in_time).toLocaleTimeString() : '—',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_History_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span>Attendance History & Logs</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {totalCount} Total Entries
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit trail of historical period attendance and biometric verification logs.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Download size={14} />
          <span>Export Records (CSV)</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers size={22} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Total Entries</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Verified Present</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5 flex items-baseline gap-2">
              <span>{presentCount}</span>
              <span className="text-xs text-emerald-600 font-semibold">({presentRate}%)</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            <XCircle size={22} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Recorded Absences</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{absentCount}</div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search student, roll no, subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none text-xs font-semibold pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="present">Present</option>
              <option value="od">On Duty (OD)</option>
              <option value="absent">Absent</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-xs text-blue-600 hover:underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-500">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <span className="text-xs">Loading audit logs...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            <FileSpreadsheet size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">No logs match your filter criteria</p>
            <p className="text-slate-400 text-[11px] mt-0.5">Records appear here once attendance is saved or scanned.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Register No</th>
                  <th className="py-3 px-4">Subject & Period</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Verification Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-xs text-slate-700">
                      {log.date}
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-800 text-xs">
                      {log.students?.name || 'Enrolled Student'}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                      {log.students?.register_number || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">{log.timetable?.subjects?.name || 'Class Subject'}</div>
                      <div className="text-[11px] text-slate-400">
                        {log.timetable ? `Period ${log.timetable.period_number}` : '—'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          log.status === 'present'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : log.status === 'od'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {log.status === 'present' ? <CheckCircle2 size={11} /> : log.status === 'od' ? null : <XCircle size={11} />}
                        {log.status === 'od' ? 'On Duty (OD)' : log.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 text-right text-xs text-slate-500 font-mono">
                      {log.check_in_time ? new Date(log.check_in_time).toLocaleTimeString() : 'Manual Entry'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceHistory;
