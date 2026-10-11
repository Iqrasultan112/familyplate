import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ChefHat, MessageCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import MealPlannerChat from '../components/MealPlannerChat';

export default function MealChatPage() {
  const [family, setFamily] = useState(null);
  const [servings, setServings] = useState(4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get('/family/mine')
      .then(({ data }) => { if (active) setFamily(data?.family || data || null); })
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
    <div className="mx-auto flex h-[calc(100dvh-11.5rem)] min-h-[34rem] w-full max-w-6xl flex-col gap-4 md:h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-6.5rem)]">
      <header className="page-banner shrink-0 bg-[#FFF0E6]">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-800 text-white shadow-sm"><MessageCircle className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary-700">Your meal planning chat</p>
            <h1 className="page-title mt-1">What would you like to cook?</h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-primary-800">Tell the helper what you’re in the mood for, what you have at home, or how much time you have. Change your mind whenever you like.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 pl-0 sm:pl-16">
          <Link to="/family/suggestions" className="btn-secondary"><Sparkles className="h-4 w-4" /> Browse meal ideas</Link>
          <Link to="/weekly-menu" className="btn-secondary"><CalendarDays className="h-4 w-4" /> See the meal plan</Link>
        </div>
      </header>

      {loading ? <div className="card p-8 text-center text-base text-primary-700">Loading your family meal space…</div> : !family?.id ? (
        <section className="card p-6 text-center sm:p-10">
          <ChefHat className="mx-auto h-10 w-10 text-orange-700" />
          <h2 className="mt-3 text-xl font-bold text-primary-950">Set up your family space first</h2>
          <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-primary-700">The meal helper needs your family’s food list and meal plan to make useful suggestions.</p>
          <Link to="/family" className="btn-primary mt-5">Set up family space <ArrowRight className="h-4 w-4" /></Link>
        </section>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-primary-900">Planning for <span className="text-primary-700">{family.name}</span></p>
            <label className="flex items-center gap-2 text-sm font-semibold text-primary-900" htmlFor="chat-servings">People eating
              <input id="chat-servings" type="number" min="1" max="30" value={servings} onChange={event => setServings(Math.min(30, Math.max(1, Number(event.target.value) || 1)))} className="input min-h-10 w-20 px-2 py-2 text-center" />
            </label>
          </div>
          <MealPlannerChat family={family} servings={servings} onSendToVote={sendToVote} />
        </>
      )}
    </div>
  );
}
