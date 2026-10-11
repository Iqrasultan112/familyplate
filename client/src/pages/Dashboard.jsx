import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';
import api from '../lib/api';
import {
  Sparkles, ThumbsUp, Users, CalendarDays, ShoppingCart,
  Package, Globe, BookOpen, ArrowRight, UtensilsCrossed,
  Zap, MessageCircle
} from 'lucide-react';

const featuredCards = [
  {
    title:   'Chat about meals',
    desc:    'Tell the meal helper what you feel like, what is at home, or how much time you have.',
    icon:    MessageCircle,
    path:    '/family/meal-chat',
  },
  {
    title:   'AI Daily Suggestions',
    desc:    'Find meal ideas based on your kitchen and family food needs.',
    icon:    Sparkles,
    path:    '/family/suggestions',
  },
  {
    title:   'Family Meal Voting',
    desc:    'Every member votes on today\'s meal suggestion. Highest votes go to the maker for approval.',
    icon:    ThumbsUp,
    path:    '/family/voting',
  },
];

const quickLinks = [
  { label: 'Family Hub',      sub: 'Members & shield',              icon: Users,          path: '/family' },
  { label: 'Weekly Menu',     sub: '7-day household plan',          icon: CalendarDays,   path: '/weekly-menu' },
  { label: 'Kitchen Stock',   sub: 'Manage pantry inventory',       icon: Package,        path: '/inventory' },
  { label: 'Shopping List',   sub: 'Keep track of items to buy',    icon: ShoppingCart,   path: '/shopping' },
  { label: 'Special Dinners', sub: 'Events, parties & gatherings',  icon: UtensilsCrossed,path: '/family/events' },
  { label: 'Recipes',         sub: 'Browse & save recipes',         icon: BookOpen,       path: '/recipes' },
  { label: 'Community',       sub: 'Share & discover dishes',       icon: Globe,          path: '/community' },
  { label: 'Meal Requests',   sub: 'Submit & track favorites',      icon: Zap,            path: '/family/requests' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [dashboardStats, setDashboardStats] = useState({ meals: null, previousMeals: null, members: null, saved: null, pantry: null, hasFamily: null, todayMeals: null });
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    if (user?.role !== 'maker') return;
    let active = true;

    const loadDashboardStats = async () => {
      const [familyResult, profileResult, pantryResult] = await Promise.allSettled([
        api.get('/family/mine'),
        api.get('/profile'),
        api.get('/inventory'),
      ]);

      const family = familyResult.status === 'fulfilled' ? familyResult.value.data?.family : null;
      const members = familyResult.status === 'fulfilled'
        ? (family?.members?.length ?? 0)
        : null;
      const saved = profileResult.status === 'fulfilled' && Number.isFinite(Number(profileResult.value.data?.savedCount))
        ? Number(profileResult.value.data.savedCount)
        : null;
      const pantry = pantryResult.status === 'fulfilled' && Array.isArray(pantryResult.value.data)
        ? pantryResult.value.data.length
        : null;

      let meals = null;
      let previousMeals = null;
      let todayMeals = null;
      try {
        const menuResult = await api.get(family?.id ? `/weeklyMenu/family/${family.id}` : '/weeklyMenu');
        const menuRows = Array.isArray(menuResult.data) ? menuResult.data : [];
        const now = new Date();
        const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        todayMeals = menuRows
          .filter(item => {
            const date = new Date(item.date);
            return !Number.isNaN(date.getTime()) && dateKey(date) === dateKey(now);
          })
          .sort((a, b) => ['Breakfast', 'Lunch', 'Dinner', 'Snack'].indexOf(a.mealType) - ['Breakfast', 'Lunch', 'Dinner', 'Snack'].indexOf(b.mealType));
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        const nextWeekStart = new Date(weekStart);
        nextWeekStart.setDate(nextWeekStart.getDate() + 7);
        const previousWeekStart = new Date(weekStart);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);
        const countBetween = (from, to) => menuRows.filter(item => {
          const date = new Date(item.date);
          if (Number.isNaN(date.getTime())) return false;
          date.setHours(0, 0, 0, 0);
          return date >= from && date < to;
        }).length;
        meals = countBetween(weekStart, nextWeekStart);
        previousMeals = countBetween(previousWeekStart, weekStart);
      } catch {
        // Keep unavailable data distinct from a real count of zero.
      }

      if (active) setDashboardStats({ meals, previousMeals, members, saved, pantry, hasFamily: familyResult.status === 'fulfilled' ? Boolean(family) : null, todayMeals });
    };

    loadDashboardStats();
    return () => { active = false; };
  }, [user?.id, user?.role]);

  const stats = [
    { label: 'Meals This Week', value: dashboardStats.meals ?? '—', sub: dashboardStats.previousMeals === null ? 'Weekly menu count' : `${dashboardStats.previousMeals} planned last week`, icon: UtensilsCrossed },
    { label: 'Family Members', value: dashboardStats.members ?? '—', sub: dashboardStats.hasFamily === false ? 'Create a family space to invite people' : 'People in your family space', icon: Users },
    { label: 'Saved Recipes', value: dashboardStats.saved ?? '—', sub: 'Saved to your account', icon: BookOpen },
    { label: 'Pantry Items', value: dashboardStats.pantry ?? '—', sub: 'Tracked in your pantry', icon: Package },
  ];

  if (user?.role !== 'maker') {
    const memberLinks = [
      { label: 'Vote on a meal', detail: 'Tell your family what you feel like eating', icon: ThumbsUp, path: '/family/voting' },
      { label: 'See the family menu', detail: 'Check what is planned for the week', icon: CalendarDays, path: '/weekly-menu' },
      { label: 'Request a favourite', detail: 'Ask the meal planner to add a dish', icon: Zap, path: '/family/requests' },
      { label: 'Family chat', detail: 'Share meal ideas with your household', icon: Users, path: '/family/chat' },
      { label: 'Meal helper chat', detail: 'Ask for a meal that fits what you need today', icon: MessageCircle, path: '/family/meal-chat' },
      { label: 'Saved recipes', detail: 'Browse recipes and keep your favourites', icon: BookOpen, path: '/recipes' },
      { label: 'Friends & relatives', detail: 'Share recipes with your private groups', icon: Globe, path: '/community/groups' },
    ];
    return (
      <div className="page-shell space-y-8">
        <section className="relative isolate grid gap-6 overflow-hidden rounded-[2rem] border border-[#f1c9b7] bg-gradient-to-br from-[#fff2e9] via-[#ffe8dc] to-[#fbd5c5] p-6 shadow-[0_16px_38px_rgba(101,39,31,0.08)] sm:p-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center lg:px-10 lg:py-9">
          <div className="pointer-events-none absolute -right-14 -top-24 -z-10 h-72 w-72 rounded-full border-[34px] border-white/25" />
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary-700"><CalendarDays className="h-3.5 w-3.5" /> Your family table</p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-primary-950 sm:text-4xl">{greeting}, {user?.name?.split(' ')[0]}.</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-primary-800">See what’s planned, share what you’d like to eat, and help your family choose today’s meal.</p>
            <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => navigate('/family/voting')} className="btn-primary"><ThumbsUp className="h-4 w-4" /> Choose a meal</button><button onClick={() => navigate('/family/meal-chat')} className="btn-secondary border-white/80 bg-white/80"><MessageCircle className="h-4 w-4" /> Chat about meals</button></div>
          </div>
          <div className="relative rounded-[1.5rem] border border-white/80 bg-white/75 p-5 shadow-[0_12px_28px_rgba(101,39,31,0.08)] backdrop-blur-sm sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">A little look ahead</p><h2 className="mt-1 text-lg font-bold text-primary-950">Today’s family menu</h2></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff0e6] text-primary-800"><UtensilsCrossed className="h-5 w-5" /></span></div>
            {dashboardStats.todayMeals === null ? <p className="mt-5 rounded-2xl bg-white/80 px-4 py-4 text-sm text-primary-700">Checking today’s plan…</p> : dashboardStats.todayMeals.length ? <div className="mt-4 space-y-2">{dashboardStats.todayMeals.slice(0, 2).map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/85 px-4 py-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-primary-600">{item.mealType}</p><p className="truncate text-sm font-bold text-primary-950">{item.recipe?.name || 'Planned meal'}</p></div><span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">{['completed', 'cooked'].includes(item.status) ? 'Made' : 'Planned'}</span></div>)}{dashboardStats.todayMeals.length > 2 && <p className="px-1 text-xs font-semibold text-primary-700">+ {dashboardStats.todayMeals.length - 2} more meals</p>}</div> : <div className="mt-4 rounded-2xl bg-white/85 px-4 py-4"><p className="font-semibold text-primary-950">Nothing planned for today yet</p><p className="mt-1 text-sm leading-5 text-primary-700">Pick a meal now, or ask the helper for an idea.</p></div>}
            <button onClick={() => navigate('/weekly-menu')} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary-800 hover:text-primary-950">Open weekly plan <ArrowRight className="h-4 w-4" /></button>
          </div>
        </section>
        <section>
          <div className="mb-3"><h2 className="text-lg font-bold text-primary-950">Your family tools</h2><p className="text-sm text-primary-600">The meal planner manages the pantry and weekly plan. You can help choose what goes on the table.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {memberLinks.map(item => <button key={item.path} onClick={() => navigate(item.path)} className="action-card">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-100 text-primary-800"><item.icon className="h-6 w-6" /></span>
              <span><span className="block text-base font-bold text-primary-950">{item.label}</span><span className="mt-1 block text-sm leading-6 text-primary-700">{item.detail}</span></span>
            </button>)}
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold text-emerald-950">Your food needs matter</p><p className="text-sm text-emerald-800">Add allergies or foods you avoid so your family can plan with you in mind.</p></div>
          <button onClick={() => navigate('/profile')} className="btn-secondary shrink-0">Update my profile</button>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-8">

      {/* ── Dashboard welcome and today's plan ── */}
      <section className="relative isolate grid gap-6 overflow-hidden rounded-[2rem] border border-[#efc0ad] bg-gradient-to-br from-[#fff1e7] via-[#ffe5d7] to-[#f8cbb9] p-6 shadow-[0_16px_38px_rgba(101,39,31,0.09)] sm:p-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center lg:px-10 lg:py-9">
        <div className="pointer-events-none absolute -right-16 -top-28 -z-10 h-80 w-80 rounded-full border-[38px] border-white/25" />
        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary-700"><CalendarDays className="h-3.5 w-3.5" /> {formatDate(new Date())} <span className="text-primary-300">·</span> Your family kitchen</p>
          <h1 className="mt-4 text-3xl font-bold text-primary-950 tracking-tight leading-tight sm:text-4xl">{greeting}, {user?.name?.split(' ')[0]}.</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-primary-800">Make today’s meals easier to plan, cook, and enjoy together.</p>
          <div className="mt-6 flex flex-wrap gap-3"><button onClick={() => navigate('/family/meal-chat')} className="btn-primary"><MessageCircle className="w-4 h-4" /> Chat about meals</button><button onClick={() => navigate('/family/suggestions')} className="btn-secondary border-white/80 bg-white/80"><Sparkles className="w-4 h-4" /> Find meal ideas</button></div>
        </div>
        <div className="relative rounded-[1.5rem] border border-white/80 bg-white/75 p-5 shadow-[0_12px_28px_rgba(101,39,31,0.09)] backdrop-blur-sm sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600">A little look ahead</p><h2 className="mt-1 text-lg font-bold text-primary-950">Today’s family menu</h2></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#fff0e6] text-primary-800"><UtensilsCrossed className="h-5 w-5" /></span></div>
          {dashboardStats.todayMeals === null ? <p className="mt-5 rounded-2xl bg-white/80 px-4 py-4 text-sm text-primary-700">Checking today’s plan…</p> : dashboardStats.todayMeals.length ? <div className="mt-4 space-y-2">{dashboardStats.todayMeals.slice(0, 2).map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/85 px-4 py-3"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-primary-600">{item.mealType}</p><p className="truncate text-sm font-bold text-primary-950">{item.recipe?.name || 'Planned meal'}</p></div><span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-900">{['completed', 'cooked'].includes(item.status) ? 'Made' : 'Planned'}</span></div>)}{dashboardStats.todayMeals.length > 2 && <p className="px-1 text-xs font-semibold text-primary-700">+ {dashboardStats.todayMeals.length - 2} more meals</p>}</div> : <div className="mt-4 rounded-2xl bg-white/85 px-4 py-4"><p className="font-semibold text-primary-950">Nothing planned for today yet</p><p className="mt-1 text-sm leading-5 text-primary-700">Choose a dish or let the helper suggest one.</p></div>}
          <button onClick={() => navigate('/weekly-menu')} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary-800 hover:text-primary-950">Open weekly plan <ArrowRight className="h-4 w-4" /></button>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(s => (
          <div key={s.label} className="dashboard-stat card p-4 sm:p-5 transition-transform duration-200 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-[11px] font-bold text-primary-600 uppercase tracking-wider">{s.label}</p>
              <div className="w-9 h-9 bg-primary-100 border border-primary-200 rounded-xl flex items-center justify-center shrink-0">
                <s.icon className="w-4 h-4 text-primary-800" />
              </div>
            </div>
            <p className="text-3xl font-bold text-primary-950 tracking-tight">{s.value}</p>
            <p className="text-[11px] text-primary-400 mt-1 font-medium">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Featured ── */}
      <div>
        <div className="mb-4"><p className="section-label">A good place to start</p><p className="mt-1 text-sm text-primary-600">Choose what you need right now.</p></div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {featuredCards.map(card => (
            <button key={card.path} onClick={() => navigate(card.path)}
              className="card-hover p-5 sm:p-6 text-left flex flex-col h-full bg-white min-h-52">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center mb-4"><card.icon className="w-5 h-5 text-primary-700" /></div>
              <h3 className="text-base font-bold text-primary-950 tracking-tight">{card.title}</h3>
              <p className="text-sm text-primary-600 mt-2 leading-relaxed flex-1">{card.desc}</p>
              <div className="flex items-center gap-1.5 mt-5 text-xs font-bold text-primary-700">
                Open <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Quick access ── */}
      <div>
        <p className="section-label mb-3">All Features</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickLinks.map(card => (
            <button key={card.path} onClick={() => navigate(card.path)}
              className="card-hover p-4 text-left min-h-36">
              <div className="w-8 h-8 bg-primary-50 border border-primary-100 rounded-lg flex items-center justify-center mb-3">
                <card.icon className="w-4 h-4 text-primary-700" />
              </div>
              <p className="text-sm font-bold text-primary-950 leading-tight">{card.label}</p>
              <p className="text-[11px] text-primary-500 mt-1.5 leading-relaxed">{card.sub}</p>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
