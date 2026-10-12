import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import {
  Users,
  MessageSquare,
  Utensils,
  ThumbsUp,
  Calendar,
  Copy,
  Share2,
  LogOut,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  ChefHat,
  ShoppingBag,
  ArrowRight,
  Plus
} from 'lucide-react';
import { getInitials } from '../lib/utils';

export default function FamilyHome() {
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState('');
  const [expectedMembers, setExpectedMembers] = useState(4);
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchFamily();
  }, []);

  const fetchFamily = async () => {
    try {
      setLoading(true);
      const res = await api.get('/family/mine');
      const fam = res.data?.family || (Array.isArray(res.data) ? res.data[0] : null);
      setFamily(fam);
    } catch (error) {
      if (error.response?.status !== 404) {
        toast.error('Failed to load family data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    try {
      const res = await api.post('/family/create', {
        name: createName,
        expectedMembers: parseInt(expectedMembers) || 4
      });
      setFamily(res.data.family || res.data);
      updateUser({ role: 'maker' });
      toast.success('Family created successfully! 🏠');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create family');
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    navigate(`/join?code=${joinCode.trim().toUpperCase()}`);
  };

  const handleLeave = async () => {
    if (!window.confirm('Are you sure you want to leave this family group?')) return;
    try {
      await api.delete('/family/leave', { data: { familyId: family.id } });
      setFamily(null);
      toast.success('Left family group');
    } catch (error) {
      toast.error('Failed to leave family');
    }
  };

  const getInviteLink = () => {
    if (!family?.code) return '';
    return `${window.location.origin}/register?join=${family.code}`;
  };

  const copyCode = () => {
    if (!family?.code) return;
    navigator.clipboard.writeText(family.code);
    setCopiedCode(true);
    toast.success('Family join code copied!');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = () => {
    const link = getInviteLink();
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success('Direct family invite link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareWhatsApp = () => {
    const link = getInviteLink();
    const msg = `Join our family meal group "${family.name}" on FamilyPlate! We are voting on daily recipes and sharing food preferences: ${link} (Code: ${family.code})`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-500">Loading family data...</div>;
  }

  // ──────────────── IF NO FAMILY CREATED/JOINED YET ────────────────
  if (!family) {
    return (
      <div className="page-shell max-w-4xl space-y-8">
        <div className="page-heading text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-orange-100 text-primary-600 flex items-center justify-center mx-auto mb-2">
            <Users className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Bring your household together</h1>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            Plan meals, share food needs, and decide together what to cook. Start a family space or join one with an invite from someone you trust.
          </p>
        </div>

        <div className="grid max-w-2xl mx-auto gap-6 md:grid-cols-2">
          {/* Create Family Card */}
          <div className="card p-6 md:p-8 border rounded-2xl shadow-sm bg-white space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Start a family space</h2>
                <p className="text-sm text-gray-600">You can invite your household after setup.</p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">What should we call your group?</label>
                <input
                  type="text"
                  className="input w-full mt-1"
                  placeholder="e.g. The Rahman Family"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">How many people are in your household?</label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  className="input w-full mt-1"
                  value={expectedMembers}
                  onChange={(e) => setExpectedMembers(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                Create my family space <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <Link to="/onboarding/maker" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                  Set up your kitchen and preferences step by step
                </Link>
              </div>
            </form>
          </div>

          {/* Join Existing Family Card */}
          <div className="card p-6 md:p-8 border rounded-2xl shadow-sm bg-white space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Join your family</h2>
                <p className="text-sm text-gray-600">Ask a family member to share their private invite with you.</p>
              </div>
            </div>

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="label text-sm font-medium">Family Invite Code</label>
                <input
                  type="text"
                  className="input w-full mt-1 font-mono uppercase tracking-widest text-center text-lg"
                  placeholder="Paste the private invite code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  maxLength={32}
                  required
                />
              </div>

              <button type="submit" className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────── ACTIVE FAMILY VIEW ────────────────
  const isMaker = family?.creatorId === user?.id || family?.members?.some(member => member.userId === user?.id && member.role === 'maker');

  return (
    <div className="page-shell max-w-5xl space-y-7">
      {/* Family Header */}
      <div className="page-banner flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{family.name}</h1>
            <span className="text-sm font-semibold bg-primary-100 text-primary-900 px-3 py-1.5 rounded-full">
              {family.members?.length || 1} of {family.expectedMembers || 4} Members
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Your shared place for meal ideas, family choices, and kitchen planning.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isMaker && <button
            onClick={handleLeave}
            className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 font-medium py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Leave Family
          </button>}
        </div>
      </div>

      {/* ──────────────── SHARE & INVITE CARD ──────────────── */}
      {isMaker && <div className="card bg-primary-50 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-blue-950 text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Private Family Invite
            </h3>
            <p className="text-xs text-blue-700">
              Invite people you know. Your invite is private, so share it directly with your household.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-gray-600">Invite:</span>
            <button
              type="button"
              onClick={copyCode}
              className="font-mono font-bold text-base bg-white border border-blue-300 text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1.5 shadow-xs min-h-[44px]"
              aria-label="Copy private family invite code"
            >
              {copiedCode ? 'Copied' : family.code}
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <input
            type="text"
            readOnly
            value={getInviteLink()}
            className="input w-full bg-white text-sm font-mono py-2"
          />
          <div className="flex gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={copyInviteLink}
              className="btn-primary text-sm flex items-center justify-center gap-1.5 py-2 px-4 flex-1 sm:flex-none"
            >
              {copiedLink ? 'Invite copied' : 'Copy invite link'}
            </button>
            <button
              onClick={shareWhatsApp}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-colors flex-1 sm:flex-none min-h-[44px]"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share on WhatsApp
            </button>
          </div>
        </div>
      </div>}

      {/* ──────────────── FAMILY DIETARY & ALLERGY SHIELD ──────────────── */}
      {isMaker ? <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Food allergies and preferences</h3>
              <p className="text-sm text-gray-600">
                Recipe ideas use the needs your family members have added here.
              </p>
            </div>
          </div>
          <Link to="/profile" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
            Update My Allergies
          </Link>
        </div>

        {family.allergyShield && family.allergyShield.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {family.allergyShield.map((item, idx) => (
              <div
                key={idx}
                className="bg-red-50/70 border border-red-200 rounded-xl p-3 flex items-start gap-2.5"
              >
                <span className="text-red-500 text-base mt-0.5">⚠️</span>
                <div>
                  <h4 className="text-xs font-bold text-red-900">{item.allergen}</h4>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    Avoided for: <strong>{item.members.join(', ')}</strong>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>No severe household allergies registered yet. You can set them in Member Profiles anytime!</span>
          </div>
        )}
      </div> : <div className="rounded-2xl border border-primary-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-gray-900">Your food profile is private</h2><p className="mt-1 text-sm text-gray-600">Only you and your family meal planner can see your personal food needs. They help the planner avoid unsafe meal suggestions.</p><Link to="/profile" className="mt-3 inline-flex text-sm font-semibold text-primary-700 underline">Review my food profile</Link></div>}

      {/* ──────────────── 6-FEATURE ACTION GRID ──────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Daily Suggestions */}
        {isMaker && <Link
          to="/family/suggestions"
          className="card-hover p-6 flex flex-col items-center justify-center text-center space-y-2.5 group"
        >
          <div className="w-12 h-12 rounded-2xl bg-primary-800 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-900 text-sm">Meal ideas</span>
          <span className="text-sm text-gray-600">Based on your ingredients and food needs</span>
        </Link>}

        {/* Meal Voting */}
        <Link
          to="/family/voting"
          className="card-hover p-6 flex flex-col items-center justify-center text-center space-y-2.5 group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
            <ThumbsUp className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-900 text-sm">Choose a meal</span>
          <span className="text-sm text-gray-600">Pick what sounds good to you</span>
        </Link>

        {/* Family Chat */}
        <Link
          to="/family/chat"
          className="card-hover p-6 flex flex-col items-center justify-center text-center space-y-2.5 group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <MessageSquare className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-900 text-sm">Family chat</span>
          <span className="text-sm text-gray-600">Share ideas with your household</span>
        </Link>

        {/* Meal Requests */}
        <Link
          to="/family/requests"
          className="card-hover p-6 flex flex-col items-center justify-center text-center space-y-2.5 group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
            <Utensils className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-900 text-sm">Meal Requests</span>
          <span className="text-xs text-gray-500">Request your favorites</span>
        </Link>

        {/* Special Dinners & Events */}
        <Link
          to="/family/events"
          className="card-hover p-6 flex flex-col items-center justify-center text-center space-y-2.5 group"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center group-hover:bg-green-200 transition-colors">
            <Calendar className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-900 text-sm">{isMaker ? 'Plan a gathering' : 'Family gatherings'}</span>
          <span className="text-sm text-gray-600">{isMaker ? 'Plan Eid, dawat, and family meals' : 'Suggest dishes and vote on event menus'}</span>
        </Link>

        <Link
          to="/weekly-menu"
          className="card-hover p-6 flex flex-col items-center justify-center text-center space-y-2.5 group"
        >
          <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center"><Calendar className="w-6 h-6" /></div>
          <span className="font-bold text-gray-900 text-sm">Family meal plan</span>
          <span className="text-sm text-gray-600">{isMaker ? 'Add meals and start cooking' : 'See what the meal planner has planned'}</span>
        </Link>

        {/* Kitchen Inventory */}
        {isMaker && <Link
          to="/inventory"
          className="card-hover p-6 flex flex-col items-center justify-center text-center space-y-2.5 group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <span className="font-bold text-gray-900 text-sm">What’s in my kitchen</span>
          <span className="text-sm text-gray-600">Keep track of food at home</span>
        </Link>}
      </div>

      {/* ──────────────── FAMILY MEMBERS LIST ──────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          Family Members ({family.members?.length || 0})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {family.members?.map((member, idx) => (
            <div
              key={idx}
              className="p-4 border rounded-xl flex items-start gap-3 bg-gray-50/50 hover:bg-gray-50 transition-colors"
            >
              {member.user?.avatar ? (
                <img
                  src={member.user.avatar}
                  alt={member.user.name}
                  className="w-12 h-12 rounded-full object-cover border"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-base shrink-0">
                  {getInitials(member.user?.name || 'User')}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm truncate">
                    {member.user?.name}
                  </span>
                  {member.user?.id === user?.id && (
                    <span className="text-[10px] text-gray-400 font-normal">(You)</span>
                  )}
                </div>

                <span className="text-[11px] font-medium text-orange-700 bg-orange-100/70 px-1.5 py-0.2 rounded inline-block mt-0.5">
                  {member.role === 'maker'
                    ? 'Family meal planner'
                    : 'Family member'}
                </span>

                {/* Member allergies chip */}
                {(isMaker || member.user?.id === user?.id) && member.user?.allergies && member.user.allergies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {member.user.allergies.map((a, aIdx) => (
                      <span
                        key={aIdx}
                        className="text-[10px] font-semibold text-red-700 bg-red-100/80 px-1.5 py-0.2 rounded"
                      >
                        Allergy: {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
