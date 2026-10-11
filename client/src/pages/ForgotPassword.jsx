import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email });
      setSuccess(true);
      toast.success('Reset link sent to your email.');
    } catch (error) {
      if (error.response?.status === 503) {
        setUnavailable(true);
        toast.error('Password reset is not available yet');
      } else toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Check your email</h3>
        <p className="text-sm text-gray-600 mb-6">We've sent a password reset link to {email}.</p>
        <Link to="/login" className="w-full btn-primary inline-block">
          Return to login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-primary-950">Reset your password</h2>
        <p className="mt-2 text-sm leading-relaxed text-primary-700">Enter the email used for your account. We’ll only change your password after confirming that you own the email address.</p>
      </div>
      {unavailable && <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Secure email recovery is not set up yet. Your password has not been changed. Please contact the person who manages your FamilyPlate setup.</div>}
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex justify-center"
          >
            {loading ? 'Checking…' : 'Request password reset'}
          </button>
        </div>
      </form>
      
      <div className="mt-6 text-center">
        <Link to="/login" className="text-sm font-medium text-primary-600 hover:text-primary-500">
          Back to login
        </Link>
      </div>
    </div>
  );
}
