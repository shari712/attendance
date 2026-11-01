import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Plus, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2,
  Clock
} from 'lucide-react';

interface AlertItem {
  id: string;
  title: string;
  description?: string;
  is_read: boolean;
  created_at: string;
}

const Alerts: React.FC = () => {
  const { role } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNREAD'>('ALL');

  // Modal for new alert
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await api.get('/alerts/');
      setAlerts(data || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const filteredAlerts = useMemo(() => {
    if (filterMode === 'UNREAD') {
      return alerts.filter((a) => !a.is_read);
    }
    return alerts;
  }, [alerts, filterMode]);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/alerts/${id}/read`, {});
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, is_read: true } : a)));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await api.delete(`/alerts/${id}`);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert('Failed to delete alert.');
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmitting(true);
    try {
      await api.post('/alerts/', {
        title: newTitle,
        description: newDesc,
      });
      await fetchAlerts();
      setIsModalOpen(false);
      setNewTitle('');
      setNewDesc('');
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Alerts & Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                {unreadCount} Unread
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time biometric notifications, attendance warnings, and administrative broadcasts.
          </p>
        </div>

        {(role === 'CLASS_ADVISOR' || role === 'STAFF') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus size={16} />
            <span>Create Notice</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterMode === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Notifications ({alerts.length})
          </button>
          <button
            onClick={() => setFilterMode('UNREAD')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterMode === 'UNREAD'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Unread Only ({unreadCount})
          </button>
        </div>
      </div>

      {/* Alerts Stream */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <span className="text-xs text-slate-500">Loading alerts...</span>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
          <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-2" />
          <h3 className="font-bold text-slate-800 text-sm">All Caught Up!</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You have no unread notifications or security alerts at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition-all flex items-start justify-between gap-4 ${
                !alert.is_read ? 'border-blue-200 bg-blue-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    alert.title.toLowerCase().includes('warning') || alert.title.toLowerCase().includes('defaulter')
                      ? 'bg-red-50 text-red-600'
                      : alert.title.toLowerCase().includes('biometric') || alert.title.toLowerCase().includes('facial')
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'bg-blue-50 text-blue-600'
                  }`}
                >
                  {alert.title.toLowerCase().includes('warning') ? (
                    <AlertTriangle size={20} />
                  ) : alert.title.toLowerCase().includes('biometric') ? (
                    <ShieldAlert size={20} />
                  ) : (
                    <Bell size={20} />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{alert.title}</h4>
                    {!alert.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" title="Unread"></span>
                    )}
                  </div>
                  {alert.description && (
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{alert.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-2">
                    <Clock size={11} />
                    <span>{new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!alert.is_read && (
                  <button
                    onClick={() => markAsRead(alert.id)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Mark as read"
                  >
                    <CheckCheck size={16} />
                  </button>
                )}
                <button
                  onClick={() => deleteAlert(alert.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete notification"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Alert Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Broadcast Notice</h3>
                <p className="text-xs text-slate-500 mt-0.5">Send notification alert to students.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Change or Attendance Reminder"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notice Details</label>
                <textarea
                  rows={3}
                  placeholder="Provide clear message instructions..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? 'Broadcasting...' : 'Broadcast Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
