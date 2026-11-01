import React, { useEffect, useState } from 'react';
import {
  Users,
  Camera,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  LogOut,
  Settings,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface DashboardStats {
  total_students?: number;
  present_today?: number;
  absent_today?: number;
  attendance_percentage?: number;
  active_cameras?: number;
  unknown_faces?: number;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  trend: string;
  color: string;
}

interface AttendanceRowProps {
  name: string;
  reg: string;
  cls: string;
  time: string;
  status: 'Present' | 'Late' | 'Absent';
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        const baseUrl =
          import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

        const response = await fetch(`${baseUrl}/api/dashboard`);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch dashboard stats (${response.status})`
          );
        }

        const data: DashboardStats = await response.json();
        setStats(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'An error occurred';

        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const totalStudents = stats?.total_students ?? 0;
  const presentToday = stats?.present_today ?? 0;
  const absentToday = stats?.absent_today ?? 0;
  const attendancePercentage = stats?.attendance_percentage ?? 0;
  const activeCameras = stats?.active_cameras ?? 0;
  const unknownFaces = stats?.unknown_faces ?? 0;

  const absencePercentage = Math.max(0, 100 - attendancePercentage);

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col transition-all duration-300">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Camera className="text-blue-500" />
            SmartFace
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            Admin Portal
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem
            icon={<BarChart3 size={20} />}
            label="Dashboard"
            active={location.pathname === '/admin/dashboard'}
            onClick={() => navigate('/admin/dashboard')}
          />

          <NavItem
            icon={<Users size={20} />}
            label="Manage Students"
            active={location.pathname === '/admin/students'}
            onClick={() => navigate('/admin/students')}
          />

          <NavItem
            icon={<BookOpen size={20} />}
            label="Classes & Subjects"
            active={location.pathname === '/admin/classes-subjects'}
            onClick={() => navigate('/admin/classes-subjects')}
          />

          <NavItem
            icon={<Camera size={20} />}
            label="Face Registration"
            active={location.pathname === '/admin/face-registration'}
            onClick={() => navigate('/admin/face-registration')}
          />

          <NavItem
            icon={<AlertTriangle size={20} />}
            label="Security Alerts"
            active={location.pathname === '/admin/security-alerts'}
            onClick={() => navigate('/admin/security-alerts')}
          />

          <NavItem
            icon={<Settings size={20} />}
            label="System Settings"
            active={location.pathname === '/admin/settings'}
            onClick={() => navigate('/admin/settings')}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors w-full p-2 rounded-lg hover:bg-slate-800"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          <header className="mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Overview
              </h1>

              <p className="text-slate-500 mt-1">
                Today's attendance and system status.
              </p>
            </div>

            <div className="text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </header>

          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2
                className="animate-spin text-blue-500"
                size={48}
              />
            </div>
          )}

          {!loading && error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3 mb-8">
              <AlertTriangle size={22} />

              <div>
                <p className="font-semibold">
                  Unable to load dashboard data
                </p>

                <p className="text-sm mt-1">
                  {error}
                </p>
              </div>
            </div>
          )}

          {!loading && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard
                  title="Total Students"
                  value={totalStudents.toLocaleString()}
                  icon={<Users className="text-blue-600" />}
                  trend="+12 this month"
                  color="bg-blue-50 border-blue-100"
                />

                <StatCard
                  title="Present Today"
                  value={presentToday.toLocaleString()}
                  icon={<CheckCircle2 className="text-green-600" />}
                  trend={`${attendancePercentage}% attendance`}
                  color="bg-green-50 border-green-100"
                />

                <StatCard
                  title="Absent Today"
                  value={absentToday.toLocaleString()}
                  icon={<XCircle className="text-rose-600" />}
                  trend={`${absencePercentage}% absence`}
                  color="bg-rose-50 border-rose-100"
                />

                <StatCard
                  title="Active Cameras"
                  value={`${activeCameras}/12`}
                  icon={<Camera className="text-purple-600" />}
                  trend="All systems operational"
                  color="bg-purple-50 border-purple-100"
                />

                <StatCard
                  title="Security Alerts"
                  value={unknownFaces}
                  icon={<AlertTriangle className="text-amber-600" />}
                  trend={
                    unknownFaces > 0
                      ? 'Unknown faces detected'
                      : 'No recent alerts'
                  }
                  color="bg-amber-50 border-amber-100"
                />
              </div>

              {/* Recent Attendance */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-slate-900">
                    Recent Attendance Logs
                  </h3>

                  <button
                    type="button"
                    onClick={() => navigate('/admin/students')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-6 py-4 font-medium">
                          Student
                        </th>

                        <th className="px-6 py-4 font-medium">
                          Register No
                        </th>

                        <th className="px-6 py-4 font-medium">
                          Class / Period
                        </th>

                        <th className="px-6 py-4 font-medium">
                          Time
                        </th>

                        <th className="px-6 py-4 font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      <AttendanceRow
                        name="Harshini S"
                        reg="23CS101"
                        cls="III Year CSE / Period 1"
                        time="09:05 AM"
                        status="Present"
                      />

                      <AttendanceRow
                        name="Pooja Sri A"
                        reg="23CS105"
                        cls="III Year CSE / Period 1"
                        time="09:06 AM"
                        status="Present"
                      />

                      <AttendanceRow
                        name="Dharani S"
                        reg="23CS112"
                        cls="III Year CSE / Period 1"
                        time="09:12 AM"
                        status="Late"
                      />
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  active = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all ${active
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
    >
      {icon}

      <span className="font-medium">
        {label}
      </span>
    </button>
  );
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  color,
}) => {
  return (
    <div
      className={`p-6 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group ${color}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 rounded-xl bg-white/70">
          {icon}
        </div>
      </div>

      <div>
        <h4 className="text-slate-500 font-medium text-sm mb-1">
          {title}
        </h4>

        <div className="text-3xl font-extrabold text-slate-900">
          {value}
        </div>

        <p className="text-xs text-slate-500 mt-2 font-medium">
          {trend}
        </p>
      </div>

      <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
        {React.cloneElement(icon as React.ReactElement<any>, {
          size: 120,
        })}
      </div>
    </div>
  );
};

const AttendanceRow: React.FC<AttendanceRowProps> = ({
  name,
  reg,
  cls,
  time,
  status,
}) => {
  const statusClasses =
    status === 'Present'
      ? 'bg-green-100 text-green-700'
      : status === 'Late'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-rose-100 text-rose-700';

  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4 font-medium text-slate-900">
        {name}
      </td>

      <td className="px-6 py-4 text-slate-500">
        {reg}
      </td>

      <td className="px-6 py-4 text-slate-500">
        {cls}
      </td>

      <td className="px-6 py-4 text-slate-500">
        {time}
      </td>

      <td className="px-6 py-4">
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${statusClasses}`}
        >
          {status}
        </span>
      </td>
    </tr>
  );
};

export default AdminDashboard;