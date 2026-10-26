import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';
import api from '../lib/api';
import useRewardPoints from '../hooks/useRewardPoints';
import {
  ArrowRight, CalendarDays, Check, ChefHat, MessageCircle, Package,
  ShoppingCart, ThumbsUp, UtensilsCrossed, Users
} from 'lucide-react';

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { points, plannedMeals, completedMeals, streak, level } = useRewardPoints(user?.id);
  const navigate = useNavigate();
  const [weekMeals, setWeekMeals] = useState(null);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const [isMaker, setIsMaker] = useState(user?.role === 'maker');

  useEffect(() => {
    let active = true;
    let loading = false;
    const loadWeek = async () => {
      if (loading) return;
      loading = true;
      try {
        const familyResponse = await api.get('/family/mine').catch(() => null);
        const family = familyResponse?.data?.family || familyResponse?.data || null;
        setIsMaker(family?.id
          ? family.creatorId === user?.id || family.members?.some(member => member.userId === user?.id && member.role === 'maker')
          : true);
        const menuResponse = await api.get(family?.id ? `/weeklyMenu/family/${family.id}` : '/weeklyMenu');
        const rows = Array.isArray(menuResponse.data) ? menuResponse.data : [];
        const from = todayKey();
        const throughDate = new Date();
        throughDate.setDate(throughDate.getDate() + 6);
        const through = `${throughDate.getFullYear()}-${String(throughDate.getMonth() + 1).padStart(2, '0')}-${String(throughDate.getDate()).padStart(2, '0')}`;
        const mealOrder = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'];
        const meals = rows.filter(item => {
          const dateKey = String(item.date || '').slice(0, 10);
          return dateKey >= from && dateKey <= through;
        }).sort((a, b) => String(a.date).slice(0, 10).localeCompare(String(b.date).slice(0, 10))
          || mealOrder.indexOf(a.mealType) - mealOrder.indexOf(b.mealType));
        if (active) setWeekMeals(meals);
      } catch {
        if (active) setWeekMeals([]);
      } finally {
        loading = false;
      }
    };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') loadWeek(); };
    loadWeek();
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('familyplate:weekly-menu-change', loadWeek);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const refreshTimer = window.setInterval(refreshWhenVisible, 30_000);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('familyplate:weekly-menu-change', loadWeek);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(refreshTimer);
    };
  }, [user?.id]);

  const tasks = isMaker ? [
    { title: 'Ask for a meal idea', subtitle: 'Pantry, time, mood—tell the helper what you need.', local: 'Aaj kya pakayen?', icon: MessageCircle, path: '/family/meal-chat', strong: true },
    { title: 'Plan the week', subtitle: 'Add breakfast, lunch, or dinner to any day.', local: 'Hafte ka khana set karein', icon: CalendarDays, path: '/weekly-menu' },
    { title: 'Check kitchen stock', subtitle: 'Add what you have at home or mark what ran out.', local: 'Ghar ka rashan dekhein', icon: Package, path: '/inventory' },
    { title: 'Make a shopping list', subtitle: 'Keep the things you need in one simple list.', local: 'Khareedari list', icon: ShoppingCart, path: '/shopping' },
  ] : [
    { title: 'Tell us what you want to eat', subtitle: 'Ask for an idea that fits your mood and time.', local: 'Khane ka mashwara lein', icon: MessageCircle, path: '/family/meal-chat', strong: true },
    { title: 'Choose a family meal', subtitle: 'Vote for a dish or see what everyone likes.', local: 'Apni pasand ka vote dein', icon: ThumbsUp, path: '/family/voting' },
    { title: 'See the week’s plan', subtitle: 'Check what is planned for each day.', local: 'Hafte ka menu dekhein', icon: CalendarDays, path: '/weekly-menu' },
    { title: 'Ask for your favourite', subtitle: 'Send a meal request to the person who cooks.', local: 'Apni farmaish bhejein', icon: UtensilsCrossed, path: '/family/requests' },
  ];

  return (
    <div className="page-shell mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-[#B8DFD0] bg-gradient-to-br from-[#F0F8F3] via-[#E5F3EB] to-[#D5EBDF] p-5 shadow-[0_12px_30px_rgba(23,77,67,0.08)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-white/35 blur-2xl" />
        <p className="relative inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-bold text-primary-700"><CalendarDays className="h-4 w-4" />{formatDate(new Date())}<span aria-hidden="true">·</span>Your family kitchen</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-primary-950 sm:text-4xl">{greeting}, {firstName}.</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-primary-800 sm:text-lg">Your meals, pantry, and family choices—together in one simple place.</p>
            <p className="mt-1 text-sm text-primary-700">Aaj ka khana plan karein, asaani se.</p>
          </div>
          <button onClick={() => navigate('/family/meal-chat')} className="btn-primary relative min-h-14 justify-center px-6 text-base sm:w-fit">
            <MessageCircle className="h-5 w-5" /> What should we cook? <span className="hidden sm:inline">· Aaj kya pakayen?</span>
          </button>
        </div>
      </section>

      <section className="reward-panel rounded-3xl border p-5 shadow-sm sm:p-6" aria-labelledby="reward-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/75 text-2xl shadow-sm" aria-hidden="true">🌟</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 id="reward-heading" className="text-lg font-extrabold">Your kitchen wins</h2><span className="reward-pill rounded-full px-3 py-1 text-xs font-bold">{points} points</span><span className="rounded-full bg-white/75 px-3 py-1 text-xs font-bold">{level}</span><span className="rounded-full bg-white/75 px-3 py-1 text-xs font-bold">🔥 {streak} day streak</span></div>
            <p className="mt-1 text-sm">Plan a meal to earn 10 points; finish cooking one for 20 more. Keep your streak going and collect kitchen badges!</p>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Earned badges">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${points >= 10 ? 'reward-badge' : 'bg-white/70 text-slate-500'}`}>{points >= 10 ? '🏅' : '🔒'} Meal planner</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${completedMeals >= 1 ? 'reward-badge' : 'bg-white/70 text-slate-500'}`}>{completedMeals >= 1 ? '👩‍🍳' : '🔒'} Home chef</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${completedMeals >= 3 ? 'reward-badge' : 'bg-white/70 text-slate-500'}`}>{completedMeals >= 3 ? '✨' : '🔒'} Kitchen star</span>
            </div>
          </div>
          <div className="w-full sm:w-44"><div className="flex justify-between text-xs font-bold"><span>3-meal challenge</span><span>{Math.min(plannedMeals, 3)}/3</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/70"><div className="reward-progress h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(plannedMeals, 3) / 3 * 100}%` }} /></div><p className="mt-1 text-xs">{plannedMeals >= 3 ? '🎉 Challenge complete!' : `${3 - Math.min(plannedMeals, 3)} more meal${3 - Math.min(plannedMeals, 3) === 1 ? '' : 's'} to go`}</p></div>
        </div>
      </section>

      <section className="rounded-3xl border border-primary-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="today-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary-600">Today and the next 6 days · Aaj aur aglay 6 din</p>
            <h2 id="today-heading" className="mt-1 text-xl font-bold text-primary-950">This week’s plan</h2>
          </div>
          <button onClick={() => navigate('/weekly-menu')} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-primary-800 hover:bg-primary-50">See this week <ArrowRight className="h-4 w-4" /></button>
        </div>
        {weekMeals === null ? (
          <p className="mt-4 rounded-2xl bg-primary-50 px-4 py-4 text-sm text-primary-700">Loading this week’s meals…</p>
        ) : weekMeals.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {weekMeals.map(item => {
              const dateKey = String(item.date || '').slice(0, 10);
              const dateLabel = dateKey === todayKey() ? 'Today' : new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              return <button key={item.id} type="button" onClick={() => navigate(`/weekly-menu?date=${dateKey}`)} className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-[#fffaf6] p-4 text-left transition hover:border-primary-300 hover:shadow-sm">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-800"><UtensilsCrossed className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-primary-600">{dateLabel} · {item.mealType}</p><p className="truncate font-bold text-primary-950">{item.recipe?.name || item.mealName || 'Planned meal'}</p></div>
              {['completed', 'cooked'].includes(item.status) && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800"><Check className="h-3.5 w-3.5" />Cooked</span>}
              </button>;
            })}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-[#fffaf6] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-800"><ChefHat className="h-5 w-5" /></span><div><p className="font-bold text-primary-950">No meals planned for the next 7 days</p><p className="mt-1 text-sm text-primary-700">Add a meal to your weekly plan and it will appear here.</p></div></div>
            <button onClick={() => navigate('/weekly-menu')} className="btn-secondary min-h-11 shrink-0">Add today’s meal</button>
          </div>
        )}
      </section>

      <section aria-labelledby="start-heading">
        <div className="mb-4"><h2 id="start-heading" className="text-xl font-bold text-primary-950">What would you like to do?</h2><p className="mt-1 text-sm text-primary-700">Pick a button. You can’t get lost—come back to Home anytime.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {tasks.map(task => <button key={task.path} onClick={() => navigate(task.path)} className={`group flex min-h-28 items-center gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${task.strong ? 'border-primary-800 bg-primary-800 text-white hover:bg-primary-900' : 'border-primary-200 bg-white text-primary-950 hover:border-primary-400'}`}>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${task.strong ? 'bg-white/15 text-white' : 'bg-primary-50 text-primary-800'}`}><task.icon className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-base sm:text-lg">{task.title}</strong><span className={`mt-0.5 block text-xs font-semibold ${task.strong ? 'text-white/85' : 'text-primary-700'}`}>{task.local}</span><span className={`mt-1 block text-sm leading-5 ${task.strong ? 'text-white/85' : 'text-primary-600'}`}>{task.subtitle}</span></span>
            <ArrowRight className={`h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 ${task.strong ? 'text-white' : 'text-primary-500'}`} />
          </button>)}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-primary-200 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3"><Users className="h-5 w-5 text-primary-700" /><p className="text-sm text-primary-800">{isMaker ? 'Need family preferences or recipes?' : 'Need to update allergies or food preferences?'}</p></div>
        <button onClick={() => navigate(isMaker ? '/family' : '/profile')} className="min-h-10 rounded-xl px-3 text-sm font-bold text-primary-800 hover:bg-primary-50">{isMaker ? 'Open family details' : 'Update my profile'} <ArrowRight className="ml-1 inline h-4 w-4" /></button>
      </section>
    </div>
  );
}
