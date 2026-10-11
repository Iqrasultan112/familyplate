import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import {
  Utensils, CalendarDays, MessageSquare, ArrowLeft,
  Clock, CheckCircle2, XCircle, PlusCircle, Users
} from 'lucide-react';

export default function MealRequests() {
  const [requests, setRequests]             = useState([]);
  const [family, setFamily]                 = useState(null);
  const [loading, setLoading]               = useState(true);
  const [mealName, setMealName]             = useState('');
  const [requestedDate, setRequestedDate]   = useState('');
  const [message, setMessage]               = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const isMaker = family?.creatorId === user?.id || family?.members?.some(member => member.userId === user?.id && member.role === 'maker');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const famRes = await api.get('/family/mine');
      if (!famRes.data.family) { toast.error('Not in a family group'); navigate('/family'); return; }
      setFamily(famRes.data.family);
      const reqRes = await api.get(`/mealRequests/family/${famRes.data.family.id}`);
      setRequests(reqRes.data || []);
    } catch { toast.error('Failed to load meal requests'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!mealName.trim() || !requestedDate) return;
    setSubmitting(true);
    try {
      const res = await api.post('/mealRequests', { mealName, requestedDate, message, familyId: family.id });
      setRequests([res.data, ...requests]);
      setMealName(''); setRequestedDate(''); setMessage('');
      toast.success('Meal request submitted');
    } catch (err) { toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to submit request'); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await api.patch(`/mealRequests/${id}/status`, { status: newStatus });
      setRequests(requests.map(r => r.id === id ? { ...r, status: res.data.status } : r));
      toast.success(`Request ${newStatus}`);
    } catch { toast.error('Failed to update status'); }
  };

  const statusConfig = {
    pending:        { label: 'Pending',    cls: 'badge-yellow', Icon: Clock        },
    approved:       { label: 'Approved',   cls: 'badge-green',  Icon: CheckCircle2 },
    rejected:       { label: 'Declined',   cls: 'badge-red',    Icon: XCircle      },
    'added-to-menu':{ label: 'On Menu',    cls: 'badge-indigo', Icon: CheckCircle2 },
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="page-shell max-w-5xl space-y-6">

      {/* Header */}
      <div className="page-heading flex items-center gap-3">
        <Link to="/family" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="page-title">Meal Requests</h1>
          <p className="page-subtitle">Request your favorite meals to the family kitchen</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">

        {/* Form */}
        <div className="md:col-span-1">
          <div className="card p-5 sticky top-20">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <PlusCircle className="w-3.5 h-3.5 text-primary-500" /> New Request
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Meal Name</label>
                <input type="text" className="input" required
                  placeholder="e.g. Biryani, Pasta, Karahi"
                  value={mealName} onChange={e => setMealName(e.target.value)} />
              </div>
              <div>
                <label className="label">Requested For</label>
                <input type="date" className="input" required
                  value={requestedDate} onChange={e => setRequestedDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Note <span className="normal-case font-normal text-slate-400">(optional)</span></label>
                <textarea className="input min-h-[80px] resize-none"
                  placeholder="Spice level, dietary needs, special instructions…"
                  value={message} onChange={e => setMessage(e.target.value)} />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
                {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Utensils className="w-4 h-4" />}
                Submit Request
              </button>
            </form>
          </div>
        </div>

        {/* Requests list */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Family Requests
            </p>
            <span className="badge-slate text-[10px] ml-1">{requests.length}</span>
          </div>

          {requests.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-6 h-6 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700">No meal requests yet</p>
              <p className="text-sm text-slate-400 mt-1">Use the form to request your first meal</p>
            </div>
          ) : requests.map(req => {
            const cfg  = statusConfig[req.status] || statusConfig.pending;
            const Icon = cfg.Icon;
            return (
              <div key={req.id} className="card overflow-hidden hover:shadow-card-hover transition-all">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
                        {req.user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{req.mealName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">by {req.user?.name || 'Someone'}</p>
                      </div>
                    </div>
                    <span className={`${cfg.cls} flex items-center gap-1 shrink-0`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Requested for {new Date(req.requestedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </div>

                  {req.message && (
                    <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 text-xs text-slate-600 mb-3">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                      {req.message}
                    </div>
                  )}

                  {req.status === 'pending' && isMaker && (
                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                      <button onClick={() => handleStatusChange(req.id, 'approved')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => handleStatusChange(req.id, 'rejected')}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors">
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
