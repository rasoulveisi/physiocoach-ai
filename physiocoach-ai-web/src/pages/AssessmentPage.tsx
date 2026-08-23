import { useState, useEffect } from 'react';
import {
  Activity,
  Check,
  Clock,
  Dumbbell,
  Flame,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SliderStepper } from '../components/ui/SliderStepper';
import { Toast } from '../components/ui/Toast';
import { apiClient } from '../services/api-client';

// Quick Start Clinical Archetypes
const ARCHETYPES = [
  {
    id: 'posture_desk',
    name: 'Desk Warrior & Posture Fix',
    tagline: 'Combat seated thoracic kyphosis & lumbar compression',
    goals: ['posture_improvement', 'mobility'],
    frequency: 3,
    sessionMinutes: 45,
    equipment: ['dumbbells_only'],
    defaultPain: ['rounded_shoulders', 'lower_back_pain'],
    icon: ShieldCheck,
  },
  {
    id: 'strength_hypertrophy',
    name: 'Powerbuilding & Hypertrophy',
    tagline: 'Compound overload with scapular & knee safeguards',
    goals: ['strength', 'muscle_gain'],
    frequency: 4,
    sessionMinutes: 60,
    equipment: ['full_gym'],
    defaultPain: [],
    icon: Dumbbell,
  },
  {
    id: 'joint_longevity',
    name: 'Joint Resilience & Rehab',
    tagline: 'Bulletproof knees, hips, and rotator cuff',
    goals: ['mobility', 'posture_improvement'],
    frequency: 3,
    sessionMinutes: 45,
    equipment: ['home_gym'],
    defaultPain: ['knee_pain', 'shoulder_pain'],
    icon: Activity,
  },
  {
    id: 'metabolic_conditioning',
    name: 'Metabolic Athlete',
    tagline: 'High work capacity & muscular endurance',
    goals: ['fat_loss', 'recomposition'],
    frequency: 4,
    sessionMinutes: 45,
    equipment: ['full_gym'],
    defaultPain: [],
    icon: Flame,
  },
];

// Interactive Anatomy Pins for Biomechanical Safeguards
const ANATOMY_PINS = [
  { code: 'neck_pain', label: 'Neck & Cervical Spine', region: 'Neck', defaultSide: 'unspecified' },
  { code: 'shoulder_pain', label: 'Shoulders & Rotator Cuff', region: 'Shoulder', defaultSide: 'bilateral' },
  { code: 'rounded_shoulders', label: 'Rounded Shoulders (Protraction)', region: 'Upper Back', defaultSide: 'bilateral' },
  { code: 'lower_back_pain', label: 'Lower Back (Lumbar)', region: 'Lumbar', defaultSide: 'unspecified' },
  { code: 'knee_pain', label: 'Knees (Patellofemoral)', region: 'Knee', defaultSide: 'bilateral' },
  { code: 'forward_head', label: 'Forward Head Posture', region: 'Neck', defaultSide: 'unspecified' },
  { code: 'anterior_pelvic_tilt', label: 'Anterior Pelvic Tilt', region: 'Pelvis', defaultSide: 'bilateral' },
  { code: 'tight_hips', label: 'Tight Hip Flexors / Groin', region: 'Hip', defaultSide: 'bilateral' },
  { code: 'lower_back_discomfort', label: 'Sacroiliac / Lumbar Strain', region: 'Lumbar', defaultSide: 'unspecified' },
];

