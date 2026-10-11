import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { Users, ShieldAlert, UtensilsCrossed, ArrowRight, CheckCircle2, Home } from 'lucide-react';

const COMMON_ALLERGIES = [
  'Peanuts', 'Tree Nuts', 'Dairy / Lactose', 'Gluten / Wheat',
  'Shellfish', 'Fish', 'Eggs', 'Soy', 'Sesame'
];

const COMMON_DIETARY = [
  'Halal', 'Vegetarian', 'Vegan', 'High Protein', 'Low Carb',
  'Dairy-Free', 'Gluten-Free'
];

export default function MemberJoin() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || searchParams.get('join') || '';

  const [code, setCode] = useState(initialCode.toUpperCase());
  const [familyDetails, setFamilyDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [selectedDietary, setSelectedDietary] = useState([]);
  const [favoriteFoods, setFavoriteFoods] = useState('');
  const [dislikes, setDislikes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { user, checkAuth } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (code.length < 6) {
      setFamilyDetails(null);
      setLoadingDetails(false);
      return undefined;
    }
    setLoadingDetails(true);
    const timer = setTimeout(() => lookupFamily(code), 350);
    return () => clearTimeout(timer);
  }, [code]);

  const lookupFamily = async (famCode) => {
    if (!famCode || famCode.length < 6) return;
    setLoadingDetails(true);
    try {
      const res = await api.get(`/family/details/${famCode}`);
      setFamilyDetails(res.data);
    } catch (error) {
      setFamilyDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCodeChange = (e) => {
    const val = e.target.value.toUpperCase();
    setCode(val);
  };

  const toggleAllergy = (allergy) => {
    setSelectedAllergies(prev =>
      prev.includes(allergy) ? prev.filter(a => a !== allergy) : [...prev, allergy]
    );
  };

  const toggleDietary = (pref) => {
    setSelectedDietary(prev =>
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    );
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      toast.error('Please enter a valid family invite code');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/family/join', {
        code,
        allergies: selectedAllergies,
        dietaryPreferences: [...selectedDietary, ...(favoriteFoods.trim() ? [`Favorite foods: ${favoriteFoods.trim().slice(0, 200)}`] : [])],
        dislikes
      });

      if (checkAuth) checkAuth();
      toast.success('Joined family group successfully! 🎉');
      navigate('/family');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to join family');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-shell max-w-2xl py-8 space-y-6">
      <div className="page-heading text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2">
          <Users className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Join your family space</h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Add your invite and food needs so meal ideas work for you, too.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3" aria-label="Join steps">
        <div className="rounded-xl border border-orange-300 bg-orange-50 p-3 text-sm font-semibold text-orange-900">1. Find your family</div>
        <div className="rounded-xl border border-primary-200 bg-white p-3 text-sm font-medium text-primary-700">2. Add food needs</div>
      </div>

      <form onSubmit={handleJoin} className="card p-6 md:p-8 bg-white border rounded-2xl shadow-sm space-y-6">
        {/* Step 1: Invite Code Input */}
        <div>
          <label className="label">
            Invite from your family member
          </label>
          <input
            type="text"
            required
            maxLength={32}
            placeholder="Paste the invite here"
            className="input mt-1 font-mono uppercase text-lg tracking-widest text-center"
            value={code}
            onChange={handleCodeChange}
          />
          <p aria-live="polite" className="mt-2 text-sm text-gray-600">
            {loadingDetails ? 'Checking this invite…' : familyDetails ? `Invite found: ${familyDetails.name}` : code.length >= 6 ? 'We couldn’t find a family with that invite. Check the characters and try again.' : 'Paste the private invite shared by your family member.'}
          </p>
        </div>

        {/* Family Preview Badge */}
        {familyDetails && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3 animate-fadeIn">
            <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0" />
            <div>
              <p className="font-semibold text-blue-900 text-base">
                You’re joining {familyDetails.name}
              </p>
              <p className="text-xs text-blue-700">
                Created by {familyDetails.creatorName} • Currently {familyDetails.currentMembers} members
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Allergies & Intolerances */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <label className="label flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              What foods must you avoid?
            </label>
            <p className="text-sm text-gray-600">
              Select every allergy or intolerance that applies. Family meal ideas will use this information.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {COMMON_ALLERGIES.map((allergy) => {
              const selected = selectedAllergies.includes(allergy);
              return (
                <button
                  key={allergy}
                  type="button"
                  onClick={() => toggleAllergy(allergy)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selected
                      ? 'bg-red-50 border-red-400 text-red-700 font-semibold shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {selected ? `✓ ${allergy}` : `+ ${allergy}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Dietary Preferences */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <label className="label font-medium text-gray-800 flex items-center gap-1.5">
            <UtensilsCrossed className="w-4 h-4 text-primary-500" />
            How do you like to eat?
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {COMMON_DIETARY.map((diet) => {
              const selected = selectedDietary.includes(diet);
              return (
                <button
                  key={diet}
                  type="button"
                  onClick={() => toggleDietary(diet)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selected
                      ? 'bg-primary-50 border-primary-400 text-primary-700 font-semibold shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {selected ? `✓ ${diet}` : `+ ${diet}`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1 pt-2 border-t border-gray-100">
          <label className="label font-medium text-gray-700" htmlFor="favoriteFoods">Foods or flavours you love (Optional)</label>
          <input id="favoriteFoods" type="text" maxLength={200} placeholder="e.g. chicken, biryani, mild spice, spinach" className="input w-full text-sm" value={favoriteFoods} onChange={e => setFavoriteFoods(e.target.value)} />
        </div>

        {/* Dislikes */}
        <div className="space-y-1 pt-2 border-t border-gray-100">
          <label className="label font-medium text-gray-700">
            Any foods you don’t enjoy? (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. seafood, bitter gourd, very spicy food"
            className="input w-full text-sm"
            value={dislikes}
            onChange={(e) => setDislikes(e.target.value)}
          />
        </div>

        <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <Home className="w-4 h-4" /> Go to Dashboard
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full sm:w-auto py-2.5 px-6 flex items-center justify-center gap-2 text-base"
          >
            {submitting ? 'Joining…' : 'Join my family'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
