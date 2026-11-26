import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  PenTool,
  Save,
  User as UserIcon,
} from 'lucide-react';
import { logInAccount, signUpAccount, type AccountUser } from '../services/workspaceApi';

interface AuthPageProps {
  onAuthenticated: (user: AccountUser) => void;
}

type Mode = 'signin' | 'signup';

const FEATURES = [
  { icon: BarChart3, text: 'Live LSE futures feed with RTH/ETH sessions' },
  { icon: PenTool, text: 'Drawings, templates and indicator sets that follow you' },
  { icon: Save, text: 'Watchlists, layouts, alerts and positions saved to your account' },
];

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  const switchMode = (next: Mode) => {
    if (busy || next === mode) return;
    setMode(next);
    setError(null);
    setPassword('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Enter your email address.');
      return;
    }
    if (isSignup && password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (!isSignup && !password) {
      setError('Enter your password.');
      return;
    }

    setBusy(true);
    try {
      const user = isSignup
        ? await signUpAccount({ email: trimmedEmail, password, name: name.trim() || undefined })
        : await logInAccount({ email: trimmedEmail, password });
      onAuthenticated(user);
    } catch (err) {
      setError((err as Error)?.message || 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="relative w-full min-h-[100dvh] flex items-center justify-center bg-[#080b12] text-[#e8eef8] overflow-y-auto px-4 py-10">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-[#0f9b7a]/20 blur-[130px]" />
        <div className="absolute -bottom-52 -right-24 w-[560px] h-[560px] rounded-full bg-[#2563eb]/20 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.07) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid md:grid-cols-[1.05fr_0.95fr] rounded-2xl border border-white/10 bg-[#0b1018]/85 backdrop-blur-xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] overflow-hidden">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between gap-10 p-10 bg-gradient-to-br from-[#0d1520] via-[#0b1018] to-[#0a1a17] border-r border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#0f9b7a] flex items-center justify-center shadow-[0_0_24px_-6px_rgba(15,155,122,0.9)]">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div className="leading-tight">
                <div className="text-[15px] font-semibold tracking-tight">ChartFlow</div>
                <div className="text-[11px] text-white/45">Futures terminal</div>
              </div>
            </div>

            <h1 className="mt-9 text-[26px] leading-[1.2] font-semibold tracking-tight">
              Your trading workspace,
              <br />
              synced to your account.
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-white/50">
              Sign in to keep charts, drawings, layouts and alerts identical on every device.
              Everything is stored in your own Cloudflare D1 database.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-start gap-2.5 text-[12.5px] text-white/60">
                <feature.icon className="w-4 h-4 mt-0.5 shrink-0 text-[#0f9b7a]" />
                <span>{feature.text}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 text-[11px] text-white/35">
            <Lock className="w-3.5 h-3.5" />
            <span>Passwords are hashed with PBKDF2-SHA256; sessions use HttpOnly cookies.</span>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10">
          <div className="md:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-[#0f9b7a] flex items-center justify-center">
              <BarChart3 className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-sm font-semibold">ChartFlow</span>
          </div>

          <h2 className="text-[20px] font-semibold tracking-tight">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-1.5 text-[12.5px] text-white/45">
            {isSignup
              ? 'One account keeps your workspace in sync everywhere.'
              : 'Sign in to load your saved workspace.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
            {(
              [
                ['signin', 'Sign in'],
                ['signup', 'Create account'],
              ] as [Mode, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                className={`h-8 rounded-lg text-[12px] font-medium transition-colors ${
                  mode === value
                    ? 'bg-[#0f9b7a] text-white shadow-[0_6px_18px_-8px_rgba(15,155,122,0.9)]'
                    : 'text-white/55 hover:text-white/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isSignup && (
              <div>
                <label htmlFor="auth-name" className="block text-[11.5px] font-medium text-white/55 mb-1.5">
                  Display name <span className="text-white/30">(optional)</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    id="auth-name"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    placeholder="Alex Trader"
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#0f9b7a]/70 focus:bg-white/[0.06] transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-[11.5px] font-medium text-white/55 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#0f9b7a]/70 focus:bg-white/[0.06] transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-[11.5px] font-medium text-white/55 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  minLength={isSignup ? 8 : undefined}
                  placeholder={isSignup ? 'At least 8 characters' : 'Your password'}
                  className="w-full h-10 pl-9 pr-10 rounded-lg bg-white/[0.04] border border-white/10 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#0f9b7a]/70 focus:bg-white/[0.06] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-white/35 hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-200"
              >
                <AlertCircle className="w-4 h-4 mt-px shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-10 rounded-lg bg-[#0f9b7a] hover:bg-[#12b28d] disabled:opacity-60 text-white text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isSignup ? 'Creating account…' : 'Signing in…'}
                </>
              ) : (
                <>
                  {isSignup ? 'Create account' : 'Sign in'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 space-y-1.5 text-[11px] text-white/35">
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-[#0f9b7a]" />
              Your workspace is stored in your own database — not shared with anyone.
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3 h-3 text-[#0f9b7a]" />
              {isSignup
                ? 'You can sign in on any device with the same email and password.'
                : 'New here? Switch to “Create account” above.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
