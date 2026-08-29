import { useEffect, useState, useMemo, type FormEvent, type ReactNode } from 'react';
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
  User,
  Mail,
  Calendar,
  Ruler,
  Weight,
  HeartPulse,
  Sliders,
  Layers,
  UploadCloud,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
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

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="px-1 text-[11px] font-black uppercase tracking-wider text-zinc-500">{title}</h3>
      <div className="overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-900 shadow-lg divide-y divide-zinc-800/70">
        {children}
      </div>
    </div>
  );
}

function SettingInputRow({
  icon: Icon,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
  min,
  max,
}: {
  icon: any;
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  suffix?: string;
  min?: string | number;
  max?: string | number;
}) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors">
      <div className="flex items-center gap-3.5 min-w-0 shrink-0 mr-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-xs sm:text-sm font-bold text-white">{label}</span>
      </div>
      <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
        <input
          type={type}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full max-w-[180px] bg-zinc-950/90 border border-zinc-800 rounded-xl px-3 py-1.5 text-right text-xs sm:text-sm font-bold text-white placeholder-zinc-600 focus:border-lime-400 focus:outline-none font-mono transition-colors"
        />
        {suffix && <span className="text-xs font-bold text-zinc-400 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function SettingToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: any;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-bold text-white truncate">{label}</p>
          {description && <p className="text-[11px] text-zinc-400 truncate mt-0.5">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-lime-400' : 'bg-zinc-800'
        }`}
      >
        <span
          className={`pointer-events-none inline-block size-5 transform rounded-full bg-zinc-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
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

  const bmiCategory = useMemo(() => {
    if (!bmi) return null;
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-amber-400' };
    if (bmi < 25) return { label: 'Optimal / Normal', color: 'text-lime-400' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-amber-400' };
    return { label: 'High Body Mass', color: 'text-red-400' };
  }, [bmi]);

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
                  ATHLETE PRO
                </Badge>
              </div>
              <p className="truncate text-xs font-medium text-zinc-400">{profile.email || user?.email}</p>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Scrollable Grouped Settings List Items (flex-1) */}
      <main className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-2 space-y-6 pb-6">
        {/* GROUP 1: Athlete Biometrics */}
        <SettingSection title="Athlete Profile & Biometrics">
          <SettingInputRow
            icon={User}
            label="Display Name"
            value={profile.displayName || ''}
            onChange={(val) => setProfile((p) => ({ ...p, displayName: val }))}
            placeholder="Athlete Name"
          />

          <SettingInputRow
            icon={Mail}
            label="Email Address"
            type="email"
            value={profile.email || ''}
            onChange={(val) => setProfile((p) => ({ ...p, email: val }))}
            placeholder="name@example.com"
          />

          <SettingInputRow
            icon={Calendar}
            label="Age"
            type="number"
            min="13"
            max="100"
            value={profile.age || ''}
            onChange={(val) => setProfile((p) => ({ ...p, age: Number(val) }))}
            suffix="years"
          />

          <SettingInputRow
            icon={Ruler}
            label="Height"
            type="number"
            min="100"
            max="250"
            value={profile.heightCm || ''}
            onChange={(val) => setProfile((p) => ({ ...p, heightCm: Number(val) }))}
            suffix={unitSystem === 'metric' ? 'cm' : 'in'}
          />

          <SettingInputRow
            icon={Weight}
            label="Weight"
            type="number"
            min="30"
            max="300"
            value={profile.weightKg || ''}
            onChange={(val) => setProfile((p) => ({ ...p, weightKg: Number(val) }))}
            suffix={unitSystem === 'metric' ? 'kg' : 'lb'}
          />

          {bmi && (
            <div className="flex items-center justify-between p-4 bg-zinc-950/40">
              <div className="flex items-center gap-3.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                  <HeartPulse className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white">Body Mass Index (BMI)</p>
                  {bmiCategory && (
                    <p className={`text-[11px] font-bold ${bmiCategory.color}`}>
                      {bmiCategory.label}
                    </p>
                  )}
                </div>
              </div>
              <span className="font-mono text-sm sm:text-base font-black text-lime-400">
                {bmi} <span className="text-[10px] text-zinc-500 font-sans font-bold">kg/m²</span>
              </span>
            </div>
          )}
        </SettingSection>

        {/* GROUP 2: Training Calibration */}
        <SettingSection title="Training Calibration & Lifestyle">
          {/* Biological Sex Row */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-3.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                <UserCheck className="h-4 w-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white">Biological Sex</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-0.5">
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
                      ? 'border-lime-400 bg-lime-400/10 text-lime-400 font-black shadow-sm'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Experience Level Row */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-3.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                <Flame className="h-4 w-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white">Experience Level</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-0.5">
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

          {/* Daily Lifestyle Row */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-3.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                <Activity className="h-4 w-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white">Daily Lifestyle</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-0.5">
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
        </SettingSection>

        {/* GROUP 3: Equipment Inventory */}
        <SettingSection title="Gym Equipment Inventory">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                  <Dumbbell className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-white">Available Equipment</p>
                  <p className="text-[11px] text-zinc-400">{gear.length} of {EQUIPMENT_CATALOG.length} configured</p>
                </div>
              </div>
              <Badge variant="lime" className="text-[10px]">
                {gear.length} ACTIVE
              </Badge>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
            </div>

            {/* Equipment Grid Items */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {EQUIPMENT_CATALOG.map((item) => {
                const active = gear.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleEquipment(item)}
                    className={`flex items-center justify-between rounded-2xl border p-3 text-left transition-all ${
                      active
                        ? 'border-lime-400 bg-lime-400/10 text-white font-bold shadow-sm'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span className="truncate text-xs">{item}</span>
                    <div
                      className={`size-4 rounded-md border flex items-center justify-center shrink-0 ml-1.5 ${
                        active ? 'border-lime-400 bg-lime-400 text-zinc-950' : 'border-zinc-700 bg-zinc-900'
                      }`}
                    >
                      {active && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </SettingSection>

        {/* GROUP 4: Workout & Rest Timer Preferences */}
        <SettingSection title="Workout & Rest Timer Preferences">
          {/* Measurement System Row */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-3.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                <Scale className="h-4 w-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white">Measurement System</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {[
                { key: 'metric' as UnitSystem, label: 'Metric (kg · cm)', desc: 'Kilograms & Centimeters' },
                { key: 'imperial' as UnitSystem, label: 'Imperial (lbs · in)', desc: 'Pounds & Inches' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setUnitSystem(item.key)}
                  className={`flex flex-col rounded-2xl border p-3 text-left transition-all ${
                    unitSystem === item.key
                      ? 'border-lime-400 bg-lime-400/10 text-lime-400 shadow-sm'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black text-white">{item.label}</span>
                  <span className="text-[10px] text-zinc-500">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Default Rest Duration Row */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-3.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                <Timer className="h-4 w-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-white">Default Rest Duration</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-0.5">
              {[60, 90, 120, 180].map((secs) => (
                <button
                  key={secs}
                  type="button"
                  onClick={() => setDefaultRestSeconds(secs)}
                  className={`rounded-2xl border p-2.5 font-mono text-xs sm:text-sm font-black transition-all ${
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

          {/* Sound Effect Toggle Row */}
          <SettingToggleRow
            icon={soundEnabled ? Volume2 : VolumeX}
            label="Timer Audio Cues"
            description="Play athletic chime sound on set and rest completion"
            checked={soundEnabled}
            onChange={setSoundEnabled}
          />

          {/* Auto-Start Rest Clock Row */}
          <SettingToggleRow
            icon={Timer}
            label="Auto-Start Rest Clock"
            description="Automatically trigger countdown timer when a set is checked off"
            checked={autoStartRestTimer}
            onChange={setAutoStartRestTimer}
          />
        </SettingSection>

        {/* GROUP 5: Appearance & Theme */}
        <SettingSection title="Appearance & Display">
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-3.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </div>
              <span className="text-xs sm:text-sm font-bold text-white">Display Theme</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              {(['dark', 'light'] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setTheme(mode)}
                  className={`flex items-center justify-center gap-2.5 rounded-2xl border p-3 font-bold capitalize transition-all ${
                    theme === mode
                      ? 'border-lime-400 bg-lime-400/10 text-lime-400 shadow-sm'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  {mode === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  <span className="text-xs">{mode === 'dark' ? 'Dark Obsidian' : 'Light Titanium'}</span>
                </button>
              ))}
            </div>
          </div>
        </SettingSection>

        {/* GROUP 6: Data & Migration */}
        <SettingSection title="Data & Migration">
          <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-950 border border-zinc-800 text-lime-400">
                <UploadCloud className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-white block">1-Click Workout Importer</span>
                <span className="text-[11px] text-zinc-500 block">Migrate routines & history from Hevy, Strong, Lyfta, or CSV</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/import')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-lime-400/30 bg-lime-400/10 px-3.5 py-1.5 text-xs font-bold text-lime-400 hover:bg-lime-400 hover:text-zinc-950 transition-all shrink-0"
            >
              <span>Import</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </SettingSection>
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
