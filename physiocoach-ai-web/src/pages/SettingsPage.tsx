import { useEffect, useState, useMemo, type FormEvent } from 'react';
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
  UserCheck,
  Activity,
  Check,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Toast } from '../components/ui/Toast';
import { SettingsSkeleton } from '../components/ui/Skeleton';
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
  sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say' | string;
  heightCm?: number;
  weightKg?: number;
  bodyFatEstimate?: number;
  lifestyle?: 'desk_job' | 'standing_job' | 'active' | string;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | string;
  availableEquipment?: string[];
}

export function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
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

  const [profile, setProfile] = useState<ProfileData>({
    displayName: user?.displayName || '',
    email: user?.email || '',
    age: 30,
    sex: 'prefer_not_to_say',
    heightCm: 175,
    weightKg: 75,
    lifestyle: 'active',
    experienceLevel: 'intermediate',
  });
  const [gear, setGear] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient
      .get<any>('profile')
      .then((res) => {
        const data = res?.data || res;
        if (data) {
          setProfile((prev) => ({
            ...prev,
            ...data,
            displayName: data.displayName || prev.displayName,
            email: data.email || prev.email,
          }));
          if (Array.isArray(data.availableEquipment)) {
            setGear(data.availableEquipment);
          }
        }
      })
      .catch(() => {
        // Retain initial profile from auth state
      })
      .finally(() => setLoading(false));
  }, []);

  const athleteName = profile.displayName || user?.displayName || user?.email?.split('@')[0] || 'Athlete';
  const athleteInitials =
    athleteName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'RA';

  const bmi = useMemo(() => {
    if (!profile.heightCm || !profile.weightKg) return null;
    const heightM = profile.heightCm / 100;
    const calculated = profile.weightKg / (heightM * heightM);
    return Math.round(calculated * 10) / 10;
  }, [profile.heightCm, profile.weightKg]);

  const toggleEquipment = (item: string) => {
    setGear((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  };

  const applyPresetGear = (preset: 'full' | 'dumbbells' | 'bodyweight' | 'all' | 'none') => {
    if (preset === 'full') {
      setGear(['Bodyweight', 'Dumbbells', 'Barbell', 'Bench', 'Cable machine', 'Squat rack', 'Pull-up bar']);
    } else if (preset === 'dumbbells') {
      setGear(['Bodyweight', 'Dumbbells', 'Bench']);
    } else if (preset === 'bodyweight') {
      setGear(['Bodyweight', 'Pull-up bar']);
    } else if (preset === 'all') {
      setGear([...EQUIPMENT_CATALOG]);
    } else {
      setGear([]);
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    const displayName = (profile.displayName || '').trim();
    const email = (profile.email || '').trim();
    const ageVal = Number(profile.age);
    const heightVal = Number(profile.heightCm);
    const weightVal = Number(profile.weightKg);

    try {
      const res = await apiClient.patch<any>('profile', {
        displayName: displayName || undefined,
        email: email || undefined,
        age: Number.isFinite(ageVal) && ageVal > 0 ? ageVal : 30,
        sex: profile.sex || 'prefer_not_to_say',
        heightCm: Number.isFinite(heightVal) && heightVal > 0 ? heightVal : 175,
        weightKg: Number.isFinite(weightVal) && weightVal > 0 ? weightVal : 75,
        lifestyle: profile.lifestyle || 'active',
        experienceLevel: profile.experienceLevel || 'intermediate',
        availableEquipment: gear,
      });

      const updated = res?.data || res;
      if (updated) {
        setProfile((prev) => ({ ...prev, ...updated }));
        updateUser({
          displayName: updated.displayName || displayName,
          email: updated.email || email,
        });
      }

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

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <form onSubmit={handleSave} className="h-full w-full max-w-2xl mx-auto flex flex-col overflow-hidden text-zinc-50 select-none selection:bg-lime-400 selection:text-zinc-950">
      {notice && (
        <Toast type={notice.type} message={notice.text} onClose={() => setNotice(null)} />
      )}

      {/* 1. Athlete Header Card (shrink-0) */}
      <header className="shrink-0 p-4 sm:p-6 pb-2">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 shadow-xl">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lime-400/10 blur-3xl" />

          <div className="flex items-center gap-4">
            <div className="grid size-12 sm:size-14 shrink-0 place-items-center rounded-2xl border border-zinc-800 bg-zinc-950 font-mono text-lg sm:text-xl font-black text-lime-400 shadow-md">
              {athleteInitials}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base sm:text-lg font-black text-white capitalize">
                  {athleteName}
                </h1>
                <Badge variant="lime" className="text-[10px]">
                  ATHLETE
                </Badge>
              </div>
              <p className="truncate text-xs font-medium text-zinc-400">{profile.email || user?.email}</p>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Scrollable Settings Form Content (flex-1) */}
      <main className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-2 space-y-6 pb-6">
        {/* Section 1: Biometric & Athlete Profile */}
        <Card className="rounded-3xl border-zinc-800 bg-zinc-900 shadow-lg">
          <CardHeader className="p-5 pb-3 border-b border-zinc-800/80">
            <CardTitle className="flex items-center gap-2 text-base font-black text-white">
              <UserCheck className="h-4 w-4 text-lime-400" /> Biometric & Personal Profile
            </CardTitle>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Display Name
                </label>
                <Input
                  name="displayName"
                  value={profile.displayName || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="Your Name"
                  className="border-zinc-800 bg-zinc-950 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Email Address
                </label>
                <Input
                  name="email"
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  placeholder="name@example.com"
                  className="border-zinc-800 bg-zinc-950 text-white font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Age (Years)
                </label>
                <Input
                  name="age"
                  type="number"
                  min="13"
                  max="100"
                  value={profile.age || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, age: Number(e.target.value) }))}
                  className="border-zinc-800 bg-zinc-950 text-white font-mono font-bold text-center"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Height ({unitSystem === 'metric' ? 'cm' : 'in'})
                </label>
                <Input
                  name="heightCm"
                  type="number"
                  min="100"
                  max="250"
                  value={profile.heightCm || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, heightCm: Number(e.target.value) }))}
                  className="border-zinc-800 bg-zinc-950 text-white font-mono font-bold text-center"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                  Weight ({unitSystem === 'metric' ? 'kg' : 'lb'})
                </label>
                <Input
                  name="weightKg"
                  type="number"
                  min="30"
                  max="300"
                  value={profile.weightKg || ''}
                  onChange={(e) => setProfile((p) => ({ ...p, weightKg: Number(e.target.value) }))}
                  className="border-zinc-800 bg-zinc-950 text-white font-mono font-bold text-center"
                />
              </div>
            </div>

            {/* Live BMI Calculation Badge */}
            {bmi && (
              <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2.5">
                <span className="text-xs font-bold text-zinc-400">Estimated Body Mass Index (BMI)</span>
                <span className="font-mono text-sm font-black text-lime-400">{bmi} kg/m²</span>
              </div>
            )}

            {/* Sex Selection */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                Biological Sex
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'male', label: 'Male' },
                  { key: 'female', label: 'Female' },
                  { key: 'prefer_not_to_say', label: 'Other' },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, sex: s.key }))}
                    className={`rounded-2xl border p-2.5 text-xs font-bold transition-all ${
                      profile.sex === s.key
                        ? 'border-lime-400 bg-lime-400/10 text-lime-400 font-black'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experience Level */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                Training Experience Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'beginner', label: 'Beginner', desc: '0–1 yr' },
                  { key: 'intermediate', label: 'Intermediate', desc: '1–3 yrs' },
                  { key: 'advanced', label: 'Advanced', desc: '3+ yrs' },
                ].map((lvl) => (
                  <button
                    key={lvl.key}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, experienceLevel: lvl.key }))}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all ${
                      profile.experienceLevel === lvl.key
                        ? 'border-lime-400 bg-lime-400/10 text-lime-400 shadow-sm'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-extrabold">{lvl.label}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{lvl.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Lifestyle */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">
                Daily Occupation & Lifestyle
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'desk_job', label: 'Desk Job', desc: 'Sedentary' },
                  { key: 'standing_job', label: 'Standing', desc: 'Moderate' },
                  { key: 'active', label: 'Athletic', desc: 'Active' },
                ].map((act) => (
                  <button
                    key={act.key}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, lifestyle: act.key }))}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 transition-all ${
                      profile.lifestyle === act.key
                        ? 'border-lime-400 bg-lime-400/10 text-lime-400 shadow-sm'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-extrabold">{act.label}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{act.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Training & Rest Timer Preferences */}
        <Card className="rounded-3xl border-zinc-800 bg-zinc-900 shadow-lg">
          <CardHeader className="p-5 pb-3 border-b border-zinc-800/80">
            <CardTitle className="flex items-center gap-2 text-base font-black text-white">
              <Timer className="h-4 w-4 text-lime-400" /> Workout & Rest Timer Preferences
            </CardTitle>
          </CardHeader>

          <CardContent className="p-5 space-y-5">
            {/* Unit System */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">
                Measurement System
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'metric' as UnitSystem, label: 'Metric (kg · cm)', desc: 'Kilograms, Centimeters' },
                  { key: 'imperial' as UnitSystem, label: 'Imperial (lbs · in)', desc: 'Pounds, Inches' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setUnitSystem(item.key)}
                    className={`flex flex-col rounded-2xl border p-3.5 text-left transition-all ${
                      unitSystem === item.key
                        ? 'border-lime-400 bg-lime-400/10 text-lime-400 shadow-sm'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-black text-white">{item.label}</span>
                    <span className="mt-0.5 text-[10px] text-zinc-500">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Default Rest Duration */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2">
                Default Rest Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[60, 90, 120, 180].map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setDefaultRestSeconds(secs)}
                    className={`rounded-2xl border p-2.5 font-mono text-sm font-black transition-all ${
                      defaultRestSeconds === secs
                        ? 'border-lime-400 bg-lime-400 text-zinc-950 shadow-md scale-[1.02]'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {secs}s
                  </button>
                ))}
              </div>
            </div>

            {/* Sound & Auto-Start Toggles */}
            <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-zinc-900 text-lime-400 border border-zinc-800">
                    {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-zinc-500" />}
                  </div>
                  <div>
                    <span className="block text-xs sm:text-sm font-bold text-white">Timer Audio Cues</span>
                    <span className="text-[10px] text-zinc-500">Chime on set & rest completion</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="size-5 accent-lime-400 cursor-pointer rounded"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-zinc-900 text-lime-400 border border-zinc-800">
                    <Timer className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs sm:text-sm font-bold text-white">Auto-Start Rest Clock</span>
                    <span className="text-[10px] text-zinc-500">Triggers immediately upon set check</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={autoStartRestTimer}
                  onChange={(e) => setAutoStartRestTimer(e.target.checked)}
                  className="size-5 accent-lime-400 cursor-pointer rounded"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Available Equipment Inventory */}
        <Card className="rounded-3xl border-zinc-800 bg-zinc-900 shadow-lg">
          <CardHeader className="p-5 pb-3 border-b border-zinc-800/80">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-black text-white">
                <Dumbbell className="h-4 w-4 text-lime-400" /> Gym Equipment Inventory
              </CardTitle>
              <Badge variant="lime" className="text-[10px]">
                {gear.length} / {EQUIPMENT_CATALOG.length}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPresetGear('full')}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:border-lime-400 hover:text-lime-400 transition-colors"
              >
                Commercial Gym
              </button>
              <button
                type="button"
                onClick={() => applyPresetGear('dumbbells')}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:border-lime-400 hover:text-lime-400 transition-colors"
              >
                Dumbbells Only
              </button>
              <button
                type="button"
                onClick={() => applyPresetGear('bodyweight')}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:border-lime-400 hover:text-lime-400 transition-colors"
              >
                Bodyweight
              </button>
              <button
                type="button"
                onClick={() => applyPresetGear('all')}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-zinc-400 hover:border-lime-400 hover:text-lime-400 transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => applyPresetGear('none')}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[10px] font-bold text-zinc-500 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Equipment Grid */}
            <div className="grid gap-2 sm:grid-cols-2">
              {EQUIPMENT_CATALOG.map((item) => {
                const checked = gear.includes(item);
                return (
                  <label
                    key={item}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition-all ${
                      checked
                        ? 'border-lime-400/40 bg-lime-400/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs sm:text-sm font-bold">{item}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEquipment(item)}
                      className="size-4 accent-lime-400 cursor-pointer rounded"
                    />
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Display Theme */}
        <Card className="rounded-3xl border-zinc-800 bg-zinc-900 shadow-lg">
          <CardHeader className="p-5 pb-3 border-b border-zinc-800/80">
            <CardTitle className="text-base font-black text-white">Display Theme</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 gap-3">
              {(['dark', 'light'] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`flex items-center justify-center gap-2.5 rounded-2xl border p-3.5 font-bold capitalize transition-all ${
                    theme === mode
                      ? 'border-lime-400 bg-lime-400/10 text-lime-400 shadow-sm'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <span className="text-xs sm:text-sm">{mode === 'dark' ? 'Dark Obsidian' : 'Light Titanium'}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

      </main>

      {/* 3. Anchored Bottom Actions Bar */}
      <footer className="shrink-0 w-full p-4 border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="danger"
          size="lg"
          pill={true}
          onClick={() => void logout().then(() => navigate('/auth'))}
          className="text-xs sm:text-sm font-bold"
        >
          <LogOut className="h-4 w-4 mr-1.5" /> Log Out
        </Button>

        <Button
          type="submit"
          variant="volt"
          size="lg"
          pill={true}
          loading={saving}
          className="shadow-lg shadow-lime-400/20 font-black text-xs sm:text-sm px-6"
        >
          <Save className="h-4 w-4 mr-1.5" /> Save Preferences
        </Button>
      </footer>
    </form>
  );
}
