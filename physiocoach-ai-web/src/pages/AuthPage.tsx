import { useState, type FormEvent } from 'react';
import { Dumbbell, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../services/api-client';

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email')).trim();
    const password = String(form.get('password'));
    const name = String(form.get('name') || '').trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (mode === 'register' && !name) return setError('Enter your name.');

    setLoading(true);
    setError('');
    try {
      await (mode === 'login' ? login({ email, password }) : register({ email, password }));
      navigate(mode === 'login' ? '/dashboard' : '/onboarding');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  function google() {
    const returnTo = encodeURIComponent(`${window.location.origin}/oauth-callback`);
    window.location.assign(`${API_URL}/auth/google?returnTo=${returnTo}`);
  }

  return (
    <main className="grid min-h-screen bg-obsidian-950 text-white lg:grid-cols-2">
      {/* Left Hardware Branding Panel */}
      <section className="hidden bg-obsidian-900 border-r border-obsidian-800 p-12 lg:flex lg:flex-col lg:justify-between relative overflow-hidden">
        <div className="pointer-events-none absolute -left-20 -top-20 size-80 rounded-full bg-volt/10 blur-3xl" />

        <Link to="/" className="flex items-center gap-2.5 font-black text-xl tracking-tight">
          <span className="grid size-10 place-items-center rounded-xl bg-volt text-obsidian-950">
            <Dumbbell className="h-6 w-6 stroke-[2.5]" />
          </span>
          <span>
            PHYSIO<span className="text-volt">COACH</span> <span className="text-xs text-slate-500 font-normal">AI</span>
          </span>
        </Link>

        <div className="relative">
          <p className="mb-4 font-mono text-xs font-extrabold uppercase tracking-[.25em] text-volt">
            Precision Performance
          </p>
          <h1 className="text-5xl font-black uppercase leading-tight tracking-tight text-white sm:text-6xl">
            Stronger Is<br />
            A Direction.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-slate-400">
            Posture-aware training programming calibrated around your biomechanics and physical limits.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <ShieldCheck className="h-4 w-4 text-volt" />
          <span>Medical Safety Safeguard · ISO-grade Encryption</span>
        </div>
      </section>

      {/* Right Login/Register Form */}
      <section className="grid place-items-center p-6 sm:p-10">
        <Card className="w-full max-w-md border-obsidian-700 bg-obsidian-900">
          <CardContent className="p-7 sm:p-9">
            {/* Mode Switcher Tabs */}
            <div className="mb-7 flex rounded-xl border border-obsidian-700 bg-obsidian-950 p-1">
              {(['login', 'register'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setMode(tab);
                    setError('');
                  }}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-extrabold uppercase tracking-wider transition-all ${
                    mode === tab
                      ? 'border border-volt/30 bg-volt/10 text-volt'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            <h2 className="text-2xl font-black text-white">
              {mode === 'login' ? 'Athlete Access' : 'Create Athlete Profile'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {mode === 'login'
                ? 'Sign in to access your customized workout split and live tracker.'
                : 'Join PhysioCoach AI and generate your evidence-based split.'}
            </p>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {mode === 'register' && (
                <Input
                  label="Athlete Full Name"
                  name="name"
                  autoComplete="name"
                  placeholder="Alex Morgan"
                />
              )}
              <Input
                label="Email Address"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="athlete@example.com"
              />
              <Input
                label="Password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="At least 8 characters"
              />

              {error && <Toast type="error" message={error} onClose={() => setError('')} />}

              <Button type="submit" variant="volt" size="lg" className="w-full mt-2" loading={loading}>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs font-mono text-slate-600">
              <span className="h-px flex-1 bg-obsidian-800" />
              OR
              <span className="h-px flex-1 bg-obsidian-800" />
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full border-obsidian-700 bg-obsidian-950 text-slate-200 hover:text-white"
              onClick={google}
            >
              <span className="font-extrabold text-blue-400">G</span> Continue with Google
            </Button>

            <Link
              to="/"
              className="mt-6 block text-center text-xs font-bold text-slate-500 hover:text-volt transition-colors"
            >
              ← Return to Home
            </Link>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

