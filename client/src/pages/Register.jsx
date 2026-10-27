import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { ChefHat, Users, CheckCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [searchParams] = useSearchParams();
  const joinCodeParam = searchParams.get('join') || searchParams.get('code') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(joinCodeParam ? 'member' : 'maker');
  const [joinCode, setJoinCode] = useState(joinCodeParam.toUpperCase());
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8 || password.length > 72) {
      toast.error('Use a password between 8 and 72 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        name,
        email,
        password,
        role
      });

      login(res.data.user, res.data.token);
      toast.success(`Welcome to FamilyPlate, ${name}.`);

      // Family setup stays optional. A planner or member without an invite can
      // start using their own account immediately.
      if (joinCode.trim()) navigate(`/join?code=${encodeURIComponent(joinCode.trim())}`);
      else navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {joinCodeParam && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-3.5 text-sm text-primary-900 flex items-center gap-2.5 animate-fadeIn">
          <Users className="w-5 h-5 text-primary-600 shrink-0" />
          <span>Your family invite is ready. You’ll join that family space after signup.</span>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Create your account</h2>
        <p className="mt-1 text-sm text-gray-600">Choose how you’ll use FamilyPlate. You can start planning without setting up a family.</p>
      </div>

      {!joinCodeParam && <div className="grid grid-cols-2 gap-2" role="group" aria-label="Choose account type">
        {[
          { value: 'maker', title: 'Planner', detail: 'Plan meals for my home', Icon: ChefHat },
          { value: 'member', title: 'Family member', detail: 'Join with an invite', Icon: Users },
        ].map(({ value, title, detail, Icon }) => (
          <button key={value} type="button" aria-pressed={role === value} onClick={() => setRole(value)}
            className={`relative flex min-h-[72px] min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${role === value ? 'border-primary-600 bg-primary-50/70 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700"><Icon className="h-4 w-4" /></span>
            <span className="min-w-0"><span className="block pr-3 text-xs font-bold leading-snug text-gray-900 sm:text-sm">{title}</span><span className="mt-0.5 block text-[11px] leading-snug text-gray-600">{detail}</span></span>
            {role === value && <CheckCircle className="absolute right-2 top-2 h-4 w-4 text-primary-600" />}
          </button>
        ))}
      </div>}

      <form className="grid grid-cols-1 gap-y-3.5" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={80}
            required
              placeholder="The name your family knows you by"
            className="input mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="password">Password</label>
          <div className="relative mt-1">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              placeholder="At least 8 characters"
              className="input pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-gray-500 hover:bg-gray-50 hover:text-gray-800">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">Use 8 or more characters.</p>
        </div>

        {(role === 'member' || joinCodeParam) && (
          <div>
            <label className="label" htmlFor="joinCode">
              Family invite <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              id="joinCode"
              name="joinCode"
              type="text"
              maxLength={32}
              placeholder="Paste the invite shared with you"
              className="input mt-1 font-mono uppercase tracking-wider"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
          </div>
        )}

        {role === 'member' && !joinCode && <p className="-mt-2 text-xs text-primary-600">You can join a family later. Your account will still open to your own meal planner.</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary flex justify-center items-center gap-2 py-3 text-base shadow-sm hover:shadow"
        >
          {loading ? (
            'Creating your account...'
          ) : (
            <>
              Continue
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center pt-2 border-t border-gray-100">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-500">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
