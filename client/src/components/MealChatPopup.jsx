import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import MealPlannerChat from './MealPlannerChat';

export default function MealChatPopup({ onClose, popup = true }) {
  const [family, setFamily] = useState(null);
  const [servings, setServings] = useState(4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/family/mine')
      .then(({ data }) => { if (active) setFamily(data?.family || (data?.id ? data : null)); })
      .catch(() => { if (active) setFamily(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const sendToVote = async recipe => {
    if (!family?.id) return toast.error('Join or create a family first.');
    try {
      const { data: saved } = await api.post('/recipes', {
        name: recipe.name,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings || servings,
        image: recipe.image || null,
        sourceUrl: recipe.sourceUrl,
        nutrition: recipe.nutrition
      });
      await api.post('/mealRequests', {
        mealName: recipe.name,
        recipeId: saved.id,
        familyId: family.id,
        requestedDate: new Date().toISOString(),
        message: 'Suggested from the meal helper for ' + (recipe.servings || servings) + ' people.'
      });
      toast.success('Sent to your family for a vote.');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not send this meal for a vote. Please try again.');
    }
  };

  return (
    <section className={popup ? 'fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col overflow-hidden border-l border-primary-200 bg-[#fffdfa] shadow-2xl' : 'flex h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] min-h-0 w-full flex-col bg-transparent md:h-[calc(100dvh-4.5rem)]'} aria-label="Meal helper chat">
      {loading ? <div className="grid flex-1 place-items-center text-sm text-primary-700">Opening your meal helper…</div> : (
        <>
          {popup && <header className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-primary-200 bg-white px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-100 text-primary-800"><MessageCircle className="h-4 w-4" /></span>
              <div className="min-w-0"><h1 className="text-sm font-bold text-primary-950">Meal helper <span className="font-medium text-primary-700">· Aaj kya pakayen?</span></h1><p className="truncate text-xs text-primary-600">{family?.name || 'Your kitchen'}</p></div>
            </div>
            <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary-800" htmlFor="chat-servings">People
              <input id="chat-servings" type="number" min="1" max="30" value={servings} onChange={event => setServings(Math.min(30, Math.max(1, Number(event.target.value) || 1)))} className="input min-h-8 w-12 px-1 py-1 text-center text-sm" />
            </label>
          </header>}
          <MealPlannerChat family={family} servings={servings} onSendToVote={family?.id ? sendToVote : undefined} compact={popup} onClose={onClose} showPeopleControl={!popup} familyName={family?.name || 'Your kitchen'} onServingsChange={event => setServings(Math.min(30, Math.max(1, Number(event.target.value) || 1)))} />
        </>
      )}
    </section>
  );
}
