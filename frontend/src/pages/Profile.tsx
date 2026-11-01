import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Mail, 
  Camera, 
  Save, 
  CheckCircle2, 
  Building2, 
  Sparkles,
  Award
} from 'lucide-react';

interface ProfileData {
  id: string;
  name?: string;
  email: string;
  role: string;
  department?: string;
  year?: number;
  section?: string;
  register_number?: string;
  parent_name?: string;
  parent_mobile?: string;
  face_registration_status?: boolean;
}

const Profile: React.FC = () => {
  const { role, user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentMobile, setParentMobile] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const data = await api.get('/profile/');
        setProfile(data);
        if (data) {
          setName(data.name || '');
          setEmail(data.email || user?.email || '');
          setParentName(data.parent_name || '');
          setParentMobile(data.parent_mobile || '');
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await api.put('/profile/', {
        name,
        email: email.trim().toLowerCase(),
        parent_name: parentName,
        parent_mobile: parentMobile,
      });
      if (res && res.email) {
        setEmail(res.email);
        setProfile((prev) => (prev ? { ...prev, email: res.email, name } : null));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <span className="text-xs">Loading profile settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Account & Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          View your academic enrollment, biometric status, and account settings.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span>Profile and email updated successfully!</span>
        </div>
      )}

      {/* Hero Identity Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-500 text-white font-black text-3xl flex items-center justify-center shadow-xl border-2 border-white/20">
            {name ? name.charAt(0).toUpperCase() : 'U'}
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold">{name || 'Account User'}</h2>
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 capitalize w-fit mx-auto sm:mx-0">
                {role?.replace('_', ' ').toLowerCase()}
              </span>
            </div>

            <p className="text-slate-400 text-xs flex items-center justify-center sm:justify-start gap-1.5 font-mono">
              <Mail size={13} />
              <span>{email || profile?.email || user?.email}</span>
            </p>

            <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-center sm:justify-start gap-6 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-blue-400" />
                <span>{profile?.department || 'Computer Science & Engineering'}</span>
              </div>

              {profile?.register_number && (
                <div className="flex items-center gap-1.5">
                  <Award size={14} className="text-indigo-400" />
                  <span className="font-mono">Roll: {profile.register_number}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Biometric Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera size={18} className="text-blue-600" />
                <span>Facial Biometrics</span>
              </h3>
              <Sparkles size={16} className="text-amber-500" />
            </div>

            <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50/80 rounded-2xl border border-slate-100 mb-4 text-center">
              {profile?.face_registration_status ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 shadow-inner">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="text-sm font-bold text-slate-800">Face ID Verified</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Your biometric features are registered for automatic attendance.
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-2 shadow-inner">
                    <Camera size={28} />
                  </div>
                  <div className="text-sm font-bold text-slate-800">Face Pending</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Register portrait photo to enable automatic attendance.
                  </div>
                </>
              )}
            </div>

            <div className="text-[11px] text-slate-500 space-y-1.5 leading-relaxed">
              <p>• Accuracy: 99.2% on FaceNet LFW benchmark.</p>
              <p>• Embeddings are securely stored in PostgreSQL vector storage.</p>
            </div>
          </div>
        </div>

        {/* Profile Settings Form */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <User size={18} className="text-indigo-600" />
            <span>Account Details</span>
          </h3>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                  <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">Editable</span>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  placeholder="yourname@college.edu"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This email is used for account sign-in and password recovery.
                </p>
              </div>

              {role === 'STUDENT' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Parent / Guardian Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Sharma"
                      value={parentName}
                      onChange={(e) => setParentName(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Mobile Number</label>
                    <input
                      type="text"
                      placeholder="+91 9876543210"
                      value={parentMobile}
                      onChange={(e) => setParentMobile(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Save size={15} />
                <span>{isSaving ? 'Saving Changes...' : 'Save Profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
