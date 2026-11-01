import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import {
  Loader2,
  ArrowLeft,
  Mail,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

const REGISTERED_ACCOUNTS = [
  { label: 'Class Advisor', email: 'advisor1@test.com' },
  { label: 'Student', email: 'student1@test.com' },
  { label: 'Staff / Teacher', email: 'staff1@test.com' },
];

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetLink(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your registered email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email format (e.g. user@example.com).');
      return;
    }

    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/reset-password`;

      // 1. Backend admin generate_link & mail dispatch (bypasses SMTP deliverability issues)
      try {
        const res = await api.publicPost('/auth/forgot-password', {
          email: cleanEmail,
          redirect_to: redirectUrl,
        });
        if (res && res.reset_link) {
          setResetLink(res.reset_link);
        }
      } catch (beErr) {
        console.warn('Backend forgot-password endpoint warning:', beErr);
      }

      // 2. Client-side Supabase mailer fallback
      try {
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl,
        });
      } catch (supErr: any) {
        console.warn('Supabase client reset error (expected if SMTP blocked):', supErr);
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Password reset unexpected error:', err);
      setError('Unable to process reset request at this moment. Please check your network or try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-blue-600 p-6 text-center">
          <h2 className="text-3xl font-bold text-white">Smart Attendance</h2>
          <p className="text-blue-100 mt-2">Reset your password</p>
        </div>

        <div className="p-6">
          {isSubmitted ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Reset Request Processed</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Password recovery initiated for <span className="font-semibold text-slate-800">{email}</span>.
              </p>

              {/* Direct Reset Action if Link Available */}
              {resetLink && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left space-y-3 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-sm">Instant Password Reset Link</span>
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Test email domains or free SMTP servers may delay or block delivery. You can immediately reset your password using this secure verified link:
                  </p>
                  <div className="space-y-2 pt-1">
                    <a
                      href={resetLink}
                      className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl font-semibold shadow-md transition-all text-sm"
                    >
                      <KeyRound size={16} />
                      <span>Open Reset Password Page</span>
                      <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-emerald-300 text-emerald-800 hover:bg-emerald-100/60 text-xs font-medium transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-emerald-600" />
                          <span>Copied to clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy Direct Reset Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Standard Email Notification Details */}
              <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 text-left space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Mail size={14} className="text-blue-600" />
                  <span>Email Status:</span>
                </p>
                <p className="text-slate-600">
                  If this email is linked to an external mailbox (like Gmail), an email with reset instructions has been dispatched. Please check your inbox and spam folder.
                </p>
              </div>

              <div className="pt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false);
                    setResetLink(null);
                    setError(null);
                  }}
                  className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-1 transition-colors"
                >
                  Try another email address
                </button>
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 bg-slate-800 text-white py-2.5 px-4 rounded-xl font-semibold hover:bg-slate-900 transition-colors shadow-md text-sm"
                >
                  <ArrowLeft size={16} />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed">
                Enter your registered account email address. We will send you a secure link to reset your password.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm pr-10"
                    placeholder="e.g. advisor1@test.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                </div>
              </div>

              {/* Quick Select Registered Accounts */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Quick Select Registered Accounts:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {REGISTERED_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => {
                        setEmail(acc.email);
                        setError(null);
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                        email === acc.email
                          ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-medium">{acc.label}:</span>{' '}
                      <span className="text-slate-500">{acc.email}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-70 disabled:cursor-not-allowed text-sm cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Generating Secure Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

