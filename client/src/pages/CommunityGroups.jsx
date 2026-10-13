import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, MessagesSquare, Mic, Plus, Send, Square, Users, Utensils, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useAuthStore from '../store/authStore';

export default function CommunityGroups() {
  const [groups, setGroups] = useState([]);
  const [activeGroup, setActiveGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [shareAsRecipe, setShareAsRecipe] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState('relatives');
  const [inviteCode, setInviteCode] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('ur-PK');
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceDraft, setIsVoiceDraft] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingRecipeMessage, setSavingRecipeMessage] = useState(null);
  const [savedMessageRecipes, setSavedMessageRecipes] = useState({});
  const endRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const keepListeningRef = useRef(false);
  const restartTimerRef = useRef(null);
  const recognitionErrorRef = useRef('');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const loadGroups = async () => {
    try { const { data } = await api.get('/groups'); setGroups(data); }
    catch { toast.error('Could not load your groups'); }
  };
  useEffect(() => { loadGroups(); }, []);

  const loadMessages = async (groupId) => {
    try { const { data } = await api.get(`/groups/${groupId}/messages`); setMessages(data); }
    catch { toast.error('Could not load this group chat'); }
  };
  useEffect(() => {
    if (!activeGroup) return;
    loadMessages(activeGroup.id);
    const timer = setInterval(() => loadMessages(activeGroup.id), 4000);
    return () => clearInterval(timer);
  }, [activeGroup?.id]);
  useEffect(() => () => {
    keepListeningRef.current = false;
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      try { recognition.stop(); } catch { /* It may already have stopped. */ }
    }
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const createGroup = async (e) => {
    e.preventDefault(); if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/groups', { name: newName.trim(), kind: newKind });
      setNewName(''); setActiveGroup(data); await loadGroups();
      toast.success('Group created. Share its invite code with your family and friends.');
    } catch (error) { toast.error(error.response?.data?.error || 'Could not create group'); }
    finally { setCreating(false); }
  };

  const joinGroup = async (e) => {
    e.preventDefault(); if (!inviteCode.trim()) return;
    try {
      const { data } = await api.post('/groups/join', { inviteCode });
      setInviteCode(''); await loadGroups();
      const joined = await api.get('/groups');
      const group = joined.data.find(item => item.id === data.groupId);
      if (group) setActiveGroup(group);
      toast.success(data.message);
    } catch (error) { toast.error(error.response?.data?.error || 'That code did not work'); }
  };

  const sendMessage = async (e, content = message, kind = isVoiceDraft ? 'voice' : 'text') => {
    e?.preventDefault();
    if (!activeGroup || !content.trim()) return;
    try {
      const { data } = await api.post(`/groups/${activeGroup.id}/messages`, { content: content.trim(), kind });
      setMessages(previous => [...previous, data]); setMessage(''); setShareAsRecipe(false); setIsVoiceDraft(false); transcriptRef.current = '';
    } catch (error) { toast.error(error.response?.data?.error || 'Could not send your message'); }
  };

  const handleComposeSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (shareAsRecipe) {
      navigate('/recipes/ai', { state: { initialText: message.trim(), targetGroupId: activeGroup?.id } });
      return;
    }
    sendMessage(e);
  };

  const turnMessageIntoRecipe = async item => {
    setSavingRecipeMessage(item.id);
    try {
      const { data: draft } = await api.post('/ai/structure', { rawText: item.content });
      const { data: saved } = await api.post('/recipes', {
        name: draft.name,
        ingredients: draft.ingredients,
        instructions: draft.instructions,
        prepTime: draft.prepTime,
        cookTime: draft.cookTime,
        servings: draft.servings,
        image: draft.image || null,
        sourceUrl: draft.sourceUrl || null,
        nutrition: draft.nutrition || null
      });
      setSavedMessageRecipes(previous => ({ ...previous, [item.id]: saved.id }));
      toast.success('Recipe saved to your recipes');
      navigate(`/recipes/${saved.id}`);
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Could not turn this message into a recipe');
    } finally { setSavingRecipeMessage(null); }
  };

  const recordVoice = () => {
    if (recognitionRef.current) {
      keepListeningRef.current = false;
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
        recognitionRef.current = null;
        setIsRecording(false);
        if (transcriptRef.current.trim()) {
          setMessage(transcriptRef.current);
          setIsVoiceDraft(true);
          toast.success(shareAsRecipe ? 'Recipe transcript ready. Review it, then make and share the recipe.' : 'Voice transcript ready. Review it, then send.');
        } else toast.error('No words were captured. Try again, speaking after the microphone turns on.');
        return;
      }
      try { recognitionRef.current.stop(); } catch { recognitionRef.current = null; setIsRecording(false); toast.error('Voice input could not stop. Please try again.'); }
      return;
    }
    if (!activeGroup) return toast.error('Choose a group before recording a voice note.');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return toast.error('Voice input is not available in this browser. Try Chrome or Edge, or type your message.');
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    transcriptRef.current = message.trim();
    recognitionErrorRef.current = '';
    keepListeningRef.current = true;
    recognition.lang = voiceLanguage;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      let finalWords = '';
      let interimWords = '';
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const words = result?.[0]?.transcript || '';
        if (result?.isFinal) finalWords += `${words} `;
        else interimWords += `${words} `;
      }
      if (finalWords.trim()) transcriptRef.current = `${transcriptRef.current} ${finalWords.trim()}`.trim();
      const transcript = `${transcriptRef.current} ${interimWords.trim()}`.trim();
      if (transcript) { setMessage(transcript); setIsVoiceDraft(true); }
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return; // Browsers time out during pauses; onend resumes listening.
      if (event.error === 'aborted' && !keepListeningRef.current) return;
      keepListeningRef.current = false;
      recognitionErrorRef.current = event.error || 'unknown';
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') toast.error('Microphone access is blocked. Allow it in the browser address-bar settings, then try again.');
      else if (event.error === 'audio-capture') toast.error('No working microphone was found. Check that it is connected and allowed.');
      else if (event.error === 'network') toast.error('The browser speech service lost its connection. Check the internet, or type your message.');
      else if (event.error === 'language-not-supported') toast.error('This voice language is unavailable. Choose another language and try again.');
      else if (event.error !== 'aborted') toast.error('Voice input was interrupted. Check microphone access, then try again.');
    };
    recognition.onend = () => {
      if (keepListeningRef.current && recognitionRef.current === recognition) {
        restartTimerRef.current = window.setTimeout(() => {
          restartTimerRef.current = null;
          if (!keepListeningRef.current || recognitionRef.current !== recognition) return;
          try { recognition.start(); }
          catch {
            keepListeningRef.current = false;
            recognitionErrorRef.current = 'start-failed';
            recognitionRef.current = null;
            setIsRecording(false);
            toast.error('Voice input could not resume. Tap the microphone to try again.');
          }
        }, 350);
        return;
      }
      setIsRecording(false);
      if (!recognitionErrorRef.current) {
        if (transcriptRef.current) {
          setMessage(transcriptRef.current);
          setIsVoiceDraft(true);
          toast.success(shareAsRecipe ? 'Recipe transcript ready. Review it, then make and share the recipe.' : 'Voice transcript ready. Review it, then send.');
        } else toast.error('No words were captured. Try again, speaking after the microphone turns on.');
      }
      recognitionErrorRef.current = '';
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    try { recognition.start(); }
    catch {
      keepListeningRef.current = false;
      recognitionRef.current = null;
      setIsRecording(false);
      toast.error('Could not start the microphone. Check browser permission and that no other app is using it.');
    }
  };

  const copyCode = async (code) => {
    try { await navigator.clipboard.writeText(code); toast.success('Invite code copied'); }
    catch { toast.error(`Invite code: ${code}`); }
  };

  return (
    <div className="page-shell space-y-5">
      <header className="page-heading flex items-center gap-3">
        <button onClick={() => navigate('/community')} className="btn-secondary p-2" aria-label="Back to community"><ArrowLeft className="w-4 h-4" /></button>
        <div><h1 className="page-title">Friends & relatives</h1><p className="page-subtitle">Private recipe chats for people across different families.</p></div>
      </header>
      <div className="grid lg:grid-cols-[320px_1fr] gap-5 items-start">
        <aside className="space-y-4">
          <form onSubmit={createGroup} className="card p-4 space-y-3">
            <h2 className="font-bold text-primary-950">Start a group</h2>
            <label className="sr-only" htmlFor="group-name">Group name</label>
            <input id="group-name" className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Sunday Dawat Club" maxLength={60} required />
            <div className="flex gap-2">
              <select className="input flex-1" value={newKind} onChange={e => setNewKind(e.target.value)} aria-label="Group type"><option value="relatives">Relatives</option><option value="friends">Friends</option><option value="other">Other group</option></select>
              <button disabled={creating} className="btn-primary shrink-0"><Plus className="w-4 h-4" /> Create</button>
            </div>
          </form>
          <form onSubmit={joinGroup} className="card p-4 space-y-3">
            <h2 className="font-bold text-primary-950">Join with an invite code</h2>
          <div className="flex gap-2"><label className="sr-only" htmlFor="invite-code">Invite code</label><input id="invite-code" className="input min-w-0" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Paste group code" maxLength={24} /><button className="btn-secondary">Join</button></div>
          </form>
          <section className="card p-3 space-y-2">
            <h2 className="px-2 py-1 text-sm font-bold text-primary-950">Your groups</h2>
            {groups.length === 0 ? <p className="px-2 pb-2 text-sm text-primary-600">Create a group or join with a code shared by someone you know.</p> : groups.map(group => (
              <button key={group.id} onClick={() => setActiveGroup(group)} className={`w-full rounded-xl p-3 text-left transition-colors ${activeGroup?.id === group.id ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-primary-50'}`}>
                <span className="flex items-center gap-2 font-semibold text-primary-950"><Users className="w-4 h-4 text-orange-700" /> {group.name}</span>
                <span className="ml-6 text-xs text-primary-600">{group._count?.members || 1} members · {group.kind}</span>
              </button>
            ))}
          </section>
          {activeGroup && <div className="rounded-xl border border-primary-200 bg-white p-3"><p className="text-xs font-semibold text-primary-700">Invite someone you trust</p><button className="mt-1 flex w-full items-center justify-between rounded-lg bg-primary-50 px-3 py-2 font-mono text-sm font-bold tracking-wider text-primary-950" onClick={() => copyCode(activeGroup.inviteCode)}>{activeGroup.inviteCode}<Copy className="h-4 w-4" /></button></div>}
        </aside>

        <section className="card flex min-h-[36rem] flex-col overflow-hidden">
          {!activeGroup ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><MessagesSquare className="h-12 w-12 text-orange-600" /><h2 className="mt-3 text-lg font-bold text-primary-950">Your private food circle</h2><p className="mt-1 max-w-sm text-sm text-primary-700">Choose a group to chat, or make one for relatives and friends. Only invited members can see its messages.</p></div> : <>
            <div className="flex items-center justify-between border-b border-primary-100 bg-orange-50/70 p-4"><div><h2 className="font-bold text-primary-950">{activeGroup.name}</h2><p className="text-xs text-primary-700">{activeGroup._count?.members || 'Group'} members · private chat</p></div><button onClick={() => setActiveGroup(null)} className="p-2 text-primary-600 lg:hidden" aria-label="Close chat"><X className="h-4 w-4" /></button></div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#fffdfa] p-4">
              {!messages.length && <p className="py-14 text-center text-sm text-primary-600">Say salam and share your first family recipe.</p>}
              {messages.map(item => {
                const mine = item.userId === user?.id;
                return <div key={item.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}><span className="mb-1 px-1 text-[11px] text-primary-600">{mine ? 'You' : item.user?.name || 'Member'}</span><div className={`max-w-[88%] rounded-2xl px-4 py-3 ${mine ? 'rounded-tr-sm bg-orange-700 text-white' : 'rounded-tl-sm border border-primary-100 bg-white text-primary-950'}`}>
                  {item.kind !== 'text' && <p className="mb-1 flex items-center gap-1 text-[11px] opacity-80">{item.kind === 'voice' ? <Mic className="h-3 w-3" /> : <Utensils className="h-3 w-3" />}{item.kind === 'voice' ? 'Voice note, transcribed' : 'Recipe to try'}</p>}
                  <p className="whitespace-pre-wrap break-words text-sm">{item.content}</p>
                  {(item.kind === 'recipe' || /ingredients|recipe|masala|cook|cup|spoon/i.test(item.content)) && (savedMessageRecipes[item.id]
                    ? <button onClick={() => navigate(`/recipes/${savedMessageRecipes[item.id]}`)} className={`mt-2 text-xs font-bold underline ${mine ? 'text-white' : 'text-orange-800'}`}>Open saved recipe</button>
                    : <button onClick={() => turnMessageIntoRecipe(item)} disabled={savingRecipeMessage === item.id} className={`mt-2 text-xs font-bold underline disabled:opacity-60 ${mine ? 'text-white' : 'text-orange-800'}`}>{savingRecipeMessage === item.id ? 'Saving recipe…' : 'Turn this into a saved recipe'}</button>)}
                </div></div>;
              })}<div ref={endRef} />
            </div>
            <div className="border-t border-primary-100 bg-white p-3">
              <form onSubmit={handleComposeSubmit} className="space-y-3">
                <textarea className="input block min-h-[96px] w-full resize-y" value={message} onChange={e => { setMessage(e.target.value); setIsVoiceDraft(false); transcriptRef.current = ''; }} placeholder={isRecording ? 'Listening… speak, then tap the microphone to stop.' : shareAsRecipe ? 'Paste or dictate a recipe or cooking note…' : 'Write or dictate a message or recipe tip…'} rows={3} maxLength={4000} aria-label={shareAsRecipe ? 'Recipe or cooking note' : 'Message or recipe tip'} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
                    <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-primary-800"><input type="checkbox" checked={shareAsRecipe} onChange={e => setShareAsRecipe(e.target.checked)} /> Share as a recipe</label>
                    <label className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap text-sm text-primary-800"><span>Language</span><select aria-label="Voice input language" className="input w-auto min-w-[112px] py-2 text-sm" value={voiceLanguage} onChange={e => setVoiceLanguage(e.target.value)}><option value="ur-PK">Urdu</option><option value="hi-IN">Hindi</option><option value="en-US">English</option></select></label>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button type="button" onClick={recordVoice} className={`btn-secondary flex h-11 w-11 items-center justify-center p-0 ${isRecording ? 'animate-pulse border-red-400 bg-red-50 text-red-700' : ''}`} aria-label={isRecording ? 'Stop voice note' : `Record voice note in ${voiceLanguage === 'ur-PK' ? 'Urdu' : voiceLanguage === 'hi-IN' ? 'Hindi' : 'English'}`} title={isRecording ? 'Listening… click to stop' : 'Speak a message'}>{isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}</button>
                    <button type="submit" className="btn-primary flex h-11 items-center justify-center gap-2 px-3" disabled={!message.trim()} aria-label={shareAsRecipe ? 'Make recipe and share' : 'Send message'}>{shareAsRecipe ? <><Utensils className="h-4 w-4" /><span className="hidden sm:inline">Make recipe</span></> : <Send className="h-4 w-4" />}</button>
                  </div>
                </div>
              </form>
              <p aria-live="polite" className="mt-2 text-xs leading-relaxed text-primary-500">{isRecording ? 'Listening in the selected language. Tap the microphone again to stop.' : isVoiceDraft ? (shareAsRecipe ? 'Recipe words ready. Make a recipe to review ingredients and steps before sharing.' : 'Transcript ready. Check it, then send your message.') : shareAsRecipe ? 'Voice or typed notes will be turned into a recipe draft to review before sharing.' : 'Voice input uses your browser. Check the transcript before sending it to your group.'}</p>
            </div>
          </>}
        </section>
      </div>
    </div>
  );
}
