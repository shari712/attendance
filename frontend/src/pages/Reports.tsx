import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Users, 
  Search, 
  Send
} from 'lucide-react';

interface StudentStat {
  student_id: string;
  name: string;
  register_number: string;
  department: string;
  total_classes: number;
  present_classes: number;
  absent_classes: number;
  percentage: number;
  is_defaulter: boolean;
}

interface ReportData {
  overall_percentage: number;
  total_students: number;
  defaulters_count: number;
  total_records: number;
  student_stats: StudentStat[];
}

const Reports: React.FC = () => {
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyDefaulters, setShowOnlyDefaulters] = useState(false);
  const [noticeSent, setNoticeSent] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      try {
        const data = await api.get('/attendance/reports');
        setReport(data);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, []);

  const filteredStats = useMemo(() => {
    if (!report?.student_stats) return [];
    return report.student_stats.filter((s) => {
      const matchesSearch = 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.register_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDefaulter = showOnlyDefaulters ? s.is_defaulter : true;
      return matchesSearch && matchesDefaulter;
    });
  }, [report, searchQuery, showOnlyDefaulters]);

  const handleSendNotice = async () => {
    try {
      await api.post('/alerts/', {
        title: 'Attendance Defaulter Warning (<75%)',
        description: 'Notice issued: You are currently below the required 75% classroom attendance threshold.',
      });
      setNoticeSent(true);
      setTimeout(() => setNoticeSent(false), 3000);
    } catch (err) {
      alert('Failed to send notice.');
    }
  };

  const exportCSV = () => {
    if (!report?.student_stats) return;
    const rows = [
      ['Student Name', 'Register Number', 'Department', 'Total Classes', 'Present', 'Absent', 'Percentage %', 'Defaulter Status'],
      ...report.student_stats.map((s) => [
        s.name,
        s.register_number,
        s.department,
        s.total_classes,
        s.present_classes,
        s.absent_classes,
        `${s.percentage}%`,
        s.is_defaulter ? 'DEFALUTER (<75%)' : 'NORMAL',
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${new Date().toISOString().split('T')[0]}.csv`);
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
            <span>Attendance & Performance Reports</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
              Analytics
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Evaluate cohort turnout percentages, exam eligibility thresholds, and student attendance trends.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Download size={15} />
          <span>Download Formal Report (CSV)</span>
        </button>
      </div>

      {noticeSent && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span>Automated warning alerts dispatched to student portals!</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Class Average Attendance</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {report?.overall_percentage ?? 85}%
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Total Enrolled</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {report?.total_students ?? 0}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-slate-400">Attendance Defaulters (&lt;75%)</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5 flex items-baseline gap-2">
              <span className="text-red-600">{report?.defaulters_count ?? 0}</span>
              <span className="text-xs text-slate-400">Students</span>
            </div>
          </div>
        </div>
      </div>

      {/* Defaulter Alert Action Banner if any */}
      {(report?.defaulters_count ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-xs">
                {report?.defaulters_count} students are below the mandatory 75% attendance threshold.
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Students below 75% are ineligible for upcoming semester examinations.
              </p>
            </div>
          </div>

          <button
            onClick={handleSendNotice}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Send size={13} />
            <span>Notify Defaulters</span>
          </button>
        </div>
      )}

      {/* Roster & Progress Bars */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search student or roll no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOnlyDefaulters(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                !showOnlyDefaulters
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Students
            </button>
            <button
              onClick={() => setShowOnlyDefaulters(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                showOnlyDefaulters
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Defaulters Only (&lt;75%)
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-slate-500">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <span className="text-xs">Computing attendance analytics...</span>
          </div>
        ) : filteredStats.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            No students found matching current report filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Student</th>
                  <th className="py-3.5 px-4">Roll No</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Classes (Attended / Total)</th>
                  <th className="py-3.5 px-6">Attendance Rate %</th>
                  <th className="py-3.5 px-5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStats.map((s) => (
                  <tr key={s.student_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-800 text-xs">{s.name}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      {s.register_number}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {s.department}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                      {s.present_classes} / {s.total_classes}
                    </td>

                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.percentage >= 75 ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(s.percentage, 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-xs text-slate-800 w-10 text-right">
                          {s.percentage}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      {s.is_defaulter ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                          <AlertTriangle size={11} /> Defaulter
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> Eligible
                        </span>
                      )}
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

export default Reports;
