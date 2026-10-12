import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';
import api from '../lib/api';
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
  const navigate = useNavigate();
  const [todayMeals, setTodayMeals] = useState(null);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const [isMaker, setIsMaker] = useState(user?.role === 'maker');

  useEffect(() => {
    let active = true;
    const loadToday = async () => {
      try {
        const familyResponse = await api.get('/family/mine').catch(() => null);
        const family = familyResponse?.data?.family || familyResponse?.data || null;
        setIsMaker(family?.id
          ? family.creatorId === user?.id || family.members?.some(member => member.userId === user?.id && member.role === 'maker')
          : true);
        const menuResponse = await api.get(family?.id ? `/weeklyMenu/family/${family.id}` : '/weeklyMenu');
        const rows = Array.isArray(menuResponse.data) ? menuResponse.data : [];
        const meals = rows.filter(item => {
          const date = new Date(item.date);
          return !Number.isNaN(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === todayKey();
        }).sort((a, b) => ['Breakfast', 'Lunch', 'Dinner', 'Snack'].indexOf(a.mealType) - ['Breakfast', 'Lunch', 'Dinner', 'Snack'].indexOf(b.mealType));
        if (active) setTodayMeals(meals);
      } catch {
        if (active) setTodayMeals([]);
      }
    };
    loadToday();
    return () => { active = false; };
  }, []);

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
      <section className="rounded-[1.75rem] border border-[#efc0ad] bg-gradient-to-br from-[#fff2e9] via-[#ffeadf] to-[#fbd8ca] p-5 shadow-[0_12px_30px_rgba(101,39,31,0.07)] sm:p-8 lg:p-10">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-bold text-primary-700"><CalendarDays className="h-4 w-4" />{formatDate(new Date())}<span aria-hidden="true">·</span>Your family kitchen</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-primary-950 sm:text-4xl">{greeting}, {firstName}.</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-primary-800 sm:text-lg">Let’s make today’s food easy. Choose one thing to do, or ask for a meal idea.</p>
            <p className="mt-1 text-sm text-primary-700">Aaj ke khane ka plan seedha yahan se karein.</p>
          </div>
          <button onClick={() => navigate('/family/meal-chat')} className="btn-primary min-h-14 justify-center px-6 text-base sm:w-fit">
            <MessageCircle className="h-5 w-5" /> What should we cook? <span className="hidden sm:inline">· Aaj kya pakayen?</span>
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-primary-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="today-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary-600">Today · Aaj</p>
            <h2 id="today-heading" className="mt-1 text-xl font-bold text-primary-950">What’s on the menu?</h2>
          </div>
          <button onClick={() => navigate('/weekly-menu')} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-primary-800 hover:bg-primary-50">Open weekly plan <ArrowRight className="h-4 w-4" /></button>
        </div>
        {todayMeals === null ? (
          <p className="mt-4 rounded-2xl bg-primary-50 px-4 py-4 text-sm text-primary-700">Loading today’s meals…</p>
        ) : todayMeals.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {todayMeals.map(item => <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-primary-100 bg-[#fffaf6] p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-800"><UtensilsCrossed className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wide text-primary-600">{item.mealType}</p><p className="truncate font-bold text-primary-950">{item.recipe?.name || item.mealName || 'Planned meal'}</p></div>
              {['completed', 'cooked'].includes(item.status) && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800"><Check className="h-3.5 w-3.5" />Cooked</span>}
            </div>)}
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-[#fffaf6] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-800"><ChefHat className="h-5 w-5" /></span><div><p className="font-bold text-primary-950">No meals planned for today</p><p className="mt-1 text-sm text-primary-700">Aaj ka khana add karein, ya helper se idea lein.</p></div></div>
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
