import { useEffect, useState, type FormEvent } from 'react';
import {
  LogOut,
  Moon,
  Save,
  Sun,
  ShieldCheck,
  Dumbbell,
  Timer,
  Volume2,
  VolumeX,
  Scale,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePreferences, type UnitSystem } from '../context/PreferencesContext';
import { apiClient } from '../services/api-client';

const EQUIPMENT_CATALOG = [
  'Bodyweight',
  'Dumbbells',
  'Barbell',
  'Bench',
  'Cable machine',
  'Resistance bands',
  'Kettlebells',
  'Pull-up bar',
  'Squat rack',
  'Leg press machine',
];

interface ProfileData {
  displayName?: string;
  email?: string;
  age?: number;
  sex?: string;
  experienceLevel?: string;
  availableEquipment?: string[];
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const {
    unitSystem,
    setUnitSystem,
    defaultRestSeconds,
    setDefaultRestSeconds,
    soundEnabled,
    setSoundEnabled,
    autoStartRestTimer,
    setAutoStartRestTimer,
  } = usePreferences();

  const [profile, setProfile] = useState<ProfileData>({});
  const [gear, setGear] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient
      .get<any>('profile')
      .then((res) => {
        const data = res?.data || res;
        setProfile(data || {});
        if (Array.isArray(data?.availableEquipment)) {
          setGear(data.availableEquipment);
        }
      })
      .catch(() => {
        setProfile({ displayName: user?.displayName || '', email: user?.email || '' });
      });
  }, [user]);

  const toggleEquipment = (item: string) => {
    setGear((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setNotice(null);

    try {
      await apiClient.patch('profile', {
        displayName: data.get('displayName'),
        email: data.get('email'),
        age: Number(data.get('age')) || null,
        experienceLevel: data.get('experienceLevel'),
        availableEquipment: gear,
      });

      setNotice({ type: 'success', text: 'Athlete settings & preferences updated successfully.' });
    } catch (cause) {
      setNotice({
        type: 'error',
        text: cause instanceof Error ? cause.message : 'Could not save profile settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl p-4 pb-32 sm:p-6 lg:p-8 space-y-6">
      <header className="border-b border-obsidian-800 pb-5">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-volt">
          Configuration
        </span>
        <h1 className="mt-1 text-3xl font-black text-white">Settings & Preferences</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your biometric profile, unit systems, rest timer cues, and gym equipment inventory.
        </p>
      </header>

      {notice && (
        <Toast type={notice.type} message={notice.text} onClose={() => setNotice(null)} />
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Details */}
        <Card>
          <CardHeader>
            <CardTitle>Biometric & Athlete Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Display Name"
              name="displayName"
              defaultValue={profile.displayName || user?.displayName || ''}
            />
            <Input
              label="Email Address"
              name="email"
              type="email"
              defaultValue={profile.email || user?.email || ''}
            />
            <Input
              label="Age"
              name="age"
              type="number"
              min="13"
              max="120"
              defaultValue={profile.age || ''}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Experience Level
              </label>
              <select
                name="experienceLevel"
                defaultValue={profile.experienceLevel || 'intermediate'}
                className="h-11 w-full rounded-xl border border-obsidian-700 bg-obsidian-950 px-3.5 text-sm font-semibold text-white outline-none focus:border-volt"
              >
                <option value="beginner">Beginner (0–1 year)</option>
                <option value="intermediate">Intermediate (1–3 years)</option>
                <option value="advanced">Advanced (3+ years)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Unit System & Rest Timer Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-volt" /> Training & Rest Timer Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Unit System */}
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Unit System
              </span>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'metric' as UnitSystem, label: 'Metric (kg)', desc: 'Kilograms & cm' },
                  { key: 'imperial' as UnitSystem, label: 'Imperial (lbs)', desc: 'Pounds & inches' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setUnitSystem(item.key)}
                    className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                      unitSystem === item.key
                        ? 'border-volt bg-volt/10 text-volt'
                        : 'border-obsidian-700 bg-obsidian-950 text-slate-400 hover:border-obsidian-600 hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-black text-white">{item.label}</span>
                    <span className="mt-0.5 text-xs text-slate-500">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Default Rest Interval */}
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                Default Rest Duration
              </span>
              <div className="grid grid-cols-4 gap-2">
                {[60, 90, 120, 180].map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setDefaultRestSeconds(secs)}
                    className={`rounded-xl border p-3 font-mono text-sm font-extrabold transition-all ${
                      defaultRestSeconds === secs
                        ? 'border-volt bg-volt/10 text-volt'
                        : 'border-obsidian-700 bg-obsidian-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {secs}s
                  </button>
                ))}
              </div>
            </div>

            {/* Sound & Auto-Start Toggles */}
            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-obsidian-800">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-obsidian-700 bg-obsidian-950 p-4">
                <div className="flex items-center gap-3">
                  {soundEnabled ? (
                    <Volume2 className="h-5 w-5 text-volt" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-slate-500" />
                  )}
                  <div>
                    <span className="block text-sm font-bold text-white">Timer Sound Cues</span>
                    <span className="text-xs text-slate-500">Audio chime on rest complete</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="size-5 accent-volt cursor-pointer"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-obsidian-700 bg-obsidian-950 p-4">
                <div className="flex items-center gap-3">
                  <Timer className="h-5 w-5 text-cyan-400" />
                  <div>
                    <span className="block text-sm font-bold text-white">Auto-Start Rest Timer</span>
                    <span className="text-xs text-slate-500">Starts automatically upon set check</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoStartRestTimer}
                  onChange={(e) => setAutoStartRestTimer(e.target.checked)}
                  className="size-5 accent-volt cursor-pointer"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Equipment Inventory Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-volt" /> Available Gym Equipment Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-slate-400">
              AI plan generation and exercise swapping only propose movements with equipment you own.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {EQUIPMENT_CATALOG.map((item) => {
                const checked = gear.includes(item);
                return (
                  <label
                    key={item}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition-all ${
                      checked
                        ? 'border-volt/40 bg-volt/10 text-white'
                        : 'border-obsidian-700 bg-obsidian-950 text-slate-400 hover:border-obsidian-600'
                    }`}
                  >
                    <span className="text-sm font-bold">{item}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEquipment(item)}
                      className="size-5 accent-volt cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Theme Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Display Theme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {(['dark', 'light'] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`flex items-center justify-center gap-2.5 rounded-xl border p-4 font-bold capitalize transition-all ${
                    theme === mode
                      ? 'border-volt bg-volt/10 text-volt'
                      : 'border-obsidian-700 bg-obsidian-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  {mode === 'dark' ? 'Obsidian Dark (Default)' : 'Titanium Light'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="danger"
            size="lg"
            onClick={() => void logout().then(() => navigate('/auth'))}
          >
            <LogOut className="h-4 w-4" /> Log Out
          </Button>

          <Button type="submit" variant="volt" size="lg" loading={saving}>
            <Save className="h-4 w-4" /> Save Preferences
          </Button>
        </div>
      </form>
    </main>
  );
}
