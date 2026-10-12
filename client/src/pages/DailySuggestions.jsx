import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { addMissingRecipeIngredients } from '../lib/addMissingRecipeIngredients';
import RecipePhoto from '../components/RecipePhoto';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import {
  Sparkles,
  Vote,
  Clock,
  Users,
  ShieldCheck,
  ShoppingBag,
  RefreshCw,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  MessageCircle
} from 'lucide-react';

export default function DailySuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHousehold, setLoadingHousehold] = useState(true);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [servings, setServings] = useState(4);
  const [occasion, setOccasion] = useState('everyday');
  const [sendingId, setSendingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [sentPolls, setSentPolls] = useState({});
  const [seenRecipeNames, setSeenRecipeNames] = useState([]);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const { user } = useAuthStore();

  useEffect(() => {
    loadHousehold();
  }, []);

  const loadHousehold = async () => {
    setLoadingHousehold(true);
    try {
      const [invRes, famRes] = await Promise.all([
        api.get('/inventory').catch(() => ({ data: [] })),
        api.get('/family/mine').catch(() => ({ data: null }))
      ]);

      const currentInv = invRes.data || [];
      const currentFam = famRes.data?.family || (famRes.data?.id ? famRes.data : null);

      setInventory(currentInv);
      setFamily(currentFam);
    } catch (error) {
      console.error('Error loading meal planning context:', error);
      toast.error('Could not load your kitchen and family details');
    } finally {
      setLoadingHousehold(false);
    }
  };

  const fetchInitialDataAndSuggest = async () => {
    setLoading(true);
    setHasGenerated(true);
    setAiUnavailable(false);
    setSuggestions([]);
    setExpandedId(null);
    try {
      const currentInv = inventory;
      const currentFam = family;

      // The server reads the family's actual pantry and private food needs itself.
      const suggestRes = await api.post('/ai/suggest-recipes', {
        familyId: currentFam?.id,
        servings,
        occasion,
        excludeNames: seenRecipeNames
      });
      const nextSuggestions = suggestRes.data?.recipes || [];
      setAiUnavailable(Boolean(suggestRes.data?.aiUnavailable));
      const nextNames = nextSuggestions.map(recipe => recipe.name).filter(Boolean);
      setSuggestions(nextSuggestions);
      setSeenRecipeNames(previous => suggestRes.data?.cycled
        ? nextNames
        : [...new Set([...previous, ...nextNames])]);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast.error('Failed to generate daily suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToVote = async (recipe) => {
    setSendingId(recipe.name);
    try {
      // 1. First ensure recipe is in Recipe table if not already
      let recipeId = null;
      try {
        const recRes = await api.post('/recipes', {
          name: recipe.name,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          image: recipe.image || null,
          sourceUrl: recipe.sourceUrl,
          nutrition: recipe.nutrition
        });
        recipeId = recRes.data.id;
      } catch (e) {
        throw new Error('Could not save this recipe for your family');
      }

      if (family?.id) {
        await api.post('/mealRequests', {
          mealName: recipe.name,
          recipeId,
          familyId: family.id,
          requestedDate: new Date().toISOString(),
          message: `For ${recipe.servings || servings} people · ${recipe.matchPercentage || 0}% of ingredients are already at home.`
        });
        toast.success(`Sent "${recipe.name}" to family for voting! 🗳️`);
      } else {
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        await api.post('/weeklyMenu', {
          recipeId,
          date,
          mealType: recipe.category === 'Lunch' ? 'Lunch' : 'Dinner',
          servings: recipe.servings || servings
        });
        const addedCount = await addMissingRecipeIngredients(recipeId).catch(() => 0);
        toast.success(addedCount ? `Added to today's plan and ${addedCount} missing ingredients to your shopping list.` : 'Added to today’s personal meal plan.');
      }

      setSentPolls(prev => ({ ...prev, [recipe.name]: true }));
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Could not add this meal to your plan');
    } finally {
      setSendingId(null);
    }
  };

  const handleAddMissingToCart = async (ingredients) => {
    const missing = ingredients.filter(i => !i.inPantry);
    if (missing.length === 0) {
      toast.success('All ingredients already in your pantry!');
      return;
    }

    try {
      await api.post('/shopping/bulk', {
        items: missing.map(m => ({ ingredient: m.name, quantity: m.quantity || '1' }))
      });
      toast.success(`Added ${missing.length} missing items to Shopping Cart! 🛒`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not add ingredients to your shopping list');
    }
  };

  return (
    <div className="page-shell space-y-5">
      {/* Header Banner */}
      <section className="page-banner bg-[#FFF0E6]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-900 text-sm font-semibold px-3 py-2 rounded-full mb-3">
            <Sparkles className="w-4 h-4" /> Plan a meal together
          </div>
          <h1 className="page-title">What should we cook?</h1>
          <p className="page-subtitle max-w-2xl">
            First choose the occasion and how many people are eating. Then we’ll find a few ideas using food you have.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to="/family/voting"
            className="btn-secondary"
          >
            <Vote className="w-4 h-4" /> Family meal board
          </Link>
          <Link to="/family/meal-chat" className="btn-primary">
            <MessageCircle className="w-4 h-4" /> Chat about meals
          </Link>
          {(!family?.id || user?.role === 'maker') && <Link
            to="/inventory"
            className="btn-secondary sm:ml-auto"
          >
            <ShoppingBag className="w-4 h-4" /> My ingredients ({inventory.length})
          </Link>}
        </div>
      </section>

      <section className="card p-4 sm:p-5 space-y-4" aria-labelledby="meal-setup-title">
        <div>
            <p className="text-sm font-bold text-primary-700">STEP 1</p>
          <h2 id="meal-setup-title" className="text-xl font-bold text-primary-950 mt-1">Set up this meal</h2>
          <p className="text-sm text-primary-700 mt-1">You can change these choices and look again any time.</p>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-primary-900 mb-2">What are we planning?</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['everyday', 'Everyday meal'],
              ['weekend', 'Weekend'],
              ['guests', 'Guests coming'],
              ['celebration', 'Celebration'],
              ['eid', 'Eid'],
              ['birthday', 'Birthday'],
              ['dawat', 'Dawat']
            ].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={occasion === value} onClick={() => { setOccasion(value); setSeenRecipeNames([]); }}
                className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${occasion === value ? 'border-primary-600 bg-primary-100 text-primary-950 ring-2 ring-primary-200' : 'border-primary-200 bg-white text-primary-800 hover:bg-primary-50'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label htmlFor="meal-servings" className="block text-sm font-semibold text-primary-900 mb-2">How many people are eating?</label>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="One fewer person" onClick={() => { setSeenRecipeNames([]); setServings(n => Math.max(1, n - 1)); }} disabled={servings <= 1} className="btn-secondary w-12 px-0 text-xl">−</button>
              <input id="meal-servings" type="number" min="1" max="30" value={servings} onChange={e => { setSeenRecipeNames([]); setServings(Math.min(30, Math.max(1, Number(e.target.value) || 1))); }} className="input max-w-24 text-center font-bold" />
              <span className="text-sm text-primary-700">people</span>
              <button type="button" aria-label="One more person" onClick={() => { setSeenRecipeNames([]); setServings(n => Math.min(30, n + 1)); }} disabled={servings >= 30} className="btn-secondary w-12 px-0 text-xl">+</button>
            </div>
          </div>
          <button type="button" onClick={fetchInitialDataAndSuggest} disabled={loading || loadingHousehold}
            className="btn-primary w-full sm:w-auto sm:min-w-52">
            {loading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Finding ideas…</> : <><Sparkles className="w-4 h-4" /> Find 3 different meal ideas</>}
          </button>
        </div>
        {!loadingHousehold && inventory.length === 0 && !family && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Your kitchen list is empty, so ideas may need ingredients you don’t have yet. <Link to="/inventory" className="font-semibold underline">Add ingredients</Link>
          </p>
        )}
      </section>

      {/* Family Allergen Shield Notification */}
      {family?.allergyShield && family.allergyShield.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-900">
                Family food safety
              </p>
              <p className="text-xs text-red-700 mt-0.5">
                We used the allergies your family shared when choosing these ideas. Check food labels before cooking:{' '}
                <strong>
                  {family.allergyShield.map(a => `${a.allergen} (${a.members.join(', ')})`).join(' • ')}
                </strong>
              </p>
            </div>
          </div>
          <Link to="/family" className="text-sm text-red-900 underline font-semibold shrink-0">
            Update food needs
          </Link>
        </div>
      )}

      {/* Suggestions List */}
      {loadingHousehold ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-700 font-medium">Getting your kitchen ready…</p>
        </div>
      ) : loading ? (
        <div className="py-10 text-center space-y-3" role="status" aria-live="polite">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-700 font-medium">Finding meals for {servings} people…</p>
        </div>
      ) : !hasGenerated ? null : suggestions.length === 0 ? (
        <div className="card p-8 text-center space-y-3">
          <p className="text-primary-900 font-semibold">No matching ideas found this time.</p>
          <p className="text-sm text-primary-700">Try a different occasion or add a few ingredients to your kitchen list.</p>
          <button onClick={fetchInitialDataAndSuggest} className="btn-secondary mx-auto">Try again</button>
        </div>
      ) : (
        <section aria-labelledby="meal-ideas-title" className="space-y-4">
        {aiUnavailable && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">The AI service is not available for this key right now. These ideas are coming from the pantry-matched recipe library.</div>}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-orange-700">STEP 2</p>
            <h2 id="meal-ideas-title" className="text-xl font-bold text-primary-950">Three ideas for {servings} people</h2>
          </div>
          <p className="text-sm text-primary-600">Choose a meal to add to your weekly plan{family?.id ? ' or send it to your family to vote' : ''}.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((recipe, idx) => {
            const isExpanded = expandedId === recipe.name;
            const isPollSent = sentPolls[recipe.name];
            const missingCount = (recipe.ingredients || []).filter(i => !i.inPantry).length;

            return (
              <div
                key={idx}
                className="card bg-white border rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
              >
                <div className="h-36 sm:h-40 overflow-hidden bg-orange-50">
                  <RecipePhoto recipe={recipe} alt={recipe.name} loading="lazy" className="h-full w-full object-cover" />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full">{recipe.category || 'Family meal'}</span>
                    <span className="text-sm font-medium text-emerald-800">{recipe.ingredients?.filter(i => i.inPantry).length || 0} of {recipe.ingredients?.length || 0} ingredients at home</span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-gray-950 leading-snug">{recipe.name}</h3>
                    <p className="text-sm text-gray-700 mt-1 line-clamp-2">{recipe.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y py-2.5 text-sm text-gray-700">
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-500" />{recipe.prepTime} prep · {recipe.cookTime} cook</span>
                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-500" />For {servings} people</span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className={missingCount ? 'text-sm text-amber-800' : 'text-sm text-emerald-800'}>
                      {missingCount ? `${missingCount} ingredients to buy` : 'You have everything at home'}
                    </p>
                    <button type="button" aria-expanded={isExpanded} onClick={() => setExpandedId(isExpanded ? null : recipe.name)} className="text-sm font-semibold text-primary-800 hover:underline inline-flex items-center gap-1">
                      {isExpanded ? 'Hide recipe' : 'See recipe'} {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t pt-3 space-y-4">
                      <div>
                        <h4 className="font-semibold text-primary-950 mb-2">Ingredients for {servings}</h4>
                        <ul className="space-y-2 text-sm text-gray-800">
                          {(recipe.ingredients || []).map((ing, iIdx) => (
                            <li key={iIdx} className="flex justify-between gap-3">
                              <span className="flex gap-2"><span className={ing.inPantry ? 'text-emerald-700' : 'text-amber-700'} aria-hidden="true">{ing.inPantry ? '✓' : '•'}</span>{ing.name}</span>
                              <span className="font-medium text-right shrink-0">{ing.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {recipe.instructions?.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-primary-950 mb-2">How to make it</h4>
                          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-800">
                            {recipe.instructions.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}
                          </ol>
                        </div>
                      )}
                      {recipe.nutrition ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Estimated per person:</strong> {recipe.nutrition.calories} calories · Protein {recipe.nutrition.proteinG}g · Carbs {recipe.nutrition.carbsG}g · Fat {recipe.nutrition.fatG}g · Fiber {recipe.nutrition.fiberG}g{recipe.nutrition.coveragePercent ? <span className="mt-1 block text-xs text-emerald-800">Based on {recipe.nutrition.coveragePercent}% of ingredients with known nutrition values; amounts are approximate.</span> : null}</p> : <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Nutrition figures are not available for this recipe. Check its ingredients for allergy and diet needs.</p>}
                      {recipe.sourceUrl && <p className="text-xs text-gray-500">Recipe and photo: <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold underline">{recipe.source || 'TheMealDB'}</a></p>}
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="p-4 bg-gray-50 border-t flex flex-wrap items-center justify-between gap-3">
                  {missingCount > 0 ? (
                    <button
                      onClick={() => handleAddMissingToCart(recipe.ingredients)}
                      className="btn-secondary text-sm flex items-center gap-1.5 py-2 px-3"
                      title="Add missing ingredients to your shopping cart"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to shopping list ({missingCount})
                    </button>
                  ) : (
                    <span className="text-sm text-emerald-800 font-medium flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600" /> 100% in stock
                    </span>
                  )}

                  <button
                    onClick={() => handleSendToVote(recipe)}
                    disabled={sendingId === recipe.name || isPollSent}
                    className={`text-sm font-semibold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition-all min-h-[44px] ${
                      isPollSent
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'btn-primary'
                    }`}
                  >
                    {sendingId === recipe.name ? (
                      'Sending...'
                    ) : isPollSent ? (
                      <>
                        <CheckCircle className="w-4 h-4" /> {family?.id ? 'Sent to family' : 'Added to weekly plan'}
                      </>
                    ) : (
                      <>
                      {family?.id ? <><Vote className="w-4 h-4" /> Ask family to choose</> : <><ArrowRight className="w-4 h-4" /> Add to weekly plan</>}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </section>
      )}
    </div>
  );
}
