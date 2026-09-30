import React, { useState } from 'react';
import {
  LogIn,
  Mail,
  Lock,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  loginWithEmail,
  loginWithGoogle,
  registerFirstOrSelfAccount,
  triggerPasswordReset,
} from '../services/authService';
import { getFriendlyErrorMessage } from '../firebase/errorHandler';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onAuthenticated: (profile: UserProfile) => void;
  deactivatedReason?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onAuthenticated,
  deactivatedReason,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'reset') {
      setLoading(true);
      try {
        await triggerPasswordReset(email);
        setInfoMessage(
          `Password reset instructions have been sent to ${email.trim()}. Check your inbox.`
        );
      } catch (err) {
        setError(getFriendlyErrorMessage(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password || password.length < 6) {
      setError('Please enter your password (at least 6 characters).');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        if (!name.trim()) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        const profile = await registerFirstOrSelfAccount(name, email, password);
        onAuthenticated(profile);
      } else {
        const profile = await loginWithEmail(email, password);
        onAuthenticated(profile);
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      const profile = await loginWithGoogle();
      onAuthenticated(profile);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EB] text-[#261C15] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar */}
      <div className="max-w-6xl w-full mx-auto flex items-center justify-between border-b border-[#DED4C3] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#D95D24] text-[#FFFDF9] flex items-center justify-center font-mono-tech font-semibold text-lg shadow-xs">
            K
          </div>
          <div>
            <span className="font-serif-editorial font-bold text-xl tracking-tight text-[#261C15]">
              KINDL Leads Tracker
            </span>
            <span className="ml-2 px-2 py-0.5 text-[11px] font-mono-tech uppercase tracking-wider bg-[#F0E9DC] border border-[#C5B69F] text-[#6E5D50] rounded">
              Team Edition
            </span>
          </div>
        </div>
        <div className="font-mono-tech text-xs text-[#6E5D50] hidden sm:flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#1E7E48]" />
          Cloud Firestore • Real-Time Multi-User Sync
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-8 bg-[#FFFDF9] border border-[#C5B69F] rounded-md shadow-sm overflow-hidden">
        <div className="bg-[#F0E9DC] px-6 py-4 border-b border-[#DED4C3]">
          <p className="font-mono-tech text-[11px] uppercase tracking-widest text-[#D95D24] font-semibold">
            Authorized Team Access
          </p>
          <h1 className="font-serif-editorial text-2xl font-bold text-[#261C15] mt-0.5">
            {mode === 'login' && 'Sign in to Workspace'}
            {mode === 'register' && 'Create Team Account'}
            {mode === 'reset' && 'Reset Your Password'}
          </h1>
          <p className="text-sm text-[#6E5D50] mt-1">
            {mode === 'login' &&
              'Access the shared KINDL leads database, follow-ups, and WhatsApp outreach queue.'}
            {mode === 'register' &&
              'Register your KINDL team member profile to collaborate on shared leads.'}
            {mode === 'reset' &&
              'Enter your registered email address and we will send a password reset link.'}
          </p>
        </div>

        <div className="p-6">
          {deactivatedReason && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-xs text-red-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Account Deactivated</p>
                <p className="mt-0.5">{deactivatedReason}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded text-xs text-red-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded text-xs text-emerald-900 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block font-mono-tech text-xs uppercase tracking-wider text-[#261C15] mb-1.5 font-medium">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Haris Khan"
                  disabled={loading}
                  className="w-full px-3 py-2 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui text-[#261C15] focus:outline-none focus:border-[#D95D24]"
                  required
                />
              </div>
            )}

            <div>
              <label className="block font-mono-tech text-xs uppercase tracking-wider text-[#261C15] mb-1.5 font-medium">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6E5D50] absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@kindl.org"
                  disabled={loading}
                  className="w-full pl-9 pr-3 py-2 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui text-[#261C15] focus:outline-none focus:border-[#D95D24]"
                  required
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-mono-tech text-xs uppercase tracking-wider text-[#261C15] font-medium">
                    Password *
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="font-mono-tech text-[11px] text-[#D95D24] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6E5D50] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2 bg-[#FFFDF9] border border-[#C5B69F] rounded text-sm font-sans-ui text-[#261C15] focus:outline-none focus:border-[#D95D24]"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#D95D24] hover:bg-[#B84A18] disabled:opacity-60 text-[#FFFDF9] font-mono-tech text-xs uppercase tracking-wider font-semibold rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {mode === 'login'
                    ? 'Signing in...'
                    : mode === 'register'
                    ? 'Creating account...'
                    : 'Sending reset email...'}
                </>
              ) : (
                <>
                  {mode === 'login' && (
                    <>
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </>
                  )}
                  {mode === 'register' && (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Create Account
                    </>
                  )}
                  {mode === 'reset' && (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Send Password Reset Link
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          {mode !== 'reset' && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#DED4C3]" />
                </div>
                <div className="relative flex justify-center text-[11px] font-mono-tech uppercase">
                  <span className="bg-[#FFFDF9] px-2 text-[#6E5D50]">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2 px-4 bg-[#F7F3EB] hover:bg-[#F0E9DC] border border-[#C5B69F] text-[#261C15] font-mono-tech text-xs font-medium rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google Workspace
              </button>
            </>
          )}

          {/* Mode Switch Footer */}
          <div className="mt-5 pt-4 border-t border-[#DED4C3] flex items-center justify-between text-xs font-mono-tech text-[#6E5D50]">
            {mode === 'login' ? (
              <>
                <span>First time joining the team?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="text-[#D95D24] font-semibold hover:underline cursor-pointer"
                >
                  Create Account →
                </button>
              </>
            ) : (
              <>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="text-[#D95D24] font-semibold hover:underline cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-6xl w-full mx-auto text-center font-mono-tech text-[11px] text-[#6E5D50] border-t border-[#DED4C3] pt-4">
        KINDL Internal Lead Operations • Protected by Firebase Authentication & Role-Based Security Rules
      </div>
    </div>
  );
};
