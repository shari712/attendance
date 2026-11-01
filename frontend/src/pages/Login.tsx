import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

type LoginRole = 'STAFF' | 'CLASS_ADVISOR' | 'STUDENT';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<LoginRole>('STUDENT');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Check role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== selectedRole) {
        await supabase.auth.signOut();
        throw new Error(`Invalid role selection. You are registered as ${profile.role.replace('_', ' ')}.`);
      }

      // STRICT STUDENT LOGIN CHECK:
      // Must be enrolled by an authorized Class Advisor in the students directory
      if (profile.role === 'STUDENT') {
        const cleanEmail = email.trim().toLowerCase();
        const { data: studentRecord } = await supabase
          .from('students')
          .select('id, department, year, section, profile_id')
          .or(`profile_id.eq.${data.user.id},email.eq.${cleanEmail}`)
          .maybeSingle();

        if (!studentRecord) {
          await supabase.auth.signOut();
          throw new Error('Access denied. Your student account has not been enrolled by an authorized Class Advisor.');
        }

        // Link profile_id if not yet linked
        if (!studentRecord.profile_id) {
          await supabase
            .from('students')
            .update({ profile_id: data.user.id })
            .eq('id', studentRecord.id);
        }
      }

      // Navigate to respective dashboard or previous page
      if (from) {
        navigate(from, { replace: true });
      } else if (profile.role === 'STAFF') {
        navigate('/staff/dashboard', { replace: true });
      } else if (profile.role === 'CLASS_ADVISOR') {
        navigate('/advisor/dashboard', { replace: true });
      } else if (profile.role === 'STUDENT') {
        navigate('/student/dashboard', { replace: true });
      } else {
        navigate('/admin/dashboard', { replace: true });
      }

    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-6 text-center">
          <h2 className="text-3xl font-bold text-white">Smart Attendance</h2>
          <p className="text-blue-100 mt-2">Sign in to your account</p>
        </div>
        
        <div className="p-6">
          <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
            {(['STAFF', 'CLASS_ADVISOR', 'STUDENT'] as LoginRole[]).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "flex-1 text-xs font-semibold py-2 px-1 rounded-md transition-all",
                  selectedRole === role
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {role.replace('_', ' ')}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email / Register Number</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
