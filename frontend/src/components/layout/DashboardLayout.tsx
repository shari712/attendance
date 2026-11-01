import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  CalendarDays, 
  ClipboardCheck, 
  Activity, 
  Users, 
  History, 
  Bell, 
  User, 
  LogOut,
  Menu,
  X,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import { cn } from '../../pages/Login';
import { api } from '../../lib/api';

export const DashboardLayout: React.FC = () => {
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [classDetails, setClassDetails] = useState({
    yearSem: 'III Year / V Sem',
    course: 'M.Tech CSE',
    lectureHall: 'CH LH 11',
    enrolledCount: 48,
  });

  useEffect(() => {
    const fetchClassInfo = async () => {
      try {
        const stats = await api.get('/dashboard/stats');
        if (stats?.class_info) {
          const name = stats.class_info.name || '';
          const parts = name.includes('-') ? name.split('-') : [name, 'M.Tech CSE'];
          setClassDetails({
            yearSem: parts[0]?.trim() || 'III Year / V Sem',
            course: parts[1]?.trim() || 'M.Tech CSE',
            lectureHall: stats.class_info.lecture_hall || 'CH LH 11',
            enrolledCount: stats.class_info.total_students || 48,
          });
        }
      } catch {
        // Fallback defaults remain
      }
    };
    fetchClassInfo();
  }, [role]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  const getNavItems = () => {
    if (role === 'STUDENT') {
      return [
        { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
        { name: 'Timetable', path: '/student/timetable', icon: CalendarDays },
        { name: 'Profile', path: '/student/profile', icon: User },
      ];
    }
    if (role === 'STAFF') {
      return [
        { name: 'Dashboard', path: '/staff/dashboard', icon: LayoutDashboard },
        { name: 'Timetable', path: '/staff/timetable', icon: CalendarDays },
        { name: 'Attendance', path: '/staff/attendances', icon: User },
        { name: 'Period Attendance', path: '/staff/period-attendance', icon: ClipboardCheck },
        { name: "Today's Attendance", path: '/staff/attendance', icon: Activity },
        { name: 'Students', path: '/staff/students', icon: Users },
        { name: 'Attendance History', path: '/staff/attendance-history', icon: History },
        { name: 'Alerts', path: '/staff/alerts', icon: Bell, badge: '3' },
        { name: 'Profile', path: '/staff/profile', icon: User },
      ];
    }
    // CLASS_ADVISOR
    return [
      { name: 'Dashboard', path: '/advisor/dashboard', icon: LayoutDashboard },
      { name: 'Timetable', path: '/advisor/timetable', icon: CalendarDays },
      { name: 'Period Attendance', path: '/advisor/period-attendance', icon: ClipboardCheck },
      { name: "Today's Attendance", path: '/advisor/attendance', icon: Activity },
      { name: 'Students', path: '/advisor/students', icon: Users },
      { name: 'Attendance History', path: '/advisor/attendance-history', icon: History },
      { name: 'Alerts', path: '/advisor/alerts', icon: Bell, badge: '3' },
      { name: 'Profile', path: '/advisor/profile', icon: User },
    ];
  };

  const navItems = getNavItems();

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full bg-white text-slate-700">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="flex items-center text-lg tracking-tight">
            <span className="font-extrabold text-slate-900">smart</span>
            <span className="font-extrabold text-blue-600">attendance</span>
          </div>
        </div>
        {isMobile && (
          <button 
            onClick={closeMenu} 
            aria-label="Close menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Top Academic Status Card */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-blue-50/70 border border-blue-100/90 rounded-2xl p-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                {classDetails.yearSem}
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                {classDetails.course}
              </div>
            </div>
          </div>
          <span className="relative flex h-2.5 w-2.5 mr-1" title="Active">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            onClick={closeMenu}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all font-medium text-sm group",
                isActive 
                  ? "bg-blue-50 text-blue-600 font-semibold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center gap-3">
                  <item.icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-colors", 
                    isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                  )} />
                  <span>{item.name}</span>
                </div>
                {'badge' in item && item.badge && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-100 text-rose-600">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Lecture Hall Card & Sign Out */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-3 text-left">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            LECTURE HALL
          </div>
          <div className="text-sm font-extrabold text-slate-900 mt-0.5">
            {classDetails.lectureHall}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {classDetails.enrolledCount} students enrolled
          </div>
        </div>

        <button 
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors font-medium text-sm cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200/90 shadow-sm z-10 bg-white">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar & Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={closeMenu}
          ></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white shadow-2xl z-50 transform transition-transform animate-in slide-in-from-left duration-200">
            <SidebarContent isMobile={true} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-2xs z-0 border-b border-slate-200/80">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden text-slate-600 hover:text-slate-900 focus:outline-hidden p-2 -ml-2 rounded-xl hover:bg-slate-100"
                aria-label="Open menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="md:hidden flex items-center gap-2 ml-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="font-bold text-slate-900 text-base">smart<span className="text-blue-600">attendance</span></span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center">
              <div className="text-sm text-slate-600 font-semibold capitalize">
                {location.pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
