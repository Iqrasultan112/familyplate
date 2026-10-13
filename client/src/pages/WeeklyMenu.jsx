import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X, Eye, Trash2, CheckCircle, ChefHat, Minus, Users, PackageCheck, ArrowLeft, ArrowRight, MoreHorizontal, ShoppingCart, Pencil, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sameIngredient } from '../lib/foodMatching';
import useAuthStore from '../store/authStore';
import RecipePhoto from '../components/RecipePhoto';
import ShoppingIngredientsModal from '../components/ShoppingIngredientsModal';
import { addMissingRecipeIngredients } from '../lib/addMissingRecipeIngredients';
import useRewardPoints from '../hooks/useRewardPoints';
import RecipeVideoLinks from '../components/RecipeVideoLinks';

const toLocalDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'];
const monthGrid = (date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), index - mondayOffset + 1));
};
const getInitialMenuDate = () => {
  const selectedDate = new URLSearchParams(window.location.search).get('date');
  return selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? new Date(`${selectedDate}T12:00:00`) : new Date();
};

export default function WeeklyMenu() {
  const [currentDate, setCurrentDate]           = useState(() => { const date = getInitialMenuDate(); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const [focusedDate, setFocusedDate] = useState(() => toLocalDateKey(getInitialMenuDate()));
  const [menuItems, setMenuItems]               = useState([]);
  const [familyId, setFamilyId]                 = useState(null);
  const [isMaker, setIsMaker]                   = useState(false);
  const [events, setEvents]                     = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [myRecipes, setMyRecipes]               = useState([]);
  const [showAddModal, setShowAddModal]         = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [shoppingMeal, setShoppingMeal] = useState(null);
  const [editingMeal, setEditingMeal] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editMealType, setEditMealType] = useState('Dinner');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [selectedDate, setSelectedDate]         = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [planChoice, setPlanChoice] = useState('this-week');
  const [replaceItemId, setReplaceItemId] = useState('');
  const [servings, setServings] = useState(4);
  const [mealType, setMealType] = useState('Dinner');
  const [activeCooking, setActiveCooking] = useState(null);
  const [cookStep, setCookStep] = useState(0);
  const [pantry, setPantry] = useState([]);
  const [cookResult, setCookResult] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [startingMealId, setStartingMealId] = useState(null);
  const { user } = useAuthStore();
  const { award } = useRewardPoints(user?.id);

  useEffect(() => { fetchMenu(); }, [currentDate]);
  useEffect(() => {
    const timer = setTimeout(() => fetchRecipes(recipeSearch), 250);
    return () => clearTimeout(timer);
  }, [recipeSearch]);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      let fId = null;
      try {
        const r = await api.get('/family/mine');
        const family = r.data?.family;
        fId = family?.id;
        setFamilyId(fId);
        setIsMaker(family ? family.creatorId === user?.id || family.members?.some(member => member.userId === user?.id && member.role === 'maker') : true);
      } catch { setIsMaker(true); }
      const res = await api.get(fId ? `/weeklyMenu/family/${fId}` : '/weeklyMenu');
      const pantryRes = await api.get('/inventory').catch(() => ({ data: [] }));
      setPantry(pantryRes.data || []);
      if (fId) {
        const eventRes = await api.get(`/events/family/${fId}`).catch(() => ({ data: [] }));
        setEvents(eventRes.data || []);
      } else setEvents([]);
      const monthStart = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      setMenuItems((res.data || []).filter(item => {
        const key = String(item.date || '').slice(0, 10);
        return key >= monthStart && key < monthEnd;
      }));
    } catch { toast.error('Failed to load menu'); }
    finally { setLoading(false); }
  };

  const fetchRecipes = async (search = '') => {
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}&limit=50` : '?limit=50';
      const [all, mine] = await Promise.all([
        api.get(`/recipes${query}`).catch(() => ({ data: [] })),
        api.get(`/recipes/my/recipes${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`).catch(() => ({ data: [] }))
      ]);
      const lists = [all.data, all.data?.recipes, mine.data, mine.data?.recipes].filter(Array.isArray);
      setMyRecipes(Array.from(new Map(lists.flat().filter(recipe => recipe?.id).map(recipe => [String(recipe.id), recipe])).values()));
    } catch {}
  };

  const getStartOfWeek = (date) => {
    const d = new Date(date); d.setHours(0,0,0,0);
    const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getWeekDays = () => {
    const start = getStartOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  };

  const openModal = (dateObj, type = 'Dinner') => {
    if (toLocalDateKey(dateObj) < toLocalDateKey(new Date())) return;
    setSelectedDate(toLocalDateKey(dateObj));
    setMealType(type);
    setRecipeSearch('');
    setShowAddModal(true);
  };

  const resetModal = () => { setSelectedRecipeId(''); setServings(4); setMealType('Dinner'); setSelectedDate(''); setPlanChoice('this-week'); setReplaceItemId(''); setRecipeSearch(''); };

  const handleAddMeal = async (e) => {
    e.preventDefault();
    try {
      if (!selectedDate || selectedDate < toLocalDateKey(new Date())) {
        toast.error('You can only plan meals for today or a future date');
        return;
      }
      if (!selectedRecipeId) { toast.error('Choose a saved recipe to enable cooking and pantry tracking'); return; }
      if (planChoice === 'replace') {
        const oldItem = menuItems.find(item => String(item.id) === String(replaceItemId));
        if (!oldItem) { toast.error('Choose a meal to replace'); return; }
        if (!window.confirm(`Replace ${oldItem.recipe?.name || 'this planned meal'} with ${myRecipes.find(recipe => String(recipe.id) === String(selectedRecipeId))?.name || 'your selected recipe'}?`)) return;
        const { data } = await api.patch(`/weeklyMenu/${replaceItemId}/replace`, { recipeId: selectedRecipeId });
        setMenuItems(menuItems.map(item => item.id === data.id ? data : item));
        try {
          const addedCount = await addMissingRecipeIngredients(selectedRecipeId);
          toast.success(addedCount ? `Planned meal replaced; ${addedCount} missing ingredient${addedCount === 1 ? '' : 's'} added to your shopping list.` : 'Planned meal replaced. Your pantry has what you need, or the items are already on your list.');
        } catch {
          toast.success('Planned meal replaced, but missing ingredients could not be added to your shopping list.');
        }
      } else {
        let date = selectedDate;
        if (planChoice === 'next-week') {
          const nextDate = new Date(`${selectedDate}T12:00:00`);
          nextDate.setDate(nextDate.getDate() + 7);
          date = toLocalDateKey(nextDate);
        }
        const res = await api.post('/weeklyMenu', { date, recipeId: selectedRecipeId, servings, mealType, familyId });
        setMenuItems([...menuItems, res.data]);
        if (award(`planned:${res.data.id}`, 10)) toast.success('🌟 +10 kitchen points — meal planned!');
        if (planChoice === 'next-week') setCurrentDate(new Date(`${date}T12:00:00`));
        try {
          const addedCount = await addMissingRecipeIngredients(selectedRecipeId);
          const planMessage = planChoice === 'next-week' ? 'Added to next week’s menu' : 'Meal added to this week’s menu';
          toast.success(addedCount ? `${planMessage}; ${addedCount} missing ingredient${addedCount === 1 ? '' : 's'} added to your shopping list.` : `${planMessage}. Your pantry has what you need, or the items are already on your list.`);
        } catch {
          toast.success('Meal planned, but missing ingredients could not be added to your shopping list.');
        }
      }
      setShowAddModal(false); resetModal(); fetchMenu();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add meal');
    }
  };

  const handleRemove = async (id) => {
    try { await api.delete(`/weeklyMenu/${id}`); setMenuItems(menuItems.filter(i => i.id !== id)); }
    catch { toast.error('Failed to remove'); }
  };

  const beginMealEdit = (meal, field = 'date') => {
    setEditingMeal({ ...meal, editField: field });
    setEditDate(String(meal.date || '').slice(0, 10) || toLocalDateKey(new Date()));
    setEditMealType(meal.mealType || 'Dinner');
    setOpenMenuId(null);
  };
  const saveMealEdit = async (event) => {
    event.preventDefault();
    try {
      const { data } = await api.patch(`/weeklyMenu/${editingMeal.id}`, { date: editDate, mealType: editMealType });
      setMenuItems(items => items.map(item => item.id === data.id ? data : item));
      setFocusedDate(editDate);
      const nextDate = new Date(`${editDate}T12:00:00`);
      setCurrentDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      setEditingMeal(null);
      toast.success('Meal plan updated');
    } catch (err) { toast.error(err.response?.data?.error || 'Could not update meal plan'); }
  };

  const startCooking = async (meal) => {
    setStartingMealId(meal.id);
    try {
      const { data } = ['cooking', 'completed'].includes(meal.status) ? { data: meal } : await api.post(`/weeklyMenu/${meal.id}/start`);
      setActiveCooking(data); setCookStep(0); setCookResult(null);
      setMenuItems(items => items.map(item => item.id === data.id ? data : item));
    } catch (err) { toast.error(err.response?.data?.error || 'Could not start cooking'); }
    finally { setStartingMealId(null); }
  };
  const adjustServings = async (next) => {
    if (!activeCooking || next < 1 || next > 100 || activeCooking.status === 'completed') return;
    try {
      const { data } = await api.patch(`/weeklyMenu/${activeCooking.id}/servings`, { servings: next });
      setActiveCooking(data); setMenuItems(items => items.map(item => item.id === data.id ? data : item));
    } catch (err) { toast.error(err.response?.data?.error || 'Could not change servings'); }
  };
  const finishCooking = async () => {
    setFinishing(true);
    try {
      const { data } = await api.post(`/weeklyMenu/${activeCooking.id}/complete`);
      if (!['completed', 'cooked'].includes(activeCooking.status) && award(`cooked:${activeCooking.id}`, 20)) toast.success('🏅 +20 kitchen points — home chef!');
      if (!['completed', 'cooked'].includes(activeCooking.status)) award(`cooked:${activeCooking.id}`, 20);
      setCookResult(data); setActiveCooking(data.item); setMenuItems(items => items.map(item => item.id === data.item.id ? { ...item, ...data.item } : item));
      const updated = await api.get('/inventory').catch(() => ({ data: pantry })); setPantry(updated.data || pantry);
      toast.success('Meal complete — your pantry has been updated');
    } catch (err) { toast.error(err.response?.data?.error || 'Could not update pantry'); }
    finally { setFinishing(false); }
  };
  const parseList = (value) => { try { const parsed = typeof value === 'string' ? JSON.parse(value) : (value || []); return Array.isArray(parsed) ? parsed : [parsed]; } catch { return []; } };
  const scaledQty = (quantity, factor) => {
    const match = String(quantity || '').match(/^(\s*)(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)(.*)$/);
    if (!match) return quantity;
    const base = match[2].includes('/') ? match[2].split('/').map(Number).reduce((a, b) => a / b) : Number(match[2]);
    return `${match[1]}${Number((base * factor).toFixed(2))}${match[3]}`;
  };

  const days = monthGrid(currentDate);
  const todayKey = toLocalDateKey(new Date());
  const selectedDay = new Date(`${focusedDate}T12:00:00`);
  const selectedMeals = menuItems.filter(item => item.date?.slice(0, 10) === focusedDate);
  const selectedEvents = events.filter(event => event.date?.slice(0, 10) === focusedDate);
  const changeMonth = (amount) => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + amount, 1);
    setCurrentDate(next);
    setFocusedDate(toLocalDateKey(next));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="page-shell max-w-7xl space-y-6">

      {/* Header */}
      <div className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Hafte ka khana · {familyId ? 'Family plan' : 'My plan'}</h1>
          <p className="page-subtitle">
            Pick a date to see what’s cooking. Choose any day to add or check a meal.
          </p>
          {familyId && !isMaker && <p className="mt-1 text-xs text-slate-500">View-only family plan. Vote or request meals from your family space.</p>}
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-card">
          <button onClick={() => changeMonth(-1)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => setCurrentDate(new Date())}
            className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            Aaj
          </button>
          <button onClick={() => { const now = new Date(); setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1)); setFocusedDate(todayKey); }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.35fr)]">
        <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white p-5 shadow-card sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-700">Tap any date · Kisi din ko chunein</p><h2 className="mt-1 text-xl font-bold text-slate-900">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2></div>
            <div className="flex items-center gap-1"><button aria-label="Previous month" onClick={() => changeMonth(-1)} className="rounded-xl p-2 hover:bg-orange-50"><ChevronLeft className="h-5 w-5" /></button><button aria-label="Next month" onClick={() => changeMonth(1)} className="rounded-xl p-2 hover:bg-orange-50"><ChevronRight className="h-5 w-5" /></button></div>
          </div>
          <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day} className="py-2">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1.5">{days.map(day => {
            const key = toLocalDateKey(day); const inMonth = day.getMonth() === currentDate.getMonth(); const isToday = key === todayKey; const selected = key === focusedDate;
            const count = menuItems.filter(item => item.date?.slice(0, 10) === key).length;
            const hasEvent = events.some(event => event.date?.slice(0, 10) === key);
            return <button key={key} onClick={() => { setFocusedDate(key); if (!inMonth) setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1)); }} aria-pressed={selected}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl text-sm transition-colors ${selected ? 'bg-primary-700 font-bold text-white shadow-md' : isToday ? 'bg-orange-50 font-bold text-primary-800 ring-1 ring-primary-300' : 'text-slate-700 hover:bg-orange-50'} ${!inMonth ? 'opacity-35' : ''}`}>
              {day.getDate()}<span className="absolute bottom-1.5 flex h-1.5 items-center gap-0.5">{count > 0 && <i className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-white' : 'bg-primary-500'}`} />}{hasEvent && <i className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-orange-200' : 'bg-amber-400'}`} />}</span>
            </button>;
          })}</div>
          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>{menuItems.length} meals planned this month</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-primary-500" /> Meal <i className="ml-2 h-2 w-2 rounded-full bg-amber-400" /> Event</span></div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-orange-100 bg-orange-50/70 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary-700">Meals for this date · Is din ka khana</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2><p className="mt-1 text-sm text-slate-600">{selectedMeals.length} planned {selectedMeals.length === 1 ? 'meal' : 'meals'}</p></div><div className="flex items-center gap-2"><button aria-label="Previous day" onClick={() => { const d = new Date(selectedDay); d.setDate(d.getDate() - 1); setFocusedDate(toLocalDateKey(d)); setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="rounded-xl border border-orange-200 bg-white p-2"><ChevronLeft className="h-4 w-4" /></button><button onClick={() => { setFocusedDate(todayKey); const d = new Date(); setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-semibold">Aaj · Today</button><button aria-label="Next day" onClick={() => { const d = new Date(selectedDay); d.setDate(d.getDate() + 1); setFocusedDate(toLocalDateKey(d)); setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="rounded-xl border border-orange-200 bg-white p-2"><ChevronRight className="h-4 w-4" /></button></div></div>
          {selectedEvents.map(event => <Link key={event.id} to="/family/events" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><CalendarDays className="h-5 w-5 text-amber-700" /><span><strong>{event.name}</strong><span className="block text-xs">{event.guestCount || 4} guests · special menu</span></span></Link>)}
          {isMaker && focusedDate >= todayKey && selectedMeals.length > 0 && <button onClick={() => openModal(selectedDay)} className="btn-primary min-h-12 w-full justify-center"><Plus className="h-4 w-4" /> Add a meal · Khana add karein</button>}
          {!selectedMeals.length ? <div className="rounded-2xl border border-dashed border-primary-300 bg-white p-6 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-primary-700"><CalendarDays className="h-6 w-6" /></span><h3 className="mt-3 font-bold text-slate-900">Nothing planned for this day</h3><p className="mt-1 text-sm text-slate-600">Is din ka khana abhi plan nahi hua.</p>{isMaker && focusedDate >= todayKey && <button onClick={() => openModal(selectedDay)} className="btn-secondary mt-4">Add the first meal</button>}</div> : <div className="space-y-3">{mealTypes.filter(type => selectedMeals.some(item => (item.mealType || 'Dinner') === type)).map(type => {
            const meals = selectedMeals.filter(item => (item.mealType || 'Dinner') === type);
            const canAdd = isMaker && focusedDate >= todayKey;
            return <section key={type} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-primary-700"><Clock3 className="h-4 w-4" /></span><h3 className="font-bold text-slate-800">{{ Breakfast: 'Breakfast · Nashta', Lunch: 'Lunch · Dopahar ka khana', Dinner: 'Dinner · Raat ka khana', Snack: 'Snack · Halka phulka', 'Side dish': 'Side dish · Saath ka khana' }[type]}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{meals.length}</span></div>{canAdd && <button onClick={() => openModal(selectedDay, type)} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-primary-700 hover:bg-orange-50"><Plus className="h-4 w-4" /> Add meal</button>}</div>
              {!meals.length ? <p className="py-2 text-sm text-slate-400">No {type.toLowerCase()} planned.</p> : <div className="space-y-2">{meals.map(meal => <article key={meal.id} className="relative flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <RecipePhoto recipe={meal.recipe || { name: meal.recipeName || 'family meal' }} alt={meal.recipe?.name || 'Meal'} className="h-16 w-16 shrink-0 rounded-xl object-cover" loading="lazy" />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{meal.recipe?.name || meal.recipeName || 'Planned meal'}</p><p className="mt-0.5 text-xs text-slate-500">{meal.servings || meal.event?.guestCount || meal.recipe?.servings || 4} servings{meal.status === 'cooking' ? ' · Cooking now' : ['completed','cooked'].includes(meal.status) ? ' · Cooked' : ''}{meal.event && ` · ${meal.event.name}`}</p><div className="mt-2 flex flex-wrap items-center gap-2">{isMaker && meal.recipeId && focusedDate === todayKey && !['completed','cooked'].includes(meal.status) && <button onClick={() => startCooking(meal)} disabled={startingMealId === meal.id} className="inline-flex items-center gap-1 rounded-lg bg-primary-700 px-2.5 py-1.5 text-xs font-bold text-white"><ChefHat className="h-3.5 w-3.5" />{meal.status === 'cooking' ? 'Resume cooking' : 'Start cooking'}</button>}{['completed','cooked'].includes(meal.status) && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><PackageCheck className="h-4 w-4" /> Cooked</span>}{meal.recipeId && <Link to={`/recipes/${meal.recipeId}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"><Eye className="h-3.5 w-3.5" /> Recipe</Link>}</div></div>
                {isMaker && !['completed','cooked','cooking'].includes(meal.status) && <div className="relative"><button aria-label="Meal options" onClick={() => setOpenMenuId(openMenuId === meal.id ? null : meal.id)} className="rounded-xl p-2 text-slate-500 hover:bg-white"><MoreHorizontal className="h-5 w-5" /></button>{openMenuId === meal.id && <><button aria-label="Close meal options" className="fixed inset-0 z-20 cursor-default" onClick={() => setOpenMenuId(null)} /><div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"><button onClick={() => beginMealEdit(meal, 'date')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-orange-50"><Pencil className="h-4 w-4" /> Change date</button><button onClick={() => beginMealEdit(meal, 'type')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-orange-50"><Clock3 className="h-4 w-4" /> Change meal type</button><button onClick={() => { setShoppingMeal(meal); setOpenMenuId(null); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-orange-50"><ShoppingCart className="h-4 w-4" /> Add to shopping list</button><button onClick={() => { setOpenMenuId(null); handleRemove(meal.id); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Remove from plan</button></div></>}</div>}
              </article>)}</div>}
            </section>;
          })}</div>}
          {isMaker && focusedDate < todayKey && <p className="px-1 text-xs text-slate-500">Past meals are available to view. You can add meals starting today.</p>}
        </section>
      </div>

      {/* Add Modal */}
      {isMaker && editingMeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setEditingMeal(null)}>
          <form onSubmit={saveMealEdit} onClick={event => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary-700">Update your plan</p><h2 className="mt-1 text-lg font-bold text-slate-900">{editingMeal.recipe?.name || 'Planned meal'}</h2></div><button type="button" onClick={() => setEditingMeal(null)} className="rounded-xl p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            <div><label className="label" htmlFor="editMealDate">Meal date</label><input id="editMealDate" className="input" type="date" min={todayKey} value={editDate} onChange={event => setEditDate(event.target.value)} required /></div>
            <div><label className="label" htmlFor="editMealType">Meal time</label><select id="editMealType" className="input" value={editMealType} onChange={event => setEditMealType(event.target.value)}>{mealTypes.map(type => <option key={type}>{type}</option>)}</select></div>
            <button type="submit" className="btn-primary w-full"><CheckCircle className="h-4 w-4" /> Save changes</button>
          </form>
        </div>
      )}
      {isMaker && shoppingMeal && <ShoppingIngredientsModal recipe={shoppingMeal.recipe} servings={shoppingMeal.servings || 4} onClose={() => setShoppingMeal(null)} />}
      {isMaker && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-sm" onClick={() => { setShowAddModal(false); resetModal(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="add-meal-title" className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-modal scale-in sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex shrink-0 items-start justify-between">
              <div>
                <h3 id="add-meal-title" className="text-base font-bold text-slate-900">Add Meal to Plan</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => { setShowAddModal(false); resetModal(); }}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddMeal} className="flex min-h-0 flex-col overflow-hidden">
              <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pr-1">
              <div>
                <label className="label">From Saved Recipes</label>
                <input className="input mb-2" type="search" value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)} placeholder="Search all recipes by name or ingredient" />
                <select className="input" value={selectedRecipeId}
                  onChange={e => setSelectedRecipeId(e.target.value)}>
                  <option value="">Choose a recipe</option>
                  {myRecipes.filter(recipe => `${recipe.name || ''} ${recipe.category || ''} ${parseList(recipe.ingredients).map(item => item.name || item.ingredient || '').join(' ')}`.toLowerCase().includes(recipeSearch.trim().toLowerCase())).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="mealType">When will you serve it?</label>
                <select id="mealType" className="input" value={mealType} onChange={e => setMealType(e.target.value)}>
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'].map(type => <option key={type}>{type}</option>)}
                </select>
              </div>
              <fieldset className="space-y-2">
                <legend className="label">Where should this recipe go?</legend>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"><input type="radio" name="planChoice" value="this-week" checked={planChoice === 'this-week'} onChange={() => setPlanChoice('this-week')} className="mt-1" /><span><strong>Add to this week</strong><span className="block text-xs text-slate-500">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span></span></label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"><input type="radio" name="planChoice" value="next-week" checked={planChoice === 'next-week'} onChange={() => setPlanChoice('next-week')} className="mt-1" /><span><strong>Save for next week</strong><span className="block text-xs text-slate-500">Same day and meal, one week later</span></span></label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"><input type="radio" name="planChoice" value="replace" checked={planChoice === 'replace'} onChange={() => setPlanChoice('replace')} className="mt-1" /><span><strong>Replace a planned meal</strong><span className="block text-xs text-slate-500">Choose the meal you want to swap out</span></span></label>
              </fieldset>
              {planChoice === 'replace' && <div><label className="label" htmlFor="replace-meal">Meal to replace</label><select id="replace-meal" className="input" value={replaceItemId} onChange={event => setReplaceItemId(event.target.value)} required><option value="">Choose a future planned meal</option>{menuItems.filter(item => item.status !== 'completed' && toLocalDateKey(new Date(item.date)) >= toLocalDateKey(new Date())).map(item => <option key={item.id} value={item.id}>{new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {item.mealType || 'Dinner'} · {item.recipe?.name}</option>)}</select></div>}
              {!myRecipes.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">No recipes are available yet. Save a recipe first, then you can add it here.</p>}
              <div><label className="label">How many people?</label><div className="flex items-center gap-3"><button type="button" className="btn-secondary p-2" onClick={() => setServings(s => Math.max(1, s - 1))}><Minus className="h-4 w-4" /></button><span className="min-w-12 text-center text-lg font-bold">{servings}</span><button type="button" className="btn-secondary p-2" onClick={() => setServings(s => Math.min(100, s + 1))}><Plus className="h-4 w-4" /></button><span className="text-xs text-slate-500">You can quickly add guests while cooking</span></div></div>
              </div>
              <div className="shrink-0 border-t border-orange-100 bg-white pt-3">
              <button type="submit"
                className="btn-primary w-full py-3"
                disabled={!selectedRecipeId || (planChoice === 'replace' && !replaceItemId)}>
                <CheckCircle className="w-4 h-4" /> {planChoice === 'replace' ? 'Review replacement' : planChoice === 'next-week' ? 'Add to next week' : 'Add to Weekly Plan'}
              </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeCooking && (() => {
        const recipe = activeCooking.recipe || {};
        const ingredients = parseList(recipe.ingredients);
        const steps = parseList(recipe.instructions);
        const base = Number.parseFloat(recipe.servings) || 4;
        const factor = (activeCooking.servings || base) / base;
        return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setActiveCooking(null)}>
          <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-wider text-primary-700">Cooking mode</span><h2 className="mt-1 text-xl font-bold text-slate-900">{recipe.name}</h2><p className="text-sm text-slate-500">Adjust servings and we’ll recalculate the ingredients.</p></div><button className="rounded-xl p-2 text-slate-500 hover:bg-slate-100" onClick={() => setActiveCooking(null)} aria-label="Close cooking mode"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50 p-4"><div><p className="text-sm font-bold text-orange-950"><Users className="mr-1 inline h-4 w-4" /> Cooking for {activeCooking.servings || base}</p><p className="text-xs text-orange-800">Guests arrived? Add one in a tap.</p></div><div className="flex items-center gap-2"><button onClick={() => adjustServings((activeCooking.servings || base) - 1)} className="btn-secondary p-2" aria-label="Remove one serving"><Minus className="h-4 w-4" /></button><span className="min-w-8 text-center font-bold">{activeCooking.servings || base}</span><button onClick={() => adjustServings((activeCooking.servings || base) + 1)} className="btn-secondary p-2" aria-label="Add one serving"><Plus className="h-4 w-4" /></button><button onClick={() => adjustServings((activeCooking.servings || base) + 1)} className="rounded-xl bg-orange-700 px-3 py-2 text-xs font-bold text-white">+1 guest</button></div></div>
            <div className="mt-5 grid gap-5 md:grid-cols-2"><div><h3 className="mb-2 flex items-center gap-2 font-bold text-slate-900"><PackageCheck className="h-4 w-4 text-primary-700" /> Ingredients for {activeCooking.servings || base}</h3>{ingredients.length ? <ul className="space-y-2">{ingredients.map((ing, i) => { const name = ing.name || ing.ingredient || `Ingredient ${i + 1}`; const stock = pantry.find(p => sameIngredient(p.ingredient, name)); return <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span><b>{scaledQty(ing.quantity || ing.amount, factor)}</b> {name}</span><span className="shrink-0 text-[11px] text-slate-500">{stock ? `Pantry: ${stock.quantity}` : 'Check pantry'}</span></li>; })}</ul> : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This recipe has no ingredient list yet. Edit and add its ingredients before cooking to track pantry use.</p>}</div><div><h3 className="mb-2 font-bold text-slate-900">Step {Math.min(cookStep + 1, Math.max(steps.length, 1))} of {steps.length || 1}</h3><div className="flex min-h-36 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm leading-6 text-slate-700">{steps[cookStep] || 'Follow your recipe steps and mark the meal complete when ready.'}</p><div className="mt-4 flex justify-between"><button disabled={cookStep === 0} onClick={() => setCookStep(s => Math.max(0, s - 1))} className="btn-secondary px-3 py-2 text-xs disabled:opacity-40"><ArrowLeft className="mr-1 inline h-3 w-3" /> Back</button><button disabled={cookStep >= steps.length - 1} onClick={() => setCookStep(s => Math.min(steps.length - 1, s + 1))} className="btn-secondary px-3 py-2 text-xs disabled:opacity-40">Next <ArrowRight className="ml-1 inline h-3 w-3" /></button></div></div></div></div>
            <RecipeVideoLinks recipeName={recipe.name} compact />
            {cookResult && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-bold text-emerald-900">Pantry after cooking</h3>{cookResult.changed.length ? <ul className="mt-2 space-y-1 text-sm text-emerald-900">{cookResult.changed.map((item, i) => <li key={i}>{item.ingredient}: used {item.used} · remaining {item.remaining}</li>)}</ul> : <p className="mt-1 text-sm text-emerald-800">No pantry amounts were deducted. Check that pantry item names match the recipe and that their quantities use supported units.</p>}{cookResult.skipped.length > 0 && <p className="mt-2 text-xs text-emerald-800">Not changed (missing ingredients or amounts that could not be converted): {cookResult.skipped.join(', ')}</p>}</div>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={() => setActiveCooking(null)} className="btn-secondary">Close</button><button disabled={finishing} onClick={finishCooking} className="btn-primary"><CheckCircle className="h-4 w-4" /> {finishing ? 'Updating pantry…' : activeCooking.status === 'completed' ? 'Retry pantry update' : 'Finish meal & update pantry'}</button></div>
          </section>
        </div>;
      })()}
    </div>
  );
}
