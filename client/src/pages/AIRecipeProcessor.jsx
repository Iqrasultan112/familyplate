import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Mic, FileText, Square, Loader2, Sparkles, ArrowLeft, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import RecipeReview from '../components/RecipeReview';

export default function AIRecipeProcessor() {
  const location    = useLocation();
  const initialText = location.state?.initialText || '';
  const targetGroupId = location.state?.targetGroupId || '';

  const [activeTab, setActiveTab]             = useState(initialText ? 'text' : 'voice');
  const [textInput, setTextInput]             = useState(initialText);
  const [status, setStatus]                   = useState('idle'); // idle | recording | processing | review
  const [structuredRecipe, setStructuredRecipe] = useState(null);
  const [voiceLanguage, setVoiceLanguage] = useState('ur-PK');
  const mediaRecorderRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const processRef = useRef(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const toggleRecording = async () => {
    if (status === 'recording') {
      setStatus('processing');
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error('This browser cannot record voice notes. Please type the recipe instead.');
      return;
    }
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
        setStatus('idle');
        toast.error('The microphone recording stopped. Please try again or type the recipe.');
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        microphoneStreamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 1000) { setStatus('idle'); toast.error('I did not capture enough audio. Hold the microphone on for a little longer.'); return; }
        const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const form = new FormData();
        form.append('audio', blob, `recipe-note.${extension}`);
        form.append('language', voiceLanguage.slice(0, 2));
        try {
          const { data } = await api.post('/ai/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 70000 });
          const transcript = String(data.text || '').trim();
          if (!transcript) throw new Error('No spoken words were detected. Please try again.');
          setTextInput(transcript);
          await processRef.current?.(transcript);
        } catch (error) {
          setStatus('idle');
          toast.error(error.response?.data?.error || error.message || 'Could not transcribe this voice note. You can type the recipe instead.');
        }
      };
      recorder.start();
      setTextInput('');
      setStatus('recording');
    } catch (error) {
      microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
      setStatus('idle');
      toast.error(error.name === 'NotAllowedError'
        ? 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.'
        : 'The microphone could not start. Check that it is connected and enabled, then try again.');
    }
  };

  const handleProcess = async (input = textInput) => {
    if (!input.trim()) { toast.error('Please provide recipe text'); setStatus('idle'); return; }
    setStatus('processing');
    try {
      const res = await api.post('/ai/structure', { rawText: input });
      setStructuredRecipe(res.data);
      setStatus('review');
    } catch {
      toast.error('Could not prepare the recipe. Your text is still available to try again.');
      setStatus('idle');
    }
  };
  processRef.current = handleProcess;

  const handleReset = () => { if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); microphoneStreamRef.current?.getTracks().forEach(track => track.stop()); setStructuredRecipe(null); setStatus('idle'); setTextInput(''); };

  if (status === 'review' && structuredRecipe) {
    return (
      <div className="page-shell max-w-4xl space-y-6">
        <div className="page-heading flex items-center gap-3">
          <button onClick={handleReset} className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="page-title">{structuredRecipe.needsManualReview ? 'Recipe note ready' : 'Recipe draft ready'}</h1>
            <p className="page-subtitle">Review the name, ingredients, and method before saving</p>
          </div>
        </div>
        {structuredRecipe.aiUnavailable && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">The AI service is not available for this key right now, so we prepared a local editable draft. Please check the recipe name, amounts, and steps before saving.</div>}
        <RecipeReview initialRecipe={structuredRecipe} initialGroupId={targetGroupId} onStartOver={handleReset} />
      </div>
    );
  }

  return (
    <div className="page-shell max-w-2xl space-y-6">

      {/* Header */}
      <div className="page-heading">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="page-title">AI Recipe Processor</h1>
        </div>
        <p className="page-subtitle pl-12">
          Dictate or paste a family recipe in your own words. We’ll turn it into an editable recipe card.
        </p>
      </div>

      {/* Main card */}
      <div className="card overflow-hidden p-0">
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {[
            { id: 'voice', label: 'Voice Input', icon: Mic,      desc: 'Speak your recipe' },
            { id: 'text',  label: 'Text Input',  icon: FileText, desc: 'Paste or type'      },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              disabled={status === 'processing'}
              className={`flex-1 flex flex-col items-center gap-1 py-4 transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-600 bg-primary-50/30 text-primary-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <tab.icon className="w-4 h-4" />
              <span className="text-xs font-bold tracking-wide">{tab.label}</span>
              <span className="text-[10px] text-slate-400 hidden sm:block">{tab.desc}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Voice tab */}
          {activeTab === 'voice' && (
            <div className="flex flex-col items-center py-8 gap-6">
              <label className="w-full max-w-xs text-sm font-semibold text-primary-900">Spoken language
                <select className="input mt-1" value={voiceLanguage} onChange={e => setVoiceLanguage(e.target.value)} disabled={status === 'recording'}>
                  <option value="ur-PK">Urdu</option><option value="hi-IN">Hindi</option><option value="en-US">English</option>
                </select>
              </label>
              {/* Mic button */}
              <div className="relative">
                {status === 'recording' && (
                  <>
                    <span className="absolute inset-0 rounded-full border-2 border-red-400/60 animate-ping" />
                    <span className="absolute inset-0 scale-110 rounded-full border border-red-300/40 animate-ping [animation-delay:200ms]" />
                  </>
                )}
                <button
                  onClick={status === 'processing' ? undefined : toggleRecording}
                  disabled={status === 'processing'}
                  className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                    status === 'recording'
                      ? 'bg-red-600 hover:bg-red-700 text-white scale-105'
                      : status === 'processing'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700 text-white hover:scale-105 hover:shadow-xl'
                  }`}
                >
                  {status === 'processing' ? <Loader2 className="w-8 h-8 animate-spin" /> :
                   status === 'recording'  ? <Square className="w-8 h-8 fill-current" /> :
                                             <Mic className="w-8 h-8" />}
                </button>
              </div>

              <div className="text-center">
                <p className="font-semibold text-slate-800">
                  {status === 'idle'       && 'Tap the microphone to start'}
                  {status === 'recording'  && 'Recording — click to stop & process'}
                  {status === 'processing' && 'Transcribing and preparing your recipe…'}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {status === 'idle' && 'Speak clearly in English or Urdu-English mix'}
                  {status === 'recording' && 'Speak clearly, then tap to transcribe and review'}
                </p>
              </div>

                {textInput && status === 'recording' && (
                <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600 italic max-h-28 overflow-y-auto">
                  "{textInput.trim()}…"
                </div>
              )}
            </div>
          )}

          {/* Text tab */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="label">Unstructured Recipe Text</label>
                <textarea
                  className="input min-h-[180px] resize-none leading-relaxed"
                  placeholder="Paste or type any recipe here. Don't worry about formatting — e.g. 'Take half kg chicken, mix with yogurt, salt and spices, marinate 1 hour, then fry onions golden, add chicken, cook 20 mins on low flame until oil separates…'"
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  disabled={status === 'processing'}
                />
                <p className="text-[11px] text-slate-400 mt-1">{textInput.length} characters</p>
              </div>
              <button
                type="button"
                onClick={() => handleProcess()}
                disabled={status === 'processing' || !textInput.trim()}
                className="btn-primary w-full py-3 disabled:cursor-not-allowed"
              >
                {status === 'processing'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing recipe draft…</>
                  : <><Sparkles className="w-4 h-4" /> Prepare recipe draft</>
                }
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-800 mb-1.5">Tips for best results</p>
          <ul className="text-xs text-amber-700 space-y-1 leading-relaxed">
            <li>· Include ingredient amounts (e.g. "half kg chicken", "2 tablespoons oil")</li>
            <li>· Mention cooking steps in order with durations</li>
            <li>· Works with Urdu-English mixed recipes</li>
            <li>· The more detail you provide, the better the output</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
