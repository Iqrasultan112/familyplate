import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Bookmark,
  Plus,
  Clock,
  Users,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Vote,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import { recordPlannedMeal } from '../lib/rewards';
import RecipePhoto from '../components/RecipePhoto';
import DayPickerModal from '../components/DayPickerModal';
import ShoppingIngredientsModal from '../components/ShoppingIngredientsModal';
import { addMissingRecipeIngredients } from '../lib/addMissingRecipeIngredients';
import RecipeVideoLinks from '../components/RecipeVideoLinks';
import WhatsAppRecipeShareButton from '../components/WhatsAppRecipeShareButton';

export default function RecipeDetails() {
  const { id } = useParams();
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ingredientCheck, setIngredientCheck] = useState({ present: [], missing: [] });
  const [checkingInventory, setCheckingInventory] = useState(false);

  // Modal state
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showShoppingModal, setShowShoppingModal] = useState(false);

  useEffect(() => {
    fetchRecipeAndCheck();
  }, [id]);

  const fetchRecipeAndCheck = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/recipes/${id}`);
      let recipeData = res.data;

      // Parse JSON ingredients/instructions if needed
      if (typeof recipeData.ingredients === 'string') {
        try { recipeData.ingredients = JSON.parse(recipeData.ingredients); } catch (e) {}
      }
      if (typeof recipeData.instructions === 'string') {
        try { recipeData.instructions = JSON.parse(recipeData.instructions); } catch (e) {}
      }
      if (typeof recipeData.nutrition === 'string') {
        try { recipeData.nutrition = JSON.parse(recipeData.nutrition); } catch (e) { recipeData.nutrition = null; }
      }

      setRecipe(recipeData);
      try {
        const recent = JSON.parse(localStorage.getItem('familyplate:recent-recipes') || '[]');
        const ids = [String(recipeData.id || id), ...(Array.isArray(recent) ? recent.map(String) : [])].filter((value, index, all) => all.indexOf(value) === index).slice(0, 12);
        localStorage.setItem('familyplate:recent-recipes', JSON.stringify(ids));
      } catch {}

      // Check ingredient availability against pantry
      setCheckingInventory(true);
      try {
        const checkRes = await api.post('/menu/check-ingredients', { recipeId: id });
        setIngredientCheck(checkRes.data || { present: [], missing: [] });
      } catch (checkErr) {
        console.warn('Inventory check failed:', checkErr);
      } finally {
        setCheckingInventory(false);
      }
    } catch (err) {
      toast.error('Failed to load recipe details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.post(`/recipes/${id}/save`);
      setRecipe({ ...recipe, isSaved: !recipe.isSaved });
      toast.success(recipe.isSaved ? 'Recipe removed from bookmarks' : 'Recipe saved to bookmarks! ❤️');
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const handleAddSingleToCart = async (ing) => {
    try {
      await api.post('/shopping', {
        ingredient: ing.name || ing,
        quantity: ing.quantity || '1 pack'
      });
      toast.success(`Added "${ing.name || ing}" to Shopping Cart! 🛒`);
    } catch (err) {
      toast.error('Failed to add item to cart');
    }
  };

  const handleAddAllMissingToCart = async () => {
    if (!ingredientCheck.missing?.length) return;
    try {
      await api.post('/shopping/bulk', {
        items: ingredientCheck.missing.map(m => ({
          ingredient: m.name,
          quantity: m.quantity || '1'
        }))
      });
      toast.success(`Added ${ingredientCheck.missing.length} missing items to Shopping Cart! 🛒`);
    } catch (err) {
      toast.error('Failed to add items to cart');
    }
  };

  const handleAddToMenu = async (date, mealType) => {
    try {
      const famRes = await api.get('/family/mine');
      const family = famRes.data?.family || (Array.isArray(famRes.data?.families) ? famRes.data.families[0] : null);
      const planned = await api.post('/weeklyMenu', { recipeId: Number(id), date, mealType, familyId: family?.id });
      if (recordPlannedMeal(user?.id, planned.data)) toast.success('Meal added to your plan · +10 points');
      const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString();
      try {
        const addedCount = await addMissingRecipeIngredients(id);
        toast.success(addedCount
          ? `Added ${recipe.name} to ${mealType} on ${dateLabel}; ${addedCount} missing ingredient${addedCount === 1 ? '' : 's'} added to your shopping list.`
          : `Added ${recipe.name} to ${mealType} on ${dateLabel}. Your pantry has what you need, or the items are already on your list.`);
      } catch {
        toast.success(`${recipe.name} was planned, but its missing ingredients could not be added to your shopping list.`);
      }
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add this recipe to the weekly menu');
      return false;
    }
  };

  const handleSendToFamilyVote = async () => {
    try {
      const famRes = await api.get('/family/mine');
      const fam = famRes.data?.family || (Array.isArray(famRes.data) ? famRes.data[0] : null);
      if (!fam) {
        toast.error('Please join or create a family group first!');
        navigate('/family');
        return;
      }

      await api.post('/mealRequests', {
        mealName: recipe.name,
        recipeId: parseInt(id),
        familyId: fam.id,
        requestedDate: new Date().toISOString(),
        message: `Proposed ${recipe.name} for our upcoming family meal!`
      });

      toast.success(`Sent "${recipe.name}" to family for voting! 🗳️`);
      navigate('/family/voting');
    } catch (error) {
      toast.error('Failed to send to family vote');
    }
  };

  if (loading) return <div className="p-16 text-center text-[#806b63]">Loading recipe...</div>;
  if (!recipe) return <div className="p-16 text-center text-[#806b63]">Recipe not found.</div>;

  const missingList = ingredientCheck.missing || [];
  const presentList = ingredientCheck.present || [];

  return (
    <div className="page-shell max-w-7xl pb-24">
      <div className="space-y-5 rounded-[28px] bg-[#fffaf6] border border-[#f1d8ca] p-4 text-[#44241d] shadow-2xl sm:p-6">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 rounded-full p-2 text-sm font-medium text-[#6d5047] transition-colors hover:bg-[#f8e8df] hover:text-[#44241d]">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2">
          <WhatsAppRecipeShareButton recipe={recipe} label="WhatsApp" className="px-3 py-2" />
          <button onClick={handleSendToFamilyVote} className="flex items-center gap-1.5 rounded-xl border border-[#eedbd1] px-3 py-2 text-xs text-[#62483f] hover:bg-[#f8e8df]">
            <Vote className="w-4 h-4 text-purple-600" /> Send to Family Vote
          </button>
          <button onClick={handleSave} className="flex items-center gap-1.5 rounded-xl border border-[#eedbd1] px-3 py-2 text-xs text-[#62483f] hover:bg-[#f8e8df]">
            <Bookmark className={`w-4 h-4 ${recipe.isSaved ? 'text-primary fill-current' : 'text-[#806b63]'}`} />
            {recipe.isSaved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div className="grid gap-3 lg:grid-cols-[1.12fr_1.05fr_0.82fr]">
        <div className="relative min-h-64 overflow-hidden rounded-2xl bg-[#fff4ed] sm:min-h-80 lg:min-h-72"><RecipePhoto recipe={recipe} className="absolute inset-0 h-full w-full object-cover" alt={recipe.name} /><span className="absolute bottom-3 left-3 rounded-full border border-[#f1d8ca] bg-white/90 px-3 py-1 text-xs font-medium text-[#44241d] shadow-sm">{recipe.category || 'Family recipe'}</span></div>
        <div className="flex min-h-64 flex-col justify-between rounded-2xl bg-white border border-[#f1d8ca] p-5 sm:p-6"><div><div className="mb-4 flex items-center gap-2 text-xs text-[#6d5047]"><span className="rounded-full border border-[#eedbd1] px-2.5 py-1">{recipe.creator?.name || recipe.creatorName || 'Family cook'}</span><span>·</span><span>{recipe.source ? `From ${recipe.source}` : 'Family recipe'}</span></div><h1 className="text-2xl font-bold leading-tight sm:text-3xl">{recipe.name}</h1><p className="mt-3 line-clamp-4 text-sm leading-6 text-[#6d5047]">{recipe.description || `A delicious ${recipe.name} recipe to make for your family table.`}</p></div><div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[#6d5047]"><span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-[#a34b39]" /> Prep {recipe.prepTime || '15 min'}</span><span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-[#a34b39]" /> Cook {recipe.cookTime || '25 min'}</span><span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-[#a34b39]" /> Serves {recipe.servings || 4}</span></div></div>
        <div className="rounded-2xl bg-white border border-[#f1d8ca] p-5"><h2 className="font-bold">Nutrition per serving</h2>{recipe.nutrition ? <div className="mt-4 space-y-2 text-sm text-[#62483f]">{[['Calories',recipe.nutrition.calories,'kcal'],['Protein',recipe.nutrition.proteinG,'g'],['Carbohydrates',recipe.nutrition.carbsG,'g'],['Fat',recipe.nutrition.fatG,'g'],['Fibre',recipe.nutrition.fiberG,'g']].map(([label,value,unit]) => <div key={label} className="flex justify-between border-b border-[#eedbd1] pb-2"><span>{label}</span><strong className="text-[#44241d]">{value ?? '—'} {value != null ? unit : ''}</strong></div>)}</div> : <p className="mt-4 text-sm leading-6 text-[#806b63]">Nutrition details aren’t available for this recipe yet.</p>}{recipe.sourceUrl && <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs text-[#a34b39] underline">View recipe source</a>}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2"><button onClick={() => setShowMenuModal(true)} className="flex items-center justify-between rounded-2xl bg-white border border-[#f1d8ca] p-4 text-left hover:bg-[#fff1e8]"><span className="flex items-center gap-3"><span className="rounded-full bg-[#fae8dd] p-3 text-[#a34b39]"><Plus className="h-5 w-5" /></span><span><strong className="block">Add to meal plan</strong><small className="text-[#806b63]">Choose a date and meal time</small></span></span><Plus className="h-5 w-5 text-[#6d5047]" /></button><button onClick={() => setShowShoppingModal(true)} className="flex items-center justify-between rounded-2xl bg-white border border-[#f1d8ca] p-4 text-left hover:bg-[#fff1e8]"><span className="flex items-center gap-3"><span className="rounded-full bg-[#fae8dd] p-3 text-[#a34b39]"><ShoppingCart className="h-5 w-5" /></span><span><strong className="block">Add to shopping list</strong><small className="text-[#806b63]">Choose ingredients and servings</small></span></span><Plus className="h-5 w-5 text-[#6d5047]" /></button></div>

      {(recipe.nutrition || recipe.sourceUrl) && (
        null
      )}

      {/* ──────────────── INGREDIENTS WITH PANTRY CHECK & ALTERNATIVES ──────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl bg-white border border-[#f1d8ca] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-[#44241d] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#a34b39]" />
              Ingredients
            </h2>
            <p className="text-xs text-[#806b63] mt-0.5">
              Checked against your pantry.
            </p>
          </div>

          {missingList.length > 0 && (
            <button
              onClick={() => setShowShoppingModal(true)}
              className="text-xs flex items-center gap-1.5 py-2 px-3 self-start sm:self-auto rounded-xl border border-[#eedbd1] text-[#62483f] hover:bg-[#f8e8df]"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Add ingredients to shopping list
            </button>
          )}
        </div>

        {/* Missing ingredients banner with smart substitutes */}
        {missingList.length > 0 && (
          <div className="bg-[#fff0ce] border border-amber-200/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#805400] uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-[#946100]" />
                {missingList.length} Missing Ingredients (with Smart Alternatives)
              </h3>
              <span className="text-[11px] text-[#805400] font-medium">Choose what to add</span>
            </div>

            <div className="space-y-2">
              {missingList.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#fff4ed] border border-[#eedbd1] rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <span className="text-sm font-semibold text-[#44241d]">
                      • {item.name} <span className="text-xs text-[#806b63] font-normal">({item.quantity})</span>
                    </span>
                    {item.substitute && (
                      <p className="text-xs text-[#805400] bg-[#fff0ce] px-2 py-0.5 rounded inline-block">
                        💡 Alternative: {item.substitute}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowShoppingModal(true)}
                    className="text-xs flex items-center gap-1 py-1 px-2.5 self-end sm:self-auto shrink-0 rounded-lg border border-[#eedbd1] text-[#62483f]"
                  >
                    <Plus className="w-3 h-3" /> Add to Cart
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Ingredients Checklist */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">
              In this recipe
            </h3>
            <ul className="space-y-2.5 text-sm">
              {(recipe.ingredients || []).map((ing, i) => {
                const name = ing.name || ing.ingredient || ing;
                const isMissing = missingList.some(m => m.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(m.name.toLowerCase()));
                return (
                  <li key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#fff4ed]">
                    <span className="flex items-center gap-2">
                      {isMissing ? (
                        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" title="Missing from pantry"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="In pantry"></span>
                      )}
                      <span className="text-[#44241d] font-medium">{name}</span>
                    </span>
                    <span className="text-xs text-[#806b63]">{ing.quantity}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

          {/* Instructions */}
          <div className="rounded-2xl bg-white border border-[#f1d8ca] p-5 sm:p-6">
            <h3 className="text-xl font-bold text-[#44241d] mb-4">
              Instructions
            </h3>
            <div className="space-y-3">
              {(recipe.instructions || []).map((step, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#fae8dd] text-[#a34b39] flex items-center justify-center font-bold text-xs mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-[#62483f] leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <RecipeVideoLinks recipeName={recipe.name} />
      </div>

      <DayPickerModal isOpen={showMenuModal} onClose={() => setShowMenuModal(false)} onSelectDay={handleAddToMenu} recipeName={recipe.name} />
      {showShoppingModal && <ShoppingIngredientsModal recipe={recipe} servings={recipe.servings || 4} onClose={() => setShowShoppingModal(false)} />}
      </div>
    </div>
  );
}
