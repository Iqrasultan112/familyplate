import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import {
  ShoppingBag,
  Sparkles,
  Users,
  Copy,
  Share2,
  Check,
  Plus,
  Trash2,
  ArrowRight,
  ShieldAlert,
  ChefHat,
  CheckCircle2,
  UtensilsCrossed
} from 'lucide-react';

const COMMON_ALLERGIES = [
  'Peanuts', 'Tree Nuts', 'Dairy / Lactose', 'Gluten / Wheat',
  'Shellfish', 'Fish', 'Eggs', 'Soy', 'Sesame'
];

const COMMON_DIETARY = [
  'Halal', 'Vegetarian', 'Vegan', 'High Protein', 'Low Carb / Keto',
  'Dairy-Free', 'Gluten-Free', 'Kid Friendly'
];

export default function MakerOnboarding() {
  const { user, checkAuth } = useAuthStore();
  const navigate = useNavigate();

  // Wizard steps: 1: Groceries Upload, 2: Family Setup & Invite, 3: Dietary & Allergies
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Grocery extraction state
  const [groceryText, setGroceryText] = useState(
    "1 kg Chicken\n2 kg Basmati Rice\n1 kg Fresh Tomatoes\n500g Onions\n1 Liter Milk\n1 packet Yellow Lentils (Daal)\nCooking Oil\nGinger & Garlic\nGreen Chilies"
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');

  // Step 2: Family setup state
  const [familyName, setFamilyName] = useState(`${user?.name || 'My'}'s Family`);
  const [expectedMembers, setExpectedMembers] = useState(4);
  const [createdFamily, setCreatedFamily] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isCreatingFamily, setIsCreatingFamily] = useState(false);

  // Step 3: Dietary & Allergen state
  const [selectedAllergies, setSelectedAllergies] = useState([]);
  const [selectedDietary, setSelectedDietary] = useState(['Halal']);
  const [favoriteFoods, setFavoriteFoods] = useState('');
  const [dislikes, setDislikes] = useState('');

  // Step 1: Extract Groceries via AI
  const handleExtractGroceries = async () => {
    if (!groceryText.trim()) {
      toast.error('Please enter or paste your grocery items');
      return;
    }

    setIsExtracting(true);
    try {
      const res = await api.post('/ai/extract-groceries', { rawText: groceryText });
      const items = res.data.items || [];
      setExtractedItems(items);
      toast.success(`✨ Extracted ${items.length} pantry items!`);
    } catch (error) {
      toast.error('Failed to extract groceries. Please check items.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setExtractedItems([
      ...extractedItems,
      { ingredient: newItemName.trim(), quantity: newItemQty.trim() || '1 unit', category: 'Pantry' }
    ]);
    setNewItemName('');
    setNewItemQty('');
  };

  const handleRemoveItem = (index) => {
    setExtractedItems(extractedItems.filter((_, idx) => idx !== index));
  };

  const handleConfirmGroceries = async () => {
    try {
      // Save items to user's kitchen inventory in bulk
      for (const item of extractedItems) {
        await api.post('/inventory', {
          ingredient: item.ingredient,
          quantity: item.quantity
        });
      }
      toast.success('Pantry inventory saved!');
      setCurrentStep(2);
    } catch (error) {
      // Even if inventory had duplicate or partial, advance to family setup
      setCurrentStep(2);
    }
  };

  // Step 2: Create Family & Generate Invite Link
  const handleCreateFamily = async (e) => {
    e.preventDefault();
    if (!familyName.trim()) return;

    setIsCreatingFamily(true);
    try {
      const res = await api.post('/family/create', {
        name: familyName,
        expectedMembers: parseInt(expectedMembers) || 4
      });
      setCreatedFamily(res.data.family || res.data);
      toast.success('Family group created successfully! 🏠');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create family');
    } finally {
      setIsCreatingFamily(false);
    }
  };

  const getInviteLink = () => {
    if (!createdFamily?.code) return '';
    return `${window.location.origin}/register?join=${createdFamily.code}`;
  };

  const copyInviteLink = () => {
    const link = getInviteLink();
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success('Direct invite link copied!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyCode = () => {
    if (!createdFamily?.code) return;
    navigator.clipboard.writeText(createdFamily.code);
    setCopiedCode(true);
    toast.success('Join code copied!');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const shareWhatsApp = () => {
    const code = createdFamily?.code;
    const link = getInviteLink();
    const message = `Join our family meal group "${familyName}" on FamilyPlate! We are voting on daily meals and sharing preferences. Click here to join: ${link} or use code ${code}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Step 3: Save Preferences & Finish Onboarding
  const handleFinishOnboarding = async () => {
    try {
      await api.put('/profile', {
        allergies: selectedAllergies,
        dietaryPreferences: [...selectedDietary, ...(favoriteFoods.trim() ? [`Favorite foods: ${favoriteFoods.trim().slice(0, 200)}`] : [])],
        dislikes
      });
      if (checkAuth) checkAuth();
      toast.success('All set! Here are your daily meal suggestions 🍽️');
      navigate('/family/suggestions');
    } catch (error) {
      navigate('/family/suggestions');
    }
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

  return (
    <div className="page-shell max-w-3xl py-6 space-y-8">
      {/* Header with step progress indicator */}
      <div className="page-heading text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-800 text-xs font-semibold px-3 py-1 rounded-full">
          <ChefHat className="w-4 h-4" /> Meal Maker Setup Wizard
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome, Chef of the House! 👩‍🍳</h1>
        <p className="text-gray-500 text-sm max-w-lg mx-auto">
          Let's set up your kitchen groceries, invite your family members, and get smart daily recipe suggestions.
        </p>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3 pt-4">
          {[
            { num: 1, label: 'Groceries' },
            { num: 2, label: 'Family Invite' },
            { num: 3, label: 'Preferences' }
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  currentStep === s.num
                    ? 'bg-primary-600 text-white shadow'
                    : currentStep > s.num
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {currentStep > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-xs font-medium ${currentStep === s.num ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                {s.label}
              </span>
              {s.num < 3 && <div className="w-8 h-0.5 bg-gray-200"></div>}
            </div>
          ))}
        </div>
      </div>

      {/* ──────────────── STEP 1: GROCERY UPLOAD & EXTRACTION ──────────────── */}
      {currentStep === 1 && (
        <div className="card p-6 md:p-8 bg-white border rounded-2xl shadow-sm space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary-600" />
              Step 1: Upload or Paste Your Grocery List
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Paste your grocery bill, receipt items, or what you bought. Our AI will automatically extract the ingredients into your kitchen pantry inventory.
            </p>
          </div>

          <div className="space-y-3">
            <label className="label font-medium text-gray-700">
              Grocery List / Receipt Items:
            </label>
            <textarea
              rows={6}
              className="input w-full font-mono text-sm leading-relaxed"
              placeholder="Paste grocery list here (e.g. 1 kg Chicken, 2 kg Basmati Rice, 500g Tomatoes, Milk, Yogurt, Garam Masala...)"
              value={groceryText}
              onChange={(e) => setGroceryText(e.target.value)}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-gray-500">
                Tip: You can paste receipt lines or enter items separated by commas or lines.
              </span>
              <button
                type="button"
                onClick={handleExtractGroceries}
                disabled={isExtracting}
                className="btn-primary flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isExtracting ? 'Extracting Ingredients...' : 'Extract Ingredients with AI'}
              </button>
            </div>
          </div>

          {/* Extracted Ingredients Table */}
          {extractedItems.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-100 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Extracted Pantry Inventory ({extractedItems.length} items)
                </h3>
                <span className="text-xs text-gray-400">Review & edit before saving</span>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-xl divide-y text-sm">
                {extractedItems.map((item, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-xs text-gray-400 font-mono">{idx + 1}.</span>
                      <div>
                        <span className="font-medium text-gray-800">{item.ingredient}</span>
                        <span className="text-xs text-gray-500 ml-2">({item.quantity || '1 unit'})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {item.category || 'Pantry'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-400 hover:text-red-600 p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add extra manual item */}
              <form onSubmit={handleAddItem} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add another ingredient (e.g. Eggs)"
                  className="input flex-1 text-sm"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Qty (e.g. 1 dozen)"
                  className="input w-32 text-sm"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                />
                <button type="submit" className="btn-secondary text-sm flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleConfirmGroceries}
                  className="btn-primary flex items-center gap-2 py-2.5 px-6 text-base"
                >
                  Confirm & Save to Kitchen Pantry
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {extractedItems.length === 0 && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Skip this step for now
              </button>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── STEP 2: FAMILY SETUP & INVITE LINK ──────────────── */}
      {currentStep === 2 && (
        <div className="card p-6 md:p-8 bg-white border rounded-2xl shadow-sm space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Step 2: Create Your Family Space & Generate Invite Link
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              How many members are in your family? We will generate a unique invite link so everyone can join with a single click.
            </p>
          </div>

          {!createdFamily ? (
            <form onSubmit={handleCreateFamily} className="space-y-4">
              <div>
                <label className="label font-medium">Family / Household Name</label>
                <input
                  type="text"
                  required
                  className="input mt-1"
                  placeholder="e.g. The Smiths, Rahman Household"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                />
              </div>

              <div>
                <label className="label font-medium">Expected Number of Family Members</label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  required
                  className="input mt-1"
                  value={expectedMembers}
                  onChange={(e) => setExpectedMembers(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Includes you and your family members who will vote on meals.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCreatingFamily}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
                >
                  {isCreatingFamily ? 'Creating Family Group...' : 'Create Family & Generate Invite Link'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  Family Group "{createdFamily.name}" is Ready!
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Share the link or code below with your family members so they can join and cast their votes.
                </p>
              </div>

              <div className="bg-gray-50 border rounded-xl p-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                    Direct Invite Link (Click to Join)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getInviteLink()}
                      className="input flex-1 bg-white font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={copyInviteLink}
                      className="btn-primary flex items-center gap-1.5 px-3 text-sm shrink-0"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? 'Copied' : 'Copy Link'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                  <div>
                    <span className="text-xs text-gray-500 block">Family Join Code:</span>
                    <span className="text-xl font-bold font-mono text-primary-700">{createdFamily.code}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyCode}
                      className="btn-secondary text-xs flex items-center gap-1 py-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedCode ? 'Copied' : 'Copy Code'}
                    </button>
                    <button
                      type="button"
                      onClick={shareWhatsApp}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share on WhatsApp
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="btn-primary flex items-center gap-2 py-2.5 px-6 text-base"
                >
                  Next: Family Preferences & Allergies
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── STEP 3: PREFERENCES & ALLERGIES ──────────────── */}
      {currentStep === 3 && (
        <div className="card p-6 md:p-8 bg-white border rounded-2xl shadow-sm space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600" />
              Step 3: Household Dietary Preferences & Allergy Shield
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Select your family's dietary rules and critical allergies. Any daily recipe suggested will strictly exclude these allergens!
            </p>
          </div>

          {/* Allergies Selection */}
          <div className="space-y-2">
            <label className="label font-medium text-gray-800 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              Family Allergies & Sensitivities to AVOID:
            </label>
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

          {/* Dietary Preferences Selection */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="label font-medium text-gray-800 flex items-center gap-1.5">
              <UtensilsCrossed className="w-4 h-4 text-primary-500" />
              Household Dietary Preferences:
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
            <label className="label font-medium text-gray-700" htmlFor="favoriteFoods">Foods or flavours your family loves (Optional)</label>
            <input id="favoriteFoods" type="text" maxLength={200} placeholder="e.g. chicken, biryani, mild spice, spinach" className="input w-full text-sm" value={favoriteFoods} onChange={e => setFavoriteFoods(e.target.value)} />
          </div>

          {/* Dislikes / Notes */}
          <div className="space-y-1 pt-2 border-t border-gray-100">
            <label className="label font-medium text-gray-700">
              General Dislikes or Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. mushrooms, very spicy food, bitter gourd"
              className="input w-full text-sm"
              value={dislikes}
              onChange={(e) => setDislikes(e.target.value)}
            />
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              type="button"
              onClick={handleFinishOnboarding}
              className="btn-primary py-3 px-8 text-base flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              Finish Setup & Get Today's Meal Suggestions
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
