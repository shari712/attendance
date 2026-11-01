import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './components/layout/DashboardLayout';

import Home from './pages/Home';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/admin/Dashboard';
import Dashboard from './pages/Dashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import Students from './pages/Students';
import Timetable from './pages/Timetable';
import ClassAttendance from './pages/ClassAttendance';
import PeriodAttendance from './pages/PeriodAttendance';
import AttendanceHistory from './pages/AttendanceHistory';
import Alerts from './pages/Alerts';
import Profile from './pages/Profile';
import Attendance from './pages/Attandance';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Admin / General fallback */}
          <Route path="/admin/dashboard" element={<AdminDashboard />} />

          {/* STUDENT ROUTES */}
          <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/student/dashboard" element={<StudentDashboard />} />
              <Route path="/student/timetable" element={<Timetable />} />
              <Route path="/student/profile" element={<Profile />} />
              {/* Fallbacks */}
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          {/* STAFF ROUTES */}
          <Route element={<ProtectedRoute allowedRoles={['STAFF']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/staff/dashboard" element={<Dashboard />} />
              <Route path="/staff/timetable" element={<Timetable />} />
              <Route path="/staff/period-attendance" element={<PeriodAttendance />} />
              <Route path="/staff/attendances" element={<Attendance />} />
              <Route path="/staff/attendance" element={<ClassAttendance />} />
              <Route path="/staff/todays-attendance" element={<ClassAttendance />} />
              <Route path="/staff/students" element={<Students />} />
              <Route path="/staff/attendance-history" element={<AttendanceHistory />} />
              <Route path="/staff/alerts" element={<Alerts />} />
              <Route path="/staff/profile" element={<Profile />} />
            </Route>
          </Route>

          {/* CLASS ADVISOR ROUTES */}
          <Route element={<ProtectedRoute allowedRoles={['CLASS_ADVISOR']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/advisor/dashboard" element={<Dashboard />} />
              <Route path="/advisor/timetable" element={<Timetable />} />
              <Route path="/advisor/period-attendance" element={<PeriodAttendance />} />
              <Route path="/advisor/attendance" element={<ClassAttendance />} />
              <Route path="/advisor/todays-attendance" element={<ClassAttendance />} />
              <Route path="/advisor/students" element={<Students />} />
              <Route path="/advisor/attendance-history" element={<AttendanceHistory />} />
              <Route path="/advisor/alerts" element={<Alerts />} />
              <Route path="/advisor/profile" element={<Profile />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;