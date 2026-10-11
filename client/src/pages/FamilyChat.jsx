import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { Send, ArrowLeft } from 'lucide-react';
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
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
      socketRef.current = io(socketUrl, { auth: { token: localStorage.getItem('token') } });
      
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
    <div className="page-shell max-w-5xl">
    <div className="mx-auto w-full max-w-4xl h-[calc(100dvh-16rem)] min-h-[24rem] flex flex-col bg-white border border-primary-200 rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="bg-[#FFF0E6] border-b border-primary-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/family')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{family?.name} family chat</h1>
            <p className="text-sm text-gray-600">Share meal ideas and messages with your family.</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 h-full flex flex-col items-center justify-center">
            <p className="text-base">No messages yet. Start with a meal idea or say hello.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMine = msg.userId === user.id;
            return (
              <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[75%] ${isMine ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                  
                  {/* Avatar */}
                  <div className="shrink-0 mb-5">
                    {msg.user?.avatar ? (
                      <img src={msg.user.avatar} alt={msg.user.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold text-xs">
                        {getInitials(msg.user?.name || 'U')}
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-500 mb-1 px-1">{msg.user?.name}</span>
                    <div className={`px-4 py-2 rounded-2xl ${isMine ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'}`}>
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-4 shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            className="input flex-1 bg-gray-50 border-gray-200 focus:bg-white"
            placeholder="Write a message…"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 min-h-[44px]"
          >
            <Send className="w-5 h-5" />
            <span className="text-sm font-semibold">Send</span>
          </button>
        </form>
      </div>
    </div>
    </div>
  );
}
