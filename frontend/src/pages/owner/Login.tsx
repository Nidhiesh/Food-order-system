import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, LogIn, Loader, AlertTriangle } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/owner/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Read message from search params (e.g. session expired)
  useEffect(() => {
    const msg = searchParams.get('message');
    if (msg === 'session_expired') {
      setError('Your session has expired. Please log in again.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      return setError('Please enter both email and password');
    }

    try {
      setError('');
      setLoggingIn(true);
      await login({ email, password });
      navigate('/owner/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4">
      {/* Container */}
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl animate-slide-up">
        {/* Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-brand-500/10 mx-auto mb-4">
            OB
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight mb-1">
            Shop Owner Login
          </h2>
          <p className="text-slate-400 text-xs">
            Manage your daily college menu and order queue
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-semibold flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">Email Address</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Mail size={16} />
              </span>
              <input
                type="email"
                placeholder="owner@collegefood.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-2xl text-sm font-medium transition-colors outline-none text-white placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">Password</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock size={16} />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-2xl text-sm font-medium transition-colors outline-none text-white placeholder:text-slate-600"
                required
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full mt-2 py-3 bg-brand-600 hover:bg-brand-700 text-white font-extrabold rounded-2xl shadow-lg shadow-brand-500/10 text-center transition-all flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
          >
            {loggingIn ? (
              <>
                <Loader className="animate-spin" size={16} />
                Authenticating...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Sign In
              </>
            )}
          </button>
        </form>
      </div>

      <div className="text-center text-slate-600 text-[10px] mt-6 select-none font-semibold uppercase tracking-widest">
        SECURED WITH ARGON2 / JWT &bull; CAMPUS BITES
      </div>
    </div>
  );
};
