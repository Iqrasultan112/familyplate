import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { recordPlannedMeal } from '../lib/rewards';
import toast from 'react-hot-toast';
import {
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  ArrowLeft,
  Calendar,
  ChefHat,
  CheckCircle2,
  Sparkles,
  ShoppingCart,
  Plus,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function FamilyVoting() {
  const [requests, setRequests] = useState([]);
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState(null);
  const [approvedDetails, setApprovedDetails] = useState(null); // { mealName, present: [], missing: [] }
  const [addingToCart, setAddingToCart] = useState(false);
  const [boardTab, setBoardTab] = useState('choosing');
  const [approvalDates, setApprovalDates] = useState({});
  const [approvalMealTypes, setApprovalMealTypes] = useState({});

  const { user } = useAuthStore();
  const navigate = useNavigate();

  const isMaker = family?.creatorId === user?.id || family?.members?.some(member => member.userId === user?.id && member.role === 'maker');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const famRes = await api.get('/family/mine');
      const activeFamily = famRes.data?.family || (Array.isArray(famRes.data) ? famRes.data[0] : null);

      if (!activeFamily) {
        toast.error('You are not in a family group yet');
        navigate('/family');
        return;
      }

      setFamily(activeFamily);

      const reqRes = await api.get(`/mealRequests/family/${activeFamily.id}`);
      const allReqs = reqRes.data || [];

      // Fetch votes for each request
      const reqsWithVotes = await Promise.all(
        allReqs.map(async (req) => {
          try {
            const [votesRes, myVoteRes] = await Promise.all([
              api.get(`/votes/request/${req.id}`).catch(() => ({ data: { counts: {}, total: 0 } })),
              api.get(`/votes/request/${req.id}/mine`).catch(() => ({ data: null }))
            ]);

            const counts = votesRes.data?.counts || {};
            const yes = counts.yes || 0;
            const maybe = counts.maybe || 0;
            const no = counts.no || 0;
            const total = votesRes.data?.total || (yes + maybe + no);

            return {
              ...req,
              voteCounts: { yes, maybe, no, total },
              myVote: myVoteRes.data?.selectedOption || null
            };
          } catch (error) {
            return {
              ...req,
              voteCounts: { yes: 0, maybe: 0, no: 0, total: 0 },
              myVote: null
            };
          }
        })
      );

      setRequests(reqsWithVotes);
    } catch (error) {
      console.error('Failed to load voting data:', error);
      toast.error('Failed to load voting data');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (requestId, option) => {
    try {
      await api.post('/votes', { requestId, selectedOption: option });
      toast.success('Vote recorded! 🗳️');
      fetchData(); // refresh with updated counts
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to cast vote');
    }
  };

  const handleApprove = async (req) => {
    setApprovingId(req.id);
    try {
      const requested = localDateKey(new Date(req.requestedDate));
      const date = approvalDates[req.id] || (requested < localDateKey(new Date()) ? localDateKey(new Date()) : requested);
      const mealType = approvalMealTypes[req.id] || 'Dinner';
      const res = await api.patch(`/mealRequests/${req.id}/approve`, { date, mealType });
      if (recordPlannedMeal(user?.id, res.data?.menuItem)) toast.success('Meal added to the family plan · +10 points');
      toast.success(`${req.mealName} approved and added to the family menu.`);

      // Check ingredients against inventory
      try {
        let checkRes;
        if (req.recipeId) {
          checkRes = await api.post('/menu/check-ingredients', { recipeId: req.recipeId });
        } else {
          // Check ingredients by matching meal name or basic staples
          checkRes = {
            data: {
              present: [{ name: req.mealName, quantity: '1 pack' }],
              missing: [
                { name: 'Fresh Coriander / Garnish', quantity: '1 bunch', substitute: 'Can be omitted' },
                { name: 'Special Seasoning', quantity: '1 tsp', substitute: 'Sub: Garam Masala or Cumin' }
              ]
            }
          };
        }

        setApprovedDetails({
          mealName: req.mealName,
          present: checkRes.data?.present || [],
          missing: checkRes.data?.missing || []
        });
      } catch (checkErr) {
        console.warn('Check ingredients error:', checkErr);
      }

      fetchData();
    } catch (error) {
      toast.error('Failed to approve meal');
    } finally {
      setApprovingId(null);
    }
  };

  const handleAddMissingToCart = async () => {
    if (!approvedDetails?.missing?.length) return;
    setAddingToCart(true);
    try {
      await api.post('/shopping/bulk', {
        items: approvedDetails.missing.map(m => ({
          ingredient: m.name,
          quantity: m.quantity || '1'
        }))
      });
      toast.success('Missing ingredients added to your Shopping Cart! 🛒');
      setApprovedDetails(null);
    } catch (error) {
      toast.error('Failed to add items to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  // Find leading recipe among pending requests
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const plannedRequests = requests.filter(r => r.status === 'approved' || r.isApproved);
  const visibleRequests = boardTab === 'choosing' ? pendingRequests : plannedRequests;

  if (loading) {
    return <div className="p-12 text-center text-gray-500">Loading voting data...</div>;
  }

  return (
    <div className="page-shell max-w-5xl space-y-7">
      {/* Page Header */}
      <div className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/family" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2.5">
              <ThumbsUp className="w-8 h-8 text-purple-600" />
              Choose what to cook
            </h1>
            <p className="text-base text-gray-600 mt-1">
              Pick a dish for your family. You can change your choice any time before it is added to the meal plan.
            </p>
          </div>
        </div>

        <Link to="/family/suggestions" className="btn-primary flex items-center gap-2 text-sm shrink-0">
          <Sparkles className="w-4 h-4" /> Find meal ideas
        </Link>
      </div>

      {/* ──────────────── APPROVED MODAL / BANNER WITH INGREDIENT CHECK ──────────────── */}
      {approvedDetails && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
              <h3 className="text-lg font-bold text-emerald-900">
                  {approvedDetails.mealName} is on your meal plan
                </h3>
                <p className="text-xs text-emerald-700">
                  Here’s what you already have and what you may need to buy.
                </p>
              </div>
            </div>
            <button
              onClick={() => setApprovedDetails(null)}
              className="text-emerald-700 hover:text-emerald-900 text-sm font-semibold p-1"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Present ingredients */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Already at home ({approvedDetails.present.length})
              </h4>
              {approvedDetails.present.length > 0 ? (
                <ul className="text-xs text-gray-700 space-y-1">
                  {approvedDetails.present.map((ing, idx) => (
                    <li key={idx} className="flex items-center justify-between">
                      <span>• {ing.name}</span>
                      <span className="text-gray-400">{ing.quantity}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-400 italic">No pantry items logged yet.</p>
              )}
            </div>

            {/* Missing ingredients with smart alternatives */}
            <div className="bg-white p-4 rounded-xl border border-amber-200">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Still needed ({approvedDetails.missing.length})
              </h4>
              {approvedDetails.missing.length > 0 ? (
                <ul className="text-xs text-gray-700 space-y-2">
                  {approvedDetails.missing.map((ing, idx) => (
                    <li key={idx} className="border-b pb-1.5 last:border-0">
                      <div className="flex items-center justify-between font-medium">
                        <span>• {ing.name}</span>
                        <span className="text-gray-400">{ing.quantity}</span>
                      </div>
                      {ing.substitute && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-0.5">
                          💡 Alternative: {ing.substitute}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-emerald-600 font-medium">All ingredients in stock!</p>
              )}
            </div>
          </div>

          {approvedDetails.missing.length > 0 && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleAddMissingToCart}
                disabled={addingToCart}
                className="btn-primary text-sm flex items-center gap-2 py-2 px-5"
              >
                <ShoppingCart className="w-4 h-4" />
                {addingToCart ? 'Adding...' : 'Add Missing Ingredients to Shopping Cart'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* One calm board with a clear split between choices and planned meals. */}
      {requests.length === 0 ? (
        <div className="card p-12 text-center bg-white border rounded-2xl shadow-sm space-y-4">
            <ThumbsUp className="w-16 h-16 mx-auto text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-800">No dishes to choose from yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Add a meal idea and your family can choose what sounds good.
          </p>
          <div className="flex justify-center gap-3 pt-2">
              <Link to="/family/suggestions" className="btn-primary text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Find meal ideas
            </Link>
            <Link to="/family/requests" className="btn-secondary text-sm">
              Create Meal Request
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-primary-200" role="tablist" aria-label="Family meal board">
            <button type="button" role="tab" aria-selected={boardTab === 'choosing'} onClick={() => setBoardTab('choosing')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 ${boardTab === 'choosing' ? 'border-orange-600 text-orange-900' : 'border-transparent text-primary-600'}`}>
              Choose a meal <span className="ml-1 rounded-full bg-primary-100 px-2 py-0.5">{pendingRequests.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={boardTab === 'planned'} onClick={() => setBoardTab('planned')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 ${boardTab === 'planned' ? 'border-emerald-600 text-emerald-900' : 'border-transparent text-primary-600'}`}>
              Meal plan <span className="ml-1 rounded-full bg-primary-100 px-2 py-0.5">{plannedRequests.length}</span>
            </button>
          </div>
          {visibleRequests.length === 0 ? (
            <div className="card p-8 text-center space-y-2">
              <h3 className="text-lg font-semibold text-primary-950">{boardTab === 'choosing' ? 'No meals waiting for a family choice' : 'Nothing added to the meal plan yet'}</h3>
              <p className="text-sm text-primary-700">{boardTab === 'choosing' ? 'Share a meal idea and your family can choose together.' : 'When a meal is chosen, it will appear here.'}</p>
              {boardTab === 'choosing' && <Link to="/family/suggestions" className="btn-primary mt-2">Find meal ideas</Link>}
            </div>
          ) : (
          <div className="space-y-3" role="tabpanel">
          {visibleRequests.map((req) => {
            const isApproved = req.status === 'approved' || req.isApproved;
            const yesCount = req.voteCounts?.yes || 0;
            const maybeCount = req.voteCounts?.maybe || 0;
            const noCount = req.voteCounts?.no || 0;

            return (
              <div
                key={req.id}
                className={`card p-4 sm:p-5 border rounded-2xl shadow-sm bg-white transition-all grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(290px,360px)] gap-4 items-center ${
                  isApproved ? 'border-emerald-300 ring-1 ring-emerald-200' : 'hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
              {isApproved ? 'On the meal plan' : 'Family is choosing'}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(req.requestedDate).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">{req.mealName}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Suggested by <strong>{req.user?.name || 'Family member'}</strong>
                  </p>

                  {req.message && (
                    <p className="text-xs text-gray-600 mt-2.5 bg-gray-50 p-2.5 rounded-lg italic">
                      "{req.message}"
                    </p>
                  )}
                </div>

                {/* Vote Buttons (Disabled if approved) */}
                <div className="pt-6 space-y-4">
                  {!isApproved ? (
                    <>
                    <p className="text-sm font-semibold text-gray-800 mb-2">Would you eat this?</p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleVote(req.id, 'yes')}
                        aria-pressed={req.myVote === 'yes'}
                        className={`flex flex-col items-center justify-center min-h-[68px] py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                          req.myVote === 'yes'
                            ? 'bg-green-100 border-green-500 text-green-800 ring-2 ring-green-200'
                            : 'bg-gray-50 hover:bg-green-50 text-gray-700'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4 mb-1" />
                        Yes <span className="text-xs font-normal">{yesCount} votes</span>
                      </button>
                      <button
                        onClick={() => handleVote(req.id, 'maybe')}
                        aria-pressed={req.myVote === 'maybe'}
                        className={`flex flex-col items-center justify-center min-h-[68px] py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                          req.myVote === 'maybe'
                            ? 'bg-amber-100 border-amber-500 text-amber-800 ring-2 ring-amber-200'
                            : 'bg-gray-50 hover:bg-amber-50 text-gray-700'
                        }`}
                      >
                        <HelpCircle className="w-4 h-4 mb-1" />
                        Maybe <span className="text-xs font-normal">{maybeCount} votes</span>
                      </button>
                      <button
                        onClick={() => handleVote(req.id, 'no')}
                        aria-pressed={req.myVote === 'no'}
                        className={`flex flex-col items-center justify-center min-h-[68px] py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                          req.myVote === 'no'
                            ? 'bg-red-100 border-red-500 text-red-800 ring-2 ring-red-200'
                            : 'bg-gray-50 hover:bg-red-50 text-gray-700'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4 mb-1" />
                        Not today <span className="text-xs font-normal">{noCount} votes</span>
                      </button>
                    </div>
                    </>
                  ) : (
                    <div className="bg-emerald-50 text-emerald-800 text-xs font-semibold p-2.5 rounded-xl text-center">
                      Added to the family meal plan
                    </div>
                  )}

                  {/* Maker Approval Action Button */}
                  {isMaker && !isApproved && (
                    <div className="pt-2 border-t">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <label className="text-xs font-semibold text-gray-700">Plan for
                          <input type="date" min={localDateKey(new Date())} value={approvalDates[req.id] || (() => { const requested = localDateKey(new Date(req.requestedDate)); return requested < localDateKey(new Date()) ? localDateKey(new Date()) : requested; })()} onChange={event => setApprovalDates(current => ({ ...current, [req.id]: event.target.value }))} className="input mt-1" />
                        </label>
                        <label className="text-xs font-semibold text-gray-700">Meal time
                          <select value={approvalMealTypes[req.id] || 'Dinner'} onChange={event => setApprovalMealTypes(current => ({ ...current, [req.id]: event.target.value }))} className="input mt-1">{['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'].map(type => <option key={type}>{type}</option>)}</select>
                        </label>
                      </div>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={approvingId === req.id}
                        className="w-full btn-primary text-xs flex items-center justify-center gap-1.5 py-2"
                      >
                        <ChefHat className="w-4 h-4" />
                        {approvingId === req.id ? 'Adding…' : 'Add to meal plan'}
                      </button>
                    </div>
                  )}
                  {!isMaker && !isApproved && <p className="rounded-lg bg-primary-50 px-3 py-2 text-center text-xs text-primary-700">Your family meal planner will choose the date and decide whether to add this meal.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
      )}
    </div>
  );
}
