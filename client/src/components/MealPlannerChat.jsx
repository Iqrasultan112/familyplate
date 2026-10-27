import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChefHat, Clock3, LoaderCircle, Mic, MicOff, Plus, Send, ShoppingCart, Sparkles, Volume2, Vote, X } from 'lucide-react';
import api from '../lib/api';
import RecipePhoto from './RecipePhoto';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { sameIngredient } from '../lib/foodMatching';
import { addMissingRecipeIngredients } from '../lib/addMissingRecipeIngredients';
import RecipeVideoLinks from './RecipeVideoLinks';
import useRewardPoints from '../hooks/useRewardPoints';

const intro = {
  role: 'assistant',
  content: 'Assalam-o-alaikum! What should we cook today? Tell me what is in your pantry, how much time you have, or what your family feels like eating.',
  recipes: []
};
const quickPrompts = ['Ready in 30 minutes', 'Use what is in my pantry', 'Suggest a Pakistani dinner'];

export default function MealPlannerChat({ family, servings = 4, onSendToVote, compact = false, onClose, showPeopleControl = false, familyName = '', onServingsChange }) {
  const { user } = useAuthStore();
  const { award } = useRewardPoints(user?.id);
  const storageKey = useMemo(() => `familyplate:meal-chat:${family?.id || `personal:${user?.id || 'guest'}`}`, [family?.id, user?.id]);
  const [messages, setMessages] = useState([intro]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [votingRecipe, setVotingRecipe] = useState('');
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState('ur-PK');
  const [voiceError, setVoiceError] = useState('');
  const [pantryIsEmpty, setPantryIsEmpty] = useState(false);
  const [addingShoppingFor, setAddingShoppingFor] = useState('');
  const [addingPlanFor, setAddingPlanFor] = useState('');
  const [plannedRecipes, setPlannedRecipes] = useState({});
  const [planMealType, setPlanMealType] = useState('Dinner');
  const mediaRecorderRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const conversationContainerRef = useRef(null);
  const latestAssistantRef = useRef(null);
  const composerInputRef = useRef(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      setMessages(Array.isArray(saved) && saved.length ? saved : [intro]);
    } catch { setMessages([intro]); }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-30))); } catch { /* chat remains available for this visit */ }
  }, [messages, storageKey]);

  useEffect(() => {
    if (family?.id) { setPantryIsEmpty(false); return; }
    let active = true;
    api.get('/inventory')
      .then(({ data }) => { if (active) setPantryIsEmpty(!Array.isArray(data) || data.length === 0); })
      .catch(() => {})
    return () => { active = false; };
  }, [family?.id]);

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel?.();
  }, []);

  useEffect(() => {
    const container = conversationContainerRef.current;
    if (!container || (messages.length <= 1 && !sending)) return;
    if (messages.at(-1)?.role === 'assistant' && latestAssistantRef.current) {
      const containerTop = container.getBoundingClientRect().top;
      const answerTop = latestAssistantRef.current.getBoundingClientRect().top;
      container.scrollTo({ top: container.scrollTop + answerTop - containerTop - 12, behavior: 'smooth' });
    } else {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, sending]);

  const startVoiceInput = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError('Voice recording is not available in this browser. You can still type your message.');
      return;
    }
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      microphoneStreamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data?.size) audioChunksRef.current.push(event.data); };
      recorder.onerror = () => {
        stream.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
        setListening(false);
        setTranscribing(false);
        setVoiceError('The microphone recording stopped. Please try again or type your message.');
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
        setListening(false);
        setTranscribing(true);
        setVoiceError('Transcribing your voice note…');
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1000) {
          setTranscribing(false);
          setVoiceError('I did not capture enough audio. Hold the microphone on a little longer.');
          return;
        }
        const form = new FormData();
        form.append('audio', blob, `meal-chat.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
        form.append('language', voiceLanguage.slice(0, 2));
        try {
          const { data } = await api.post('/ai/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 70000 });
          const transcript = String(data.text || '').trim();
          if (!transcript) throw new Error('No spoken words were detected. Please try again.');
          setVoiceError('');
          setDraft(transcript);
          await send(transcript, true);
        } catch (error) {
          setVoiceError(error.response?.data?.error || error.message || 'Could not transcribe this voice note. Please type your message instead.');
        } finally { setTranscribing(false); }
      };
      recorder.start();
      setListening(true);
    } catch (error) {
      setListening(false);
      microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
      setVoiceError(error.name === 'NotAllowedError'
        ? 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.'
        : 'The microphone could not start. Check that it is connected and enabled, then try again.');
    }
  };

  const readAloud = text => {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setVoiceError('Voice playback is not available in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = voiceLanguage;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const send = async (text = draft, speakReply = false) => {
    const content = String(text || '').trim();
    if (!content || sending) return;
    const history = messages.filter((item, index) => !(index === 0 && item.role === 'assistant' && item.content === intro.content)).slice(-10);
    const currentRecipe = [...messages].reverse().find(item => item.role === 'assistant' && item.recipes?.length)?.recipes?.[0] || null;
    const nextMessages = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setDraft('');
    if (composerInputRef.current) composerInputRef.current.style.height = '56px';
    setSending(true);
    try {
      const { data } = await api.post('/ai/meal-chat', {
        ...(family?.id ? { familyId: family.id } : {}),
        servings,
        message: content,
        history: history.map(item => ({ role: item.role, content: item.content, recipes: (item.recipes || []).map(recipe => recipe.name).filter(Boolean) })),
        recipeToAdd: currentRecipe
      });
      setMessages(current => [...current, {
        role: 'assistant',
        content: data.reply ?? 'Here is an idea for your meal.',
        recipes: Array.isArray(data.recipes) ? data.recipes : [],
        videoLinks: Array.isArray(data.videoLinks) ? data.videoLinks : [],
        videoRecipeName: data.videoRecipeName || '',
        menuAction: data.menuAction || null,
        historyUsed: data.historyUsed
      }]);
      setPantryIsEmpty(Boolean(data.pantryEmpty));
      if (speakReply) readAloud(data.reply || 'Here is an idea for your meal.');
    } catch (error) {
      setMessages(current => [...current, {
        role: 'assistant',
        content: error.response?.data?.error || 'I could not reach the meal assistant. Please try again.',
        recipes: [],
        error: true
      }]);
    } finally { setSending(false); }
  };

  const reset = () => {
    setMessages([intro]);
    if (storageKey) localStorage.removeItem(storageKey);
  };

  const sendForVote = async recipe => {
    if (!onSendToVote) return;
    setVotingRecipe(recipe.name);
    try { await onSendToVote(recipe); }
    finally { setVotingRecipe(''); }
  };

  const addMissingToShoppingList = async recipe => {
    const missing = (recipe.ingredients || []).filter(item => item?.inPantry === false || item?.inPantry === 0 || item?.inPantry === 'false');
    if (!missing.length) {
      toast('No missing ingredients found for this recipe.');
      return 0;
    }
    setAddingShoppingFor(recipe.name);
    try {
      const { data: currentItems } = await api.get('/shopping');
      const pendingNames = (Array.isArray(currentItems) ? currentItems : [])
        .filter(item => !item.isPurchased)
        .map(item => item.ingredient || item.name || '');
      const items = missing
        .map(item => ({ ingredient: typeof item === 'string' ? item : item.name || item.ingredient, quantity: item.quantity || item.amount || '1' }))
        .filter(item => item.ingredient && !pendingNames.some(name => sameIngredient(name, item.ingredient)));
      if (!items.length) {
        toast('These missing ingredients are already on your shopping list.');
        return 0;
      }
      try {
        await api.post('/shopping/bulk', { items });
      } catch {
        for (const item of items) await api.post('/shopping', item);
      }
      const earned = award(`shopping:${recipe.name}:${Date.now()}`, 5);
      toast.success(`${items.length} missing item${items.length === 1 ? '' : 's'} added to your shopping list${earned ? ' · +5 points' : ''}.`);
      return items.length;
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not add items. Please try again.');
      return 0;
    } finally { setAddingShoppingFor(''); }
  };

  const addRecipeToToday = async (recipe, recipeKey) => {
    const planKey = `${recipeKey}:${planMealType}`;
    if (plannedRecipes[planKey] || addingPlanFor) return;
    setAddingPlanFor(planKey);
    try {
      const ingredients = (recipe.ingredients || []).map(item => typeof item === 'string'
        ? { name: item, quantity: 'Not specified' }
        : { name: item.name || item.ingredient || '', quantity: item.quantity || item.amount || 'Not specified' });
      const instructions = (recipe.instructions || []).map(step => String(step || '').trim()).filter(Boolean);
      if (!instructions.length) throw new Error('Ask me to show the full recipe before adding it to your plan.');
      const { data: savedRecipe } = await api.post('/recipes', {
        name: recipe.name,
        ingredients,
        instructions,
        prepTime: recipe.prepTime || 'Not specified',
        cookTime: recipe.cookTime || 'Not specified',
        servings: String(recipe.servings || servings),
        image: recipe.image || null,
        sourceUrl: recipe.sourceUrl || null,
        nutrition: recipe.nutrition || null
      });
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const { data: plannedMeal } = await api.post('/weeklyMenu', {
        recipeId: savedRecipe.id,
        date,
        mealType: planMealType,
        servings: Number.parseInt(recipe.servings, 10) || servings,
        ...(family?.id ? { familyId: family.id } : {})
      });
      if (award(`planned:${plannedMeal.id}`, 10)) toast.success('Meal planned · +10 points');
      setPlannedRecipes(previous => ({ ...previous, [planKey]: true }));
      let shoppingCount = 0;
      try { shoppingCount = await addMissingRecipeIngredients(savedRecipe.id); }
      catch (error) { toast.error(error.response?.data?.error || 'The meal was planned, but missing items could not be added to your shopping list.'); }
      toast.success(`${recipe.name} added to today’s ${planMealType.toLowerCase()}${shoppingCount ? `; ${shoppingCount} missing item${shoppingCount === 1 ? '' : 's'} added to your shopping list` : ''}.`);
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Could not add this recipe to today’s plan.');
    } finally { setAddingPlanFor(''); }
  };

  return (
    <section className={`flex min-h-0 flex-col overflow-hidden bg-transparent ${compact ? 'h-full' : 'flex-1'}`} aria-labelledby="meal-chat-title">
      {showPeopleControl ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-primary-200 bg-white px-4 py-2 sm:px-6">
          <div className="min-w-0"><h2 id="meal-chat-title" className="text-sm font-bold text-primary-950">Meal helper · Aaj kya pakayen?</h2><p className="truncate text-xs text-primary-600">{familyName || family?.name || 'Your kitchen'}</p></div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-primary-800" htmlFor="chat-servings">People<input id="chat-servings" type="number" min="1" max="30" value={servings} onChange={onServingsChange} className="input min-h-8 w-12 px-1 py-1 text-center text-sm" /></label>
            <button type="button" onClick={reset} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary-800 transition hover:bg-primary-50" aria-label="Start a new chat"><Plus className="h-4 w-4" /> New chat</button>
          </div>
        </div>
      ) : <div className="flex shrink-0 items-center justify-between gap-3 border-b border-primary-200 px-3 py-2 sm:px-4">
        <h2 id="meal-chat-title" className="text-base font-bold text-primary-950 sm:text-lg">Meal chat</h2>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary-800 transition hover:bg-primary-50" aria-label="Start a new chat"><Plus className="h-5 w-5" /> New chat</button>
          {onClose && <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl text-primary-700 transition hover:bg-primary-50" aria-label="Close meal chat"><X className="h-5 w-5" /></button>}
        </div>
      </div>}

      <div ref={conversationContainerRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#fffdfa] p-3 sm:p-4" aria-live="polite" aria-relevant="additions">
        {pantryIsEmpty && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">Your pantry is empty. I can still suggest meals; use <strong>Add missing items to shopping list</strong> on a recipe to get what you need.</p>}
        {messages.map((message, index) => (
          <div ref={index === messages.length - 1 && message.role === 'assistant' ? latestAssistantRef : undefined} key={index + '-' + message.role} className={'scroll-mt-4 flex items-start gap-3 ' + (message.role === 'user' ? 'justify-end' : 'justify-start')}>
            {message.role === 'assistant' && <div className="mt-6 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-800 text-white shadow-sm"><Bot className="h-5 w-5" /></div>}
            <div className={message.role === 'user' ? 'w-fit max-w-[88%] space-y-1.5' : 'w-full max-w-[min(100%,48rem)] space-y-1.5'}>
              <p className={'px-1 text-xs font-bold uppercase tracking-wide ' + (message.role === 'user' ? 'text-right text-primary-700' : 'text-primary-800')}>{message.role === 'user' ? 'You' : 'FamilyPlate assistant'}</p>
              <div className={'rounded-2xl px-4 py-3 sm:px-5 ' + (message.role === 'user' ? 'rounded-tr-md bg-primary-800 text-white shadow-sm' : 'rounded-tl-md border border-primary-200 bg-white text-primary-950 shadow-sm')}>
                {message.content && <p className="whitespace-pre-wrap break-words text-[15px] leading-7">{message.content}</p>}
                {message.videoLinks?.length > 0 && <RecipeVideoLinks recipeName={message.videoRecipeName} links={message.videoLinks} compact showHeading={Boolean(message.content)} />}
                {message.role === 'assistant' && message.content && <button type="button" onClick={() => readAloud(message.content)} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary-700 hover:bg-primary-50" aria-label="Read this answer aloud"><Volume2 className="h-4 w-4" /> Read aloud</button>}
              </div>
              {(message.recipes || []).map((recipe, recipeIndex) => {
                const recipeKey = `${index}-${recipeIndex}`;
                const planKey = `${recipeKey}:${planMealType}`;
                const canAddToPlan = !family?.id || user?.role === 'maker' || family?.creatorId === user?.id;
                return <article key={recipe.name + '-' + recipeIndex} className="overflow-hidden rounded-2xl border border-primary-200 bg-white text-primary-950 shadow-card">
                  <RecipePhoto recipe={recipe} alt={recipe.name} loading="lazy" className="h-44 w-full object-cover sm:h-52" />
                  <div className="flex items-center gap-2 border-b border-primary-200 bg-primary-50 px-4 py-3"><ChefHat className="h-5 w-5 text-primary-800" /><h3 className="text-sm font-bold text-primary-950">Meal idea{message.recipes.length > 1 ? ' ' + (recipeIndex + 1) : ''}</h3></div>
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h4 className="text-lg font-bold">{recipe.name}</h4>{recipe.description && <p className="mt-1 text-base leading-6 text-primary-800">{recipe.description}</p>}</div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-900"><Clock3 className="h-4 w-4" />{recipe.prepTime || 'Prep n/a'} + {recipe.cookTime || 'Cook n/a'}</span>
                    </div>
                    <RecipeVideoLinks recipeName={recipe.name} compact />
                    {Number.isFinite(recipe.pantryCoverage) && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-950">{pantryIsEmpty ? 'Your pantry is empty, so all listed ingredients need to be bought.' : `${recipe.pantryCoverage}% of ingredients are at home${recipe.missingIngredients?.length ? '. You may need: ' + recipe.missingIngredients.join(', ') : '. You have everything listed.'}`}</p>}
                    <div className="mt-4"><p className="text-base font-bold text-primary-950">Ingredients <span className="font-normal text-primary-700">for {recipe.servings || servings} people</span></p>
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">{(recipe.ingredients || []).map((ingredient, ingredientIndex) => <li key={ingredient.name + '-' + ingredientIndex} className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-primary-50 px-3 py-2 text-sm"><span className="font-medium">{ingredient.name} · {ingredient.quantity}</span><span className={'shrink-0 text-xs font-bold ' + (ingredient.inPantry ? 'text-emerald-900' : 'text-amber-900')}>{ingredient.inPantry ? 'At home' : 'Need to get'}</span></li>)}</ul>
                    </div>
                    {(recipe.instructions || []).length > 0 && <details className="mt-4 rounded-xl border border-primary-200"><summary className="cursor-pointer px-4 py-3 text-base font-semibold text-primary-900">Cooking steps <span className="text-sm font-normal text-primary-700">(tap to open)</span></summary><ol className="list-decimal space-y-2 border-t border-primary-100 px-4 py-3 pl-9 text-base leading-7">{recipe.instructions.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol></details>}
                    {(recipe.ingredients || []).some(item => item.inPantry === false) && <button type="button" onClick={() => addMissingToShoppingList(recipe)} disabled={Boolean(addingShoppingFor)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary-300 bg-white px-4 py-2 text-sm font-semibold text-primary-900 hover:bg-primary-50 disabled:opacity-60"><ShoppingCart className="h-4 w-4" />{addingShoppingFor === recipe.name ? 'Adding…' : 'Add missing items to shopping list'}</button>}
                    {recipe.nutrition && <p className="mt-3 text-sm leading-6 text-primary-700">Per serving: {recipe.nutrition.calories} calories · Protein {recipe.nutrition.proteinG} g · Carbs {recipe.nutrition.carbsG} g · Fat {recipe.nutrition.fatG} g</p>}
                    {message.menuAction?.status === 'added' && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-900">Added to your menu: {message.menuAction.date} · {message.menuAction.mealType}</p>}
                    {canAddToPlan && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-primary-100 pt-4">
                      <label htmlFor={`meal-slot-${recipeKey}`} className="text-sm font-semibold text-primary-900">Add to today’s</label>
                      <select id={`meal-slot-${recipeKey}`} value={planMealType} onChange={event => setPlanMealType(event.target.value)} className="min-h-10 rounded-xl border border-primary-300 bg-white px-3 text-sm text-primary-950">
                        {['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Side dish'].map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <button type="button" onClick={() => addRecipeToToday(recipe, recipeKey)} disabled={Boolean(addingPlanFor) || Boolean(plannedRecipes[planKey])} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary-800 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60">
                        <Plus className="h-4 w-4" />{addingPlanFor === planKey ? 'Adding…' : plannedRecipes[planKey] ? `Added to ${planMealType.toLowerCase()}` : 'Add to today’s plan'}
                      </button>
                    </div>}
                    {onSendToVote && <button type="button" onClick={() => sendForVote(recipe)} disabled={Boolean(votingRecipe)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-800 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-900 disabled:opacity-60"><Vote className="h-4 w-4" />{votingRecipe === recipe.name ? 'Sending…' : 'Ask family to vote'}</button>}
                  </div>
                </article>;
              })}
            </div>
          </div>
        ))}
        {sending && <div className="flex items-center gap-3 pl-12 text-base font-medium text-primary-800"><LoaderCircle className="h-5 w-5 animate-spin" />Checking your pantry and meal history…</div>}
        {messages.length <= 1 && <div className="pl-12"><p className="mb-2 text-sm font-semibold text-primary-700">Start with one of these, or type your own:</p><div className="flex flex-wrap gap-2">{quickPrompts.map(prompt => <button key={prompt} type="button" onClick={() => send(prompt)} disabled={sending} className="min-h-10 rounded-xl border border-primary-200 bg-white px-3 py-2 text-left text-sm font-semibold text-primary-900 shadow-sm hover:border-primary-400 hover:bg-primary-50 disabled:opacity-50"><Sparkles className="mr-1.5 inline h-4 w-4 text-primary-700" />{prompt}</button>)}</div></div>}
        {messages.length > 1 && messages.at(-1)?.role === 'assistant' && !messages.at(-1)?.error && !sending && <div className="pl-12"><div className="flex flex-wrap gap-2">{['Another idea', 'Show full recipe'].map(prompt => <button key={prompt} type="button" onClick={() => send(prompt)} className="min-h-9 rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-sm font-semibold text-primary-800 hover:bg-primary-50">{prompt}</button>)}</div></div>}
      </div>

      <form onSubmit={event => { event.preventDefault(); send(); }} className={'shrink-0 bg-[#fffaf5] ' + (compact ? 'border-t border-primary-200 p-2 sm:px-3 sm:pb-2 sm:pt-2' : 'border-t border-primary-200 px-3 pb-3 pt-2 sm:px-6')}>
        <label htmlFor="meal-planner-message" className="sr-only">Your message</label>
        <div className={compact ? 'rounded-xl border border-primary-200 bg-[#fffdfa] p-2 shadow-sm focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100' : 'mx-auto w-full max-w-5xl rounded-2xl border border-primary-200 bg-[#fffdfa] px-3 pt-2 pb-2 shadow-[0_-5px_18px_rgba(72,37,28,0.05)] focus-within:border-primary-400 sm:px-4'}>
        <textarea ref={composerInputRef} id="meal-planner-message" rows={1} value={draft} onChange={event => { setDraft(event.target.value); event.target.style.height = '44px'; event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} disabled={sending} placeholder="Tell me what you want, what to avoid, or how much time you have…" className="meal-chat-input block max-h-[120px] min-h-11 w-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 text-sm leading-5 text-primary-950 placeholder:text-primary-500 focus:outline-none focus:ring-0 disabled:opacity-50" />
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-primary-100 pt-1.5">
          <div className="flex items-center gap-1.5"><label className="sr-only" htmlFor="meal-voice-language">Voice language</label><select id="meal-voice-language" value={voiceLanguage} onChange={event => setVoiceLanguage(event.target.value)} disabled={listening || transcribing} className="input min-h-9 w-auto bg-white px-2 text-xs" aria-label="Voice language"><option value="ur-PK">Urdu voice</option><option value="hi-IN">Hindi voice</option><option value="en-IN">English voice</option></select><button type="button" onClick={listening ? () => mediaRecorderRef.current?.stop?.() : startVoiceInput} disabled={sending || transcribing} className={'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ' + (listening ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-primary-300 bg-white text-primary-900') + ' disabled:opacity-50'} aria-label={listening ? 'Stop voice input' : 'Speak your message'}>{listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}<span>{listening ? 'Stop' : transcribing ? 'Transcribing…' : 'Speak'}</span></button></div>
          <button type="submit" disabled={!draft.trim() || sending} className="btn-primary min-h-9 px-3 text-sm"><Send className="h-3.5 w-3.5" /><span className="hidden sm:inline">Send</span></button>
        </div>
        </div>
      </form>
      {voiceError && <p role="status" className="px-4 pb-2 text-xs text-amber-800">{voiceError}</p>}
    </section>
  );
}
