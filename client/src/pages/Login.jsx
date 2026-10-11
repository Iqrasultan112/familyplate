import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.user, res.data.token);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-primary-950 tracking-tight">Welcome back</h2>
        <p className="text-primary-600 text-sm mt-2 leading-relaxed">
          Sign in to your FamilyPlate account to continue planning.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 pointer-events-none" />
            <input
              id="email" type="email" required autoComplete="email"
              placeholder="you@example.com"
              className="input pl-11 py-3.5"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0" htmlFor="password">Password</label>
            <Link to="/forgot-password"
              className="text-xs font-bold text-primary-700 hover:text-primary-900 transition-colors">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 pointer-events-none" />
            <input
              id="password" type={showPwd ? 'text' : 'password'} required
              placeholder="Your password"
              className="input pl-11 pr-12 py-3.5"
              value={password} onChange={e => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center rounded-lg text-primary-600 hover:bg-primary-50 hover:text-primary-900 transition-colors">
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full btn-primary py-3.5 text-base mt-2">
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
            : <><LogIn className="w-4 h-4" /> Sign In</>
          }
        </button>
      </form>

      <div className="flex items-center gap-3 my-7">
        <div className="flex-1 h-px bg-primary-200" />
        <span className="text-sm text-primary-500 font-semibold">or</span>
        <div className="flex-1 h-px bg-primary-200" />
      </div>

      <p className="text-center text-sm text-primary-600">
        New to FamilyPlate?{' '}
        <Link to="/register"
          className="font-bold text-primary-900 hover:underline transition-colors">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
