import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { resolveRecipeImage } from '../lib/recipeImage';
import RecipePhoto from '../components/RecipePhoto';
import { listValue } from '../lib/listValue';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import {
  CalendarDays, ArrowLeft, PlusCircle, CheckCircle2,
  ChevronDown, ChevronUp, Star, Users, Trophy, Sparkles
} from 'lucide-react';

export default function EventPlanner() {
  const [events, setEvents]       = useState([]);
  const [family, setFamily]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newEvent, setNewEvent]   = useState({ name: '', date: '', description: '', eventType: 'dawat', guestCount: 8 });
  const [eventIdeas, setEventIdeas] = useState({});
  const [generatingFor, setGeneratingFor] = useState(null);
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvingSuggestion, setApprovingSuggestion] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isMaker = family?.creatorId === user?.id || family?.members?.some(member => member.userId === user?.id && member.role === 'maker');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const famRes = await api.get('/family/mine');
      if (!famRes.data.family) { toast.error('Join a family first'); navigate('/family'); return; }
      setFamily(famRes.data.family);
      const evtRes = await api.get(`/events/family/${famRes.data.family.id}`);
      setEvents(evtRes.data || []);
    } catch { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const res = await api.post('/events', { ...newEvent, familyId: family.id });
      setEvents([res.data, ...events]);
      setNewEvent({ name: '', date: '', description: '', eventType: 'dawat', guestCount: 8 });
      setShowCreate(false);
      toast.success('Event created');
    } catch { toast.error('Failed to create event'); }
    finally { setSubmitting(false); }
  };

  const handleSuggest = async (e, eventId) => {
    e.preventDefault(); if (!suggestion.trim()) return;
    try { await api.post(`/events/${eventId}/suggest`, { recipeName: suggestion }); setSuggestion(''); toast.success('Suggestion added'); fetchData(); }
    catch { toast.error('Failed to add suggestion'); }
  };

  const getEventIdeas = async (event) => {
    setGeneratingFor(event.id);
    try {
      const [inventory, familyData] = await Promise.all([
        api.get('/inventory').catch(() => ({ data: [] })),
        api.get('/family/mine').catch(() => ({ data: null }))
      ]);
      const household = familyData.data?.family || familyData.data;
      const allergies = [...new Set((household?.members || []).flatMap(member => listValue(member.user?.allergies)))];
      const dislikes = [...new Set((household?.members || []).flatMap(member => {
        return listValue(member.user?.dislikes);
      }))];
      const { data } = await api.post('/ai/suggest-recipes', {
        familyId: family.id,
        inventory: inventory.data || [], servings: event.guestCount || 8, occasion: event.eventType || 'dawat',
        familyAllergies: allergies, dislikes,
        preferences: listValue(household?.dietaryPreferences)
      });
      setEventIdeas(prev => ({ ...prev, [event.id]: data.recipes || [] }));
      if (!data.recipes?.length) toast('No safe recipe ideas found. Check dietary needs and try again.');
    } catch { toast.error('Could not find event recipe ideas'); }
    finally { setGeneratingFor(null); }
  };

  const addIdeaToEvent = async (event, recipe) => {
    try {
      const saved = await api.post('/recipes', {
        name: recipe.name, ingredients: recipe.ingredients, instructions: recipe.instructions,
        prepTime: recipe.prepTime, cookTime: recipe.cookTime, servings: recipe.servings,
        image: recipe.image || null, sourceUrl: recipe.sourceUrl, nutrition: recipe.nutrition
      });
      await api.post(`/events/${event.id}/suggest`, { recipeName: recipe.name, recipeId: saved.data.id });
      setEventIdeas(prev => ({ ...prev, [event.id]: (prev[event.id] || []).filter(item => item.name !== recipe.name) }));
      toast.success('Recipe added to this event’s family vote');
      fetchData();
    } catch { toast.error('Could not add this recipe to the event'); }
  };

  const addIdeaToCalendar = async (event, recipe) => {
    try {
      const eventDate = String(event.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
        toast.error('This event needs a valid date before a recipe can be added.');
        return;
      }
      const saved = await api.post('/recipes', {
        name: recipe.name, ingredients: recipe.ingredients, instructions: recipe.instructions,
        prepTime: recipe.prepTime, cookTime: recipe.cookTime, servings: recipe.servings,
        image: recipe.image || null, sourceUrl: recipe.sourceUrl, nutrition: recipe.nutrition
      });
      await api.post('/weeklyMenu', { date: eventDate, recipeId: saved.data.id, familyId: family.id, eventId: event.id, servings: event.guestCount || 4 });
      toast.success(`Added ${recipe.name} to ${event.name} on its event date`);
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Could not add to calendar'); }
  };

  const handleVote = async (id) => {
    try { await api.post(`/events/suggestions/${id}/vote`); toast.success('Vote recorded'); fetchData(); }
    catch { toast.error('Failed to vote'); }
  };

  const handleFinalize = async (event) => {
    if (!event.suggestions?.length) { toast.error('Add a dish suggestion first'); return; }
    const topScore = Math.max(0, ...(event.suggestions || []).map(item => item.voteCount || 0));
    if (!topScore) { toast.error('No votes yet. To skip voting, use “Approve & add to meal plan” beside a dish.'); return; }
    const suggestionIds = event.suggestions.filter(item => item.voteCount === topScore).map(item => item.id);
    try {
      const { data } = await api.patch(`/events/${event.id}/finalize`, { suggestionIds });
      toast.success(data.message || 'Event menu finalized'); fetchData();
    } catch { toast.error('Failed to finalize'); }
  };

  const approveSuggestion = async (suggestionItem) => {
    setApprovingSuggestion(suggestionItem.id);
    try {
      const { data } = await api.post(`/events/suggestions/${suggestionItem.id}/approve`);
      toast.success(data.message || `${suggestionItem.recipeName} approved and added to the meal plan`);
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Could not approve this meal'); }
    finally { setApprovingSuggestion(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="page-shell max-w-4xl space-y-6">

      {/* Header */}
      <div className="page-heading flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/family" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="page-title">Special Dinners</h1>
            <p className="page-subtitle">Plan Eid feasts, birthday parties & family gatherings</p>
          </div>
        </div>
        {isMaker && <button onClick={() => setShowCreate(!showCreate)} className="btn-primary">
          <PlusCircle className="w-4 h-4" /> New Event
        </button>}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-6 fade-in">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">Create New Event</h2>
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Event Name</label>
                <input required type="text" className="input" placeholder="e.g. Eid Dinner, Birthday Party"
                  value={newEvent.name} onChange={e => setNewEvent({ ...newEvent, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Date</label>
                <input required type="date" className="input"
                  value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} />
              </div>
              <div>
                <label className="label">What are you celebrating?</label>
                <select className="input" value={newEvent.eventType} onChange={e => setNewEvent({ ...newEvent, eventType: e.target.value })}>
                  <option value="eid">Eid</option><option value="birthday">Birthday</option><option value="dawat">Dawat</option><option value="gathering">Family gathering</option><option value="other">Other occasion</option>
                </select>
              </div>
              <div>
                <label className="label">How many guests?</label>
                <input className="input" type="number" min="1" max="500" value={newEvent.guestCount} onChange={e => setNewEvent({ ...newEvent, guestCount: Math.min(500, Math.max(1, Number(e.target.value) || 1)) })} />
              </div>
            </div>
            <div>
              <label className="label">Description <span className="normal-case font-normal text-slate-400">(optional)</span></label>
              <textarea className="input min-h-[80px] resize-none" placeholder="Event details, guest count, requirements…"
                value={newEvent.description} onChange={e => setNewEvent({ ...newEvent, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                Create Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events list */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">No events planned yet</p>
            <p className="text-sm text-slate-400 mt-1">Create your first family event to start planning the menu</p>
            {isMaker ? <button onClick={() => setShowCreate(true)} className="btn-primary mt-5">Create First Event</button> : <p className="mt-3 text-sm text-slate-600">Your meal planner can add a family event here.</p>}
          </div>
        ) : events.map(evt => {
          const isExpanded  = expandedId === evt.id;
          const isFinalized = (evt.suggestions || []).some(item => item.isFinal) || (evt.weeklyMenus || []).length > 0;
          const sorted      = [...(evt.suggestions || [])].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
          const selectedMenu = evt.weeklyMenus || [];

          return (
            <div key={evt.id}
              className={`bg-white border rounded-2xl overflow-hidden shadow-card transition-all ${isFinalized ? 'border-emerald-200' : 'border-slate-200'}`}>
              {/* Header row */}
              <div className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : evt.id)}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isFinalized ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                    {isFinalized
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      : <CalendarDays className="w-5 h-5 text-slate-500" />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{evt.name}</h3>
                      {isFinalized && <span className="badge-green text-[10px]">Finalized</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(evt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                      <span className="mx-1">·</span>
                      <Star className="w-3 h-3" /> {evt.suggestions?.length || 0} recipes · {evt.guestCount || 4} guests
                    </p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-5 bg-slate-50/40 fade-in">
                  {evt.description && (
                    <p className="text-sm text-slate-600 bg-white border border-slate-200 rounded-xl p-3 mb-5">{evt.description}</p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3 mb-5">
                    <p className="text-sm text-orange-950"><strong>{({ eid: 'Eid', birthday: 'Birthday', dawat: 'Dawat', gathering: 'Gathering' }[evt.eventType] || 'Event')}</strong> menu for {evt.guestCount || 4} people</p>
                    {isMaker && <button onClick={() => getEventIdeas(evt)} disabled={generatingFor === evt.id} className="btn-primary text-sm">
                      <Sparkles className="w-4 h-4" /> {generatingFor === evt.id ? 'Finding dishes…' : 'Suggest event recipes'}
                    </button>}
                  </div>
                  {selectedMenu.length > 0 && <section className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h4 className="font-bold text-emerald-950">Selected event menu</h4><p className="text-xs text-emerald-800">These dishes are on the meal plan for this event.</p></div>
                      <Link to={`/weekly-menu?date=${String(evt.date).slice(0, 10)}`} className="btn-primary text-xs">Open plan to cook</Link>
                    </div>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">{selectedMenu.map(item => <li key={item.id} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-800"><strong>{item.recipe?.name || 'Meal'}</strong><span className="ml-2 text-xs text-slate-500">{item.mealType || 'Dinner'} · {item.servings || evt.guestCount || 4} servings{['completed', 'cooked'].includes(item.status) ? ' · cooked' : ''}</span></li>)}</ul>
                  </section>}
                  {!!eventIdeas[evt.id]?.length && (
                    <div className="grid md:grid-cols-2 gap-3 mb-5">
                      {eventIdeas[evt.id].map(idea => (
                        <div key={idea.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                          <RecipePhoto recipe={idea} alt={idea.name} className="h-36 w-full object-cover" />
                          <div className="p-3">
                            <h4 className="font-bold text-slate-900">{idea.name}</h4>
                            <p className="text-xs text-slate-600 mt-1">For {evt.guestCount || 4}{idea.nutrition?.calories ? ` · approx. ${idea.nutrition.calories} kcal/person` : ' · nutrition details unavailable'}</p>
                            {idea.sourceUrl && <a href={idea.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-slate-600 underline">Recipe/photo: {idea.source || 'TheMealDB'}</a>}
                            <div className="mt-3 flex gap-2">
                              <button onClick={() => addIdeaToEvent(evt, idea)} className="btn-primary text-xs flex-1">Send for a vote</button>
                              {isMaker && <button onClick={() => addIdeaToCalendar(evt, idea)} className="btn-secondary text-xs flex-1">Add to this event</button>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Suggestions column */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                        <Star className="w-3.5 h-3.5 text-amber-500" /> Menu Suggestions
                      </h4>
                      {!isFinalized && (
                        <form onSubmit={(e) => handleSuggest(e, evt.id)} className="flex gap-2 mb-3">
                          <input type="text" className="input flex-1 text-sm py-2" placeholder="Suggest a dish…"
                            value={suggestion} onChange={e => setSuggestion(e.target.value)} />
                          <button type="submit" className="btn-primary text-xs px-3 py-2 whitespace-nowrap">Add</button>
                        </form>
                      )}
                      <ul className="space-y-2">
                        {sorted.map((sugg, idx) => (
                          <li key={sugg.id}
                            className={`flex items-center justify-between p-3 rounded-xl border text-sm ${
                              sugg.isFinal ? 'bg-emerald-50 border-emerald-200' :
                              idx === 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'
                            }`}>
                            <div className="flex min-w-0 items-center gap-2">
                              {sugg.recipe && <RecipePhoto recipe={sugg.recipe} alt={sugg.recipe.name} className="h-10 w-12 rounded-lg object-cover" />}
                              {idx === 0 && !isFinalized && <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              {sugg.isFinal && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                              <span className="truncate font-medium text-slate-800">{sugg.recipeName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">{sugg.voteCount || 0} votes</span>
                              {isMaker && (sugg.isFinal
                                ? <span className="text-xs font-semibold text-emerald-700">Approved</span>
                                : <button onClick={() => approveSuggestion(sugg)} disabled={approvingSuggestion === sugg.id} className="text-xs font-semibold text-primary-700 underline disabled:opacity-50">{approvingSuggestion === sugg.id ? 'Adding…' : 'Approve & add to meal plan'}</button>)}
                              {!isFinalized && (
                                <button onClick={() => handleVote(sugg.id)} disabled={sugg.myVote}
                                  className="text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200 px-2.5 py-1 rounded-lg hover:bg-primary-100 transition-colors disabled:cursor-default disabled:bg-emerald-50 disabled:text-emerald-800">
                                  {sugg.myVote ? 'Voted' : 'Vote'}
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                        {sorted.length === 0 && (
                          <p className="text-xs text-slate-400 italic text-center py-4">No suggestions yet. Be first!</p>
                        )}
                      </ul>
                    </div>

                    {/* Finalize column */}
                    {isMaker && <div className="flex flex-col justify-center">
                      {!isFinalized ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-card">
                          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="w-5 h-5 text-primary-600" />
                          </div>
                          <p className="text-sm font-semibold text-slate-800 mb-1">Ready to finalize?</p>
                          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                            Finalize the vote leaders, or approve a dish below to add it without a vote.
                          </p>
                          <button onClick={() => handleFinalize(evt)} className="btn-primary w-full py-2.5">
                            <Trophy className="w-4 h-4" /> Finalize Menu
                          </button>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          </div>
                          <p className="font-bold text-emerald-800 mb-1">Menu Finalized</p>
                          <p className="text-xs text-emerald-600 leading-relaxed">
                            The most-voted dishes are set for <strong>{evt.name}</strong>.
                          </p>
                        </div>
                      )}
                    </div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