export function AssessmentPage() {
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const totalSlides = 6;

  const [selectedArchetype, setSelectedArchetype] = useState<string>('posture_desk');
  const [frequencyDays, setFrequencyDays] = useState<number>(3);
  const [sessionMinutes, setSessionMinutes] = useState<number>(45);
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['posture_improvement', 'strength']);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(['full_gym']);

  const [activePains, setActivePains] = useState<
    Record<string, { severity: 'mild' | 'moderate' | 'severe'; side: any }>
  >({
    rounded_shoulders: { severity: 'mild', side: 'bilateral' },
    lower_back_pain: { severity: 'mild', side: 'unspecified' },
  });

  const [profileData, setProfileData] = useState<any>({});
  const [generating, setGenerating] = useState<boolean>(false);
  const [phaseText, setPhaseText] = useState<string>('');
  const [error, setError] = useState<string>('');

  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      apiClient.get<any>('profile').catch(() => null),
      apiClient.get<any>('assessments/latest').catch(() => null),
    ]).then(([profRes, assessRes]) => {
      const p = profRes?.data || profRes;
      if (p) {
        setProfileData(p);
        if (Array.isArray(p.availableEquipment) && p.availableEquipment.length > 0) {
          setSelectedEquipment(p.availableEquipment);
        }
      }

      const a = assessRes?.data || assessRes;
      if (a) {
        if (Array.isArray(a.goals) && a.goals.length > 0) setSelectedGoals(a.goals);
        if (typeof a.frequencyDays === 'number') setFrequencyDays(a.frequencyDays);
        if (typeof a.sessionMinutes === 'number') setSessionMinutes(a.sessionMinutes);
        if (Array.isArray(a.equipment) && a.equipment.length > 0) setSelectedEquipment(a.equipment);
      }
    });
  }, []);

  const handleNext = () => {
    if (currentSlide < totalSlides) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentSlide > 1) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleSelectWithAutoAdvance = (updater: () => void) => {
    updater();
    setTimeout(() => {
      handleNext();
    }, 220);
  };

  const handleSelectArchetype = (archId: string) => {
    const arch = ARCHETYPES.find((a) => a.id === archId);
    if (!arch) return;
    setSelectedArchetype(archId);
    setSelectedGoals(arch.goals);
    setFrequencyDays(arch.frequency);
    setSessionMinutes(arch.sessionMinutes);
    setSelectedEquipment(arch.equipment);

    const newPains: Record<string, { severity: 'mild' | 'moderate' | 'severe'; side: any }> = {};
    arch.defaultPain.forEach((pCode) => {
      const pin = ANATOMY_PINS.find((pin) => pin.code === pCode);
      if (pin) {
        newPains[pCode] = { severity: 'mild', side: pin.defaultSide };
      }
    });
    setActivePains(newPains);

    setTimeout(() => {
      handleNext();
    }, 220);
  };

  const togglePainPin = (code: string) => {
    setActivePains((prev) => {
      const next = { ...prev };
      if (next[code]) {
        delete next[code];
      } else {
        const pin = ANATOMY_PINS.find((p) => p.code === code);
        next[code] = { severity: 'mild', side: pin?.defaultSide || 'unspecified' };
      }
      return next;
    });
  };

  const setPainSeverity = (code: string, severity: 'mild' | 'moderate' | 'severe') => {
    setActivePains((prev) => {
      if (!prev[code]) return prev;
      return { ...prev, [code]: { ...prev[code], severity } };
    });
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal)
        ? prev.length > 1
          ? prev.filter((g) => g !== goal)
          : prev
        : [...prev, goal],
    );
  };

  const toggleEquipment = (gear: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(gear)
        ? prev.length > 1
          ? prev.filter((g) => g !== gear)
          : prev
        : [...prev, gear],
    );
  };

  const painCount = Object.keys(activePains).length;

  const handleSynthesizePlan = async () => {
    setGenerating(true);
    setError('');
    setPhaseText('Validating biomechanical posture matrix & safe loads…');

    try {
      const considerationsPayload = Object.entries(activePains).map(([code, config]) => ({
        code,
        severity: config.severity,
        side: config.side || 'unspecified',
        inferred: false,
      }));

      const limitationCodes = new Set(['shoulder_pain', 'knee_pain', 'lower_back_pain', 'neck_pain']);
      const postureCodes = new Set([
        'rounded_shoulders',
        'forward_head',
        'anterior_pelvic_tilt',
        'tight_hips',
        'lower_back_discomfort',
      ]);

      const limitations = considerationsPayload
        .map((c) => c.code)
        .filter((code): code is 'shoulder_pain' | 'knee_pain' | 'lower_back_pain' | 'neck_pain' =>
          limitationCodes.has(code),
        );

      const postureFlags = considerationsPayload
        .map((c) => c.code)
        .filter((code): code is 'rounded_shoulders' | 'forward_head' | 'anterior_pelvic_tilt' | 'tight_hips' | 'lower_back_discomfort' =>
          postureCodes.has(code),
        );

      const allowedEquipment = ['full_gym', 'home_gym', 'dumbbells_only', 'resistance_bands'] as const;
      const validEquipment = selectedEquipment.filter((e): e is (typeof allowedEquipment)[number] =>
        allowedEquipment.includes(e as any),
      );
      const finalEquipment = validEquipment.length > 0 ? validEquipment : ['full_gym' as const];

      const assessmentPayload = {
        goals: selectedGoals.length > 0 ? selectedGoals : ['strength'],
        frequencyDays: Math.min(5, Math.max(2, frequencyDays)),
        sessionMinutes,
        equipment: finalEquipment,
        considerations: considerationsPayload,
        limitations,
        postureFlags,
      };

      setPhaseText('Registering clinical assessment & injury risk flags…');
      await apiClient.post('assessments', assessmentPayload);

      setPhaseText('Synthesizing evidence-based workout split…');
      await apiClient.post('workout-plans/generate', {
        profile: {
          age: profileData.age || 28,
          sex: profileData.sex || 'prefer_not_to_say',
          heightCm: profileData.heightCm || 178,
          weightKg: profileData.weightKg || 75,
          lifestyle: profileData.lifestyle || 'active',
          experienceLevel: profileData.experienceLevel || 'intermediate',
        },
        assessment: assessmentPayload,
      });

      navigate('/plan');
    } catch (cause) {
      console.error('Plan synthesis error:', cause);
      setError(cause instanceof Error ? cause.message : 'Could not generate workout plan.');
      setGenerating(false);
    }
  };

  return (
    <>
      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      {/* SLIDE 1: ATHLETIC ARCHETYPE FOCUS */}
      {currentSlide === 1 && (
        <SliderStepper
          currentStep={1}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="Choose your training archetype"
          subtitle="Pre-configures optimal volume, joint protection, and biomechanical targets."
          badge="Archetype"
        >
          <div className="grid gap-3 w-full max-w-md">
            {ARCHETYPES.map((arch) => {
              const isSelected = selectedArchetype === arch.id;
              const Icon = arch.icon;
              return (
                <button
                  key={arch.id}
                  type="button"
                  onClick={() => handleSelectArchetype(arch.id)}
                  className={`flex items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    isSelected
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div
                    className={`grid size-11 place-items-center rounded-xl shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-lime-400 text-zinc-950 font-black'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <Icon className="h-5 w-5 stroke-[2.5]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-white">{arch.name}</h3>
                      {isSelected && <Check className="h-4 w-4 text-lime-400 stroke-[3]" />}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{arch.tagline}</p>
                    <div className="mt-2 flex items-center gap-3 font-mono text-[11px] text-zinc-500">
                      <span>{arch.frequency} Days/Wk</span>
                      <span>•</span>
                      <span>{arch.sessionMinutes} Min/Session</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SliderStepper>
      )}

      {/* SLIDE 2: TRAINING FREQUENCY */}
      {currentSlide === 2 && (
        <SliderStepper
          currentStep={2}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="Weekly training schedule"
          subtitle="How many days per week would you like to workout?"
          badge="Frequency"
        >
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {[2, 3, 4, 5].map((num) => {
              const active = frequencyDays === num;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleSelectWithAutoAdvance(() => setFrequencyDays(num))}
                  className={`h-24 rounded-2xl border p-4 flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${
                    active
                      ? 'border-lime-400 bg-lime-400 text-zinc-950 font-black shadow-sm scale-105'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <span className="text-3xl font-black tabular-nums">{num}</span>
                  <span className="text-xs font-bold uppercase tracking-wider mt-0.5">Days / Week</span>
                </button>
              );
            })}
          </div>
        </SliderStepper>
      )}

      {/* SLIDE 3: SESSION DURATION */}
      {currentSlide === 3 && (
        <SliderStepper
          currentStep={3}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="Session time estimate"
          subtitle="Calibrates work-to-rest intervals and total programmed volume."
          badge="Duration"
        >
          <div className="grid gap-3 w-full max-w-md">
            {[
              { mins: 30, label: '30 Minutes', desc: 'Express / High-density training with focused compounds.' },
              { mins: 45, label: '45 Minutes', desc: 'Balanced hypertrophy split with optimal recovery.' },
              { mins: 60, label: '60 Minutes', desc: 'Full compound strength work with progressive load sets.' },
              { mins: 75, label: '75+ Minutes', desc: 'Comprehensive athlete session including warm-ups & accessories.' },
            ].map((item) => {
              const active = sessionMinutes === item.mins;
              return (
                <button
                  key={item.mins}
                  type="button"
                  onClick={() => handleSelectWithAutoAdvance(() => setSessionMinutes(item.mins))}
                  className={`rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-white">{item.label}</span>
                    <Clock className={`h-4 w-4 ${active ? 'text-lime-400' : 'text-zinc-500'}`} />
                  </div>
                  <span className="mt-1 block text-xs text-zinc-400 leading-relaxed">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </SliderStepper>
      )}

      {/* SLIDE 4: EQUIPMENT */}
      {currentSlide === 4 && (
        <SliderStepper
          currentStep={4}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="Available gym equipment"
          subtitle="Select the equipment you have available for this cycle."
          badge="Equipment"
        >
          <div className="grid gap-3 w-full max-w-md">
            {[
              { id: 'full_gym', label: 'Full Commercial Gym', desc: 'Barbells, dumbbells, cables, squat racks, leg press, machines' },
              { id: 'home_gym', label: 'Home Gym Setup', desc: 'Barbell, squat rack, adjustable bench, select dumbbells' },
              { id: 'dumbbells_only', label: 'Dumbbells & Flat Bench', desc: 'Pair of adjustable dumbbells and bench/floor' },
              { id: 'resistance_bands', label: 'Bands & Bodyweight', desc: 'Loop bands, pull-up bar, and calisthenics floor setup' },
            ].map((gear) => {
              const active = selectedEquipment.includes(gear.id);
              return (
                <button
                  key={gear.id}
                  type="button"
                  onClick={() => toggleEquipment(gear.id)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-white">{gear.label}</span>
                    <div
                      className={`size-5 rounded-md border flex items-center justify-center shrink-0 ${
                        active ? 'border-lime-400 bg-lime-400 text-zinc-950' : 'border-zinc-700 bg-zinc-800'
                      }`}
                    >
                      {active && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                  </div>
                  <span className="mt-1 block text-xs text-zinc-400 leading-relaxed">{gear.desc}</span>
                </button>
              );
            })}
          </div>
        </SliderStepper>
      )}

      {/* SLIDE 5: JOINT SAFEGUARD MATRIX */}
      {currentSlide === 5 && (
        <SliderStepper
          currentStep={5}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="Joint sensitivities & posture pain"
          subtitle="Contraindicated exercises causing harmful shearing or impingement will be filtered."
          badge={`${painCount} Safeguards`}
        >
          <div className="grid gap-2.5 w-full max-w-lg">
            {ANATOMY_PINS.map((pin) => {
              const active = activePains[pin.code];
              return (
                <div
                  key={pin.code}
                  className={`rounded-2xl border p-3.5 transition-all ${
                    active
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => togglePainPin(pin.code)}
                      className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                    >
                      <div
                        className={`size-5 rounded-md border flex items-center justify-center shrink-0 ${
                          active
                            ? 'border-amber-400 bg-amber-400 text-zinc-950'
                            : 'border-zinc-700 bg-zinc-800'
                        }`}
                      >
                        {active && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                      <span className="truncate text-xs sm:text-sm font-bold text-white">{pin.label}</span>
                    </button>

                    {active && (
                      <div className="flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 text-[10px]">
                        {(['mild', 'moderate', 'severe'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setPainSeverity(pin.code, s)}
                            className={`rounded px-2 py-0.5 font-bold uppercase transition-colors ${
                              active.severity === s
                                ? s === 'severe'
                                  ? 'bg-red-500/30 text-red-300'
                                  : s === 'moderate'
                                  ? 'bg-amber-500/30 text-amber-300'
                                  : 'bg-emerald-500/30 text-emerald-300'
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {s[0].toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SliderStepper>
      )}

      {/* SLIDE 6: GOALS & GENERATION ACTION */}
      {currentSlide === 6 && (
        <SliderStepper
          currentStep={6}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleSynthesizePlan}
          nextButtonText="Generate My AI Workout Plan"
          nextButtonLoading={generating}
          title="Primary training objectives"
          subtitle="Our clinical algorithm will balance progressive overload with posture restoration."
          badge="Goals"
        >
          <div className="grid gap-2.5 sm:grid-cols-2 w-full max-w-lg mb-4">
            {[
              { id: 'posture_improvement', label: 'Posture Correction', desc: 'Fix rounded shoulders & anterior tilt' },
              { id: 'strength', label: 'Maximum Strength', desc: 'Compound overload & neural drive' },
              { id: 'muscle_gain', label: 'Muscular Hypertrophy', desc: 'Muscle volume & aesthetic definition' },
              { id: 'mobility', label: 'Joint Mobility & Resilience', desc: 'Resilient knees, hips, and rotator cuff' },
              { id: 'fat_loss', label: 'Metabolic Fat Loss', desc: 'High density conditioning & calorie burn' },
              { id: 'recomposition', label: 'Body Recomposition', desc: 'Simultaneous lean gain & fat reduction' },
            ].map((g) => {
              const active = selectedGoals.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGoal(g.id)}
                  className={`rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">{g.label}</span>
                    {active && <Check className="h-4 w-4 text-lime-400 stroke-[3]" />}
                  </div>
                  <span className="mt-1 block text-xs text-zinc-400">{g.desc}</span>
                </button>
              );
            })}
          </div>

          {generating && (
            <div className="w-full max-w-md rounded-2xl border border-lime-400/30 bg-lime-400/10 p-5 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 font-mono text-xs font-bold text-lime-400">
                <span className="size-2 rounded-full bg-lime-400 animate-ping" />
                <span>{phaseText}</span>
              </div>
            </div>
          )}
        </SliderStepper>
      )}
    </>
  );
}
