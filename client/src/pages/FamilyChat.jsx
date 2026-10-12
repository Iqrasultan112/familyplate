import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { Send, ArrowLeft, MessageCircle, Users } from 'lucide-react';
import { getInitials } from '../lib/utils';

export default function FamilyChat() {
  const [family, setFamily] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/family/mine');
      if (!res.data.family) {
        toast.error('You are not in a family');
        navigate('/family');
        return;
      }
      setFamily(res.data.family);
      
      // Setup Socket
      const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');
      socketRef.current = io(socketUrl, { auth: { token: localStorage.getItem('token') }, transports: ['websocket'] });
      
      socketRef.current.on('connect', () => {
        socketRef.current.emit('join_family', res.data.family.id);
      });

      socketRef.current.on('receive_family_message', (message) => {
        setMessages((prev) => [...prev, message]);
      });

      // Load initial messages
      try {
        const msgRes = await api.get(`/family/messages/${res.data.family.id}`);
        setMessages(msgRes.data || []);
      } catch (err) {
        // endpoint might not exist yet, fallback to messages in family object if any
        if (res.data.family.messages) {
          setMessages(res.data.family.messages);
        }
      }

    } catch (error) {
      toast.error('Failed to load family chat');
      navigate('/family');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !family) return;

    const messageData = {
      familyId: family.id,
      content: newMessage,
      userId: user.id,
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      createdAt: new Date().toISOString()
    };

    setNewMessage('');

    // Send over socket
    if (socketRef.current) {
      socketRef.current.emit('send_family_message', messageData);
    }
    
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading chat...</div>;
  }

  return (
    <section className="flex h-[calc(100dvh-9rem-env(safe-area-inset-bottom))] min-h-0 w-full flex-col bg-[#fffdfa] md:h-[calc(100dvh-4.5rem)]" aria-label="Family chat">
      <header className="flex shrink-0 items-center justify-between border-b border-primary-200 bg-[#FFFCF8] px-3 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate('/family')} aria-label="Back to family" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-primary-700 transition hover:bg-primary-50">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fae8dd] text-primary-800"><MessageCircle className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-primary-950 sm:text-lg">Family chat</h1>
            <p className="truncate text-xs text-primary-700">{family?.name || 'Your family'} · shared conversation</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800"><Users className="h-4 w-4" /><span>Family</span></div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end gap-5">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fae8dd] text-primary-800"><MessageCircle className="h-7 w-7" /></span>
              <h2 className="mt-4 text-lg font-bold text-primary-950">Start a family conversation</h2>
              <p className="mt-1 max-w-sm text-sm leading-6 text-primary-700">Share a meal idea, ask what everyone wants, or send a quick message.</p>
            </div>
          ) : messages.map((msg, idx) => {
            const isMine = msg.userId === user.id;
            return (
              <div key={msg.id || `${msg.userId}-${msg.createdAt}-${idx}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[88%] items-end gap-2 sm:max-w-[75%] ${isMine ? 'flex-row-reverse' : ''}`}>
                  <div className="mb-5 h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#fae8dd] text-primary-800">
                    {msg.user?.avatar ? <img src={msg.user.avatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[11px] font-bold">{getInitials(msg.user?.name || 'U')}</span>}
                  </div>
                  <div className={`flex min-w-0 flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span className="mb-1 px-1 text-xs font-semibold text-primary-700">{isMine ? 'You' : msg.user?.name || 'Family member'}</span>
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${isMine ? 'rounded-br-md bg-primary-800 text-white' : 'rounded-bl-md border border-primary-200 bg-white text-primary-950'}`}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    <span className="mt-1 px-1 text-[10px] text-primary-500">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <form onSubmit={handleSend} className="shrink-0 border-t border-primary-200 bg-[#FFFCF8] px-3 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-2xl border border-primary-200 bg-white p-2 shadow-sm focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100">
          <textarea
            rows={1}
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-y bg-transparent px-2 py-2 text-sm leading-5 text-primary-950 outline-none placeholder:text-primary-500"
            placeholder="Write a message to your family…"
            value={newMessage}
            onChange={event => setNewMessage(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
            aria-label="Message your family"
          />
          <button type="submit" disabled={!newMessage.trim()} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-primary-800 px-4 text-sm font-semibold text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-45">
            <Send className="h-4 w-4" /><span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <p className="mx-auto mt-1.5 hidden w-full max-w-4xl px-2 text-[11px] text-primary-500 sm:block">Enter to send · Shift + Enter for a new line</p>
      </form>
    </section>
  );
}
