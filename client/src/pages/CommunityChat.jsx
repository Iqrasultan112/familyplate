import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Send, Mic, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function CommunityChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000'), { auth: { token: localStorage.getItem('token') }, transports: ['websocket'] });
    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_community');
      if (user?.id) socketRef.current.emit('join_user_room', user.id);
    });

    socketRef.current.on('receive_community_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();
    });

    socketRef.current.on('ai_suggestion', (suggestion) => {
      setAiSuggestion(suggestion);
    });

    // Setup Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        sendVoiceMessage(transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (e) => {
        console.error('Speech recognition error', e);
        setIsRecording(false);
        toast.error('Voice recognition failed.');
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    return () => {
      socketRef.current.disconnect();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim()) return;

    const msgData = {
      message: input,
      user: { id: user?.id, name: user?.name || 'Member' },
      isVoice: false,
      timestamp: new Date().toISOString()
    };
    
    socketRef.current.emit('send_community_message', msgData);
    setInput('');
  };

  const sendVoiceMessage = (transcript) => {
    const msgData = {
      message: transcript,
      user: { id: user?.id, name: user?.name || 'Member' },
      isVoice: true,
      timestamp: new Date().toISOString()
    };
    socketRef.current.emit('send_community_message', msgData);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        toast.error('Voice recognition not supported in this browser.');
        return;
      }
      recognitionRef.current.lang = voiceLanguage;
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  return (
    <div className="page-shell max-w-5xl">
    <div className="mx-auto w-full max-w-4xl flex flex-col h-[calc(100dvh-16rem)] min-h-[20rem] bg-white border border-primary-200 rounded-2xl shadow-card relative overflow-hidden">
      <div className="bg-[#FFF0E6] border-b border-primary-200 p-4 flex-shrink-0 shadow-sm z-10">
        <h1 className="text-xl font-bold">Share recipes with the community</h1>
        <p className="text-sm text-gray-600">Everyone here can see your messages and recipe tips.</p>
      </div>

      {/* AI Suggestion Banner */}
      {aiSuggestion && (
        <div className="bg-blue-100 border-l-4 border-blue-500 p-4 mx-4 mt-4 rounded shadow flex items-center justify-between animate-fade-in-down">
          <div>
            <p className="text-blue-900 font-semibold text-base">That sounds like a recipe</p>
            <p className="text-blue-700 text-sm mt-1">Would you like to turn this voice note into a recipe?</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/recipes/ai', { state: { initialText: aiSuggestion.text } })}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            >
              Make a recipe
            </button>
            <button 
              onClick={() => setAiSuggestion(null)}
              className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-300"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 text-gray-600">
            <Mic className="w-9 h-9 text-primary-500 mb-3" />
            <p className="text-base font-semibold">Start with a recipe tip</p>
            <p className="text-sm mt-1">Write a message or use the microphone to share a recipe by voice.</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const isMe = msg.userId === user?.id;
          return (
            <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-gray-500 mb-1 ml-1">{msg.user?.name || msg.authorName || 'Member'}</span>
              <div className={`p-3 max-w-[75%] rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border rounded-tl-none text-gray-800'}`}>
                {msg.isVoice && <div className="text-xs opacity-75 mb-1 flex items-center gap-1"><Mic className="w-3 h-3"/> Voice Message</div>}
                <p className="whitespace-pre-wrap break-words text-sm">{msg.message || msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white p-3 border-t space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Voice language
          <select className="input w-auto py-2" value={voiceLanguage} onChange={e => setVoiceLanguage(e.target.value)} aria-label="Voice message language">
            <option value="en-US">English</option>
            <option value="ur-PK">Urdu</option>
            <option value="hi-IN">Hindi</option>
          </select>
        </label>
        <form onSubmit={handleSend} className="flex gap-2 items-center relative">
          <input
            type="text"
            className="input flex-1 rounded-full px-4"
            placeholder="Write a message or recipe tip…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-3 rounded-full flex items-center justify-center transition-colors ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            aria-label={isRecording ? 'Stop recording' : `Record voice message in ${voiceLanguage === 'ur-PK' ? 'Urdu' : voiceLanguage === 'hi-IN' ? 'Hindi' : 'English'}`}
            title={isRecording ? 'Stop recording' : 'Record a voice message'}
          >
            {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            <span className="sr-only">{isRecording ? 'Stop voice message' : 'Record a voice message'}</span>
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 flex items-center justify-center disabled:opacity-50"
            disabled={!input.trim() && !isRecording}
          >
            <Send className="w-5 h-5" />
            <span className="sr-only">Send message</span>
          </button>
        </form>
      </div>
    </div>
    </div>
  );
}
