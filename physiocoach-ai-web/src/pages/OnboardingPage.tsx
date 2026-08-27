import { useState, useEffect } from 'react';
import {
  Activity,
  Check,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SliderStepper } from '../components/ui/SliderStepper';
import { NumberStepper } from '../components/ui/NumberStepper';
import { Toast } from '../components/ui/Toast';
import { apiClient } from '../services/api-client';

// Interactive Body Regions for Clinical Safeguards
const ANATOMY_PINS = [
  { code: 'neck_pain', label: 'Neck & Cervical Spine', region: 'Neck', defaultSide: 'unspecified' as const },
  { code: 'shoulder_pain', label: 'Shoulders & Rotator Cuff', region: 'Shoulder', defaultSide: 'bilateral' as const },
  { code: 'rounded_shoulders', label: 'Rounded Shoulders (Kyphosis)', region: 'Upper Back', defaultSide: 'bilateral' as const },
  { code: 'lower_back_pain', label: 'Lower Back (Lumbar)', region: 'Lumbar', defaultSide: 'unspecified' as const },
  { code: 'knee_pain', label: 'Knees (Patellofemoral)', region: 'Knee', defaultSide: 'bilateral' as const },
  { code: 'forward_head', label: 'Forward Head Posture', region: 'Neck', defaultSide: 'unspecified' as const },
  { code: 'anterior_pelvic_tilt', label: 'Anterior Pelvic Tilt', region: 'Pelvis', defaultSide: 'bilateral' as const },
  { code: 'tight_hips', label: 'Tight Hip Flexors / Groin', region: 'Hip', defaultSide: 'bilateral' as const },
  { code: 'lower_back_discomfort', label: 'Sacroiliac / Back Discomfort', region: 'Lumbar', defaultSide: 'unspecified' as const },
];

export function OnboardingPage() {
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const totalSlides = 11;

  // Slide 1: Sex
  const [sex, setSex] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>('prefer_not_to_say');

  // Slide 2: Age
  const [age, setAge] = useState<number>(28);

  // Slide 3: Height
  const [heightCm, setHeightCm] = useState<number>(178);

  // Slide 4: Weight
  const [weightKg, setWeightKg] = useState<number>(75);

  // Slide 5: Lifestyle
  const [lifestyle, setLifestyle] = useState<'desk_job' | 'standing_job' | 'active'>('active');

  // Slide 6: Experience
  const [experienceLevel, setExperienceLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');

  // Slide 7: Frequency
  const [frequencyDays, setFrequencyDays] = useState<number>(3);

  // Slide 8: Session Duration Estimate
  const [sessionMinutes, setSessionMinutes] = useState<number>(45);

  // Slide 9: Equipment
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(['full_gym']);

  // Slide 10: Pain / Safeguards
  const [activePains, setActivePains] = useState<
    Record<string, { severity: 'mild' | 'moderate' | 'severe'; side: 'left' | 'right' | 'bilateral' | 'unspecified' }>
  >({
    rounded_shoulders: { severity: 'mild', side: 'bilateral' },
    lower_back_pain: { severity: 'mild', side: 'unspecified' },
  });

  // Slide 11: Goals
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['posture_improvement', 'strength']);

  // Loading & Submission State
  const [generating, setGenerating] = useState<boolean>(false);
  const [phaseText, setPhaseText] = useState<string>('');
  const [error, setError] = useState<string>('');

  const navigate = useNavigate();

  // Load existing profile if available; redirect to dashboard if user already has an active plan
  useEffect(() => {
    Promise.all([
      apiClient.get<any>('profile').catch(() => null),
      apiClient.get<any>('workout-plans/current').catch(() => null),
    ])
      .then(([profRes, planRes]) => {
        const rootPlan = planRes?.data || planRes;
        const actualPlan = rootPlan?.plan || rootPlan;
        if (actualPlan && Array.isArray(actualPlan.days) && actualPlan.days.length > 0) {
          navigate('/dashboard', { replace: true });
          return;
        }

        const p = profRes?.data || profRes;
        if (p) {
          if (p.age) setAge(p.age);
          if (p.sex) setSex(p.sex);
          if (p.heightCm) setHeightCm(p.heightCm);
          if (p.weightKg) setWeightKg(p.weightKg);
          if (p.lifestyle) setLifestyle(p.lifestyle);
          if (p.experienceLevel) setExperienceLevel(p.experienceLevel);
          if (Array.isArray(p.availableEquipment) && p.availableEquipment.length > 0) {
            setSelectedEquipment(p.availableEquipment);
          }
        }
      })
      .catch(() => {});
  }, [navigate]);

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

  const toggleEquipment = (gear: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(gear)
        ? prev.length > 1
          ? prev.filter((g) => g !== gear)
          : prev
        : [...prev, gear],
    );
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

  const painCount = Object.keys(activePains).length;

  // Full Coordinated 3-Step Plan Generation Submit
  const handleGeneratePlan = async () => {
    setGenerating(true);
    setError('');
    setPhaseText('Calibrating biometrics and training frequency…');

    try {
      const normalizedAge = Math.min(100, Math.max(13, Math.round(age || 28)));
      const normalizedHeight = Math.min(250, Math.max(100, Math.round(heightCm || 178)));
      const normalizedWeight = Math.min(300, Math.max(30, Math.round(weightKg || 75)));

      const allowedEquipment = ['full_gym', 'home_gym', 'dumbbells_only', 'resistance_bands'] as const;
      const validEquipment = selectedEquipment.filter((e): e is (typeof allowedEquipment)[number] =>
        allowedEquipment.includes(e as any),
      );
      const finalEquipment = validEquipment.length > 0 ? validEquipment : ['full_gym' as const];

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

      const profilePayload = {
        age: normalizedAge,
        sex,
        heightCm: normalizedHeight,
        weightKg: normalizedWeight,
        lifestyle,
        experienceLevel,
        availableEquipment: finalEquipment,
      };

      const assessmentPayload = {
        goals: selectedGoals.length > 0 ? selectedGoals : ['strength'],
        frequencyDays: Math.min(5, Math.max(2, frequencyDays)),
        sessionMinutes,
        equipment: finalEquipment,
        considerations: considerationsPayload,
        limitations,
        postureFlags,
      };

      // Step 1: Save athlete profile biometrics
      setPhaseText('Saving athlete biometrics & lifestyle…');
      await apiClient.patch('profile', profilePayload);

      // Step 2: Save clinical assessment record
      setPhaseText('Registering clinical assessment & posture flags…');
      await apiClient.post('assessments', assessmentPayload);

      // Step 3: Trigger real AI workout plan generation
      setPhaseText('Synthesizing evidence-based AI workout split…');
      await apiClient.post('workout-plans/generate', {
        profile: profilePayload,
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

      {/* SLIDE 1: BIOLOGICAL SEX */}
      {currentSlide === 1 && (
        <SliderStepper
          currentStep={1}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="What is your biological sex?"
          subtitle="Used to calculate baseline metabolic rate and biomechanical loading equations."
          badge="Biology"
        >
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {[
              { id: 'male', label: 'Male' },
              { id: 'female', label: 'Female' },
              { id: 'other', label: 'Other' },
              { id: 'prefer_not_to_say', label: 'Prefer not to say' },
            ].map((item) => {
              const active = sex === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectWithAutoAdvance(() => setSex(item.id as any))}
                  className={`h-24 rounded-2xl border p-4 flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <span className="text-base font-black tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </SliderStepper>
      )}

      {/* SLIDE 2: AGE */}
      {currentSlide === 2 && (
        <SliderStepper
          currentStep={2}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="How old are you?"
          subtitle="Age influences recovery rate and progressive overload velocity."
          badge="Biometrics"
        >
          <NumberStepper
            value={age}
            onChange={setAge}
            min={13}
            max={100}
            unit="Years Old"
          />
        </SliderStepper>
      )}

      {/* SLIDE 3: HEIGHT */}
      {currentSlide === 3 && (
        <SliderStepper
          currentStep={3}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="What is your height?"
          subtitle="Determines lever lengths and biomechanical ranges of motion."
          badge="Anthropometrics"
        >
          <NumberStepper
            value={heightCm}
            onChange={setHeightCm}
            min={100}
            max={240}
            unit="Centimeters (cm)"
          />
        </SliderStepper>
      )}

      {/* SLIDE 4: WEIGHT */}
      {currentSlide === 4 && (
        <SliderStepper
          currentStep={4}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="What is your current weight?"
          subtitle="Calibrates relative strength targets and caloric expenditure."
          badge="Anthropometrics"
        >
          <NumberStepper
            value={weightKg}
            onChange={setWeightKg}
            min={35}
            max={250}
            unit="Kilograms (kg)"
          />
        </SliderStepper>
      )}

      {/* SLIDE 5: LIFESTYLE */}
      {currentSlide === 5 && (
        <SliderStepper
          currentStep={5}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="What does your day look like?"
          subtitle="Daily seated duration highlights postural risks like anterior pelvic tilt."
          badge="Daily Activity"
        >
          <div className="grid gap-3 w-full max-w-md">
            {[
              {
                id: 'desk_job',
                title: 'Desk Job / Seated',
                desc: 'Prolonged sitting with kyphosis or lumbar compression risks',
              },
              {
                id: 'standing_job',
                title: 'Standing Job',
                desc: 'On your feet most of the day, moderate daily energy expenditure',
              },
              {
                id: 'active',
                title: 'Physically Active',
                desc: 'High daily movement, physical labor, or high athletic baseline',
              },
            ].map((item) => {
              const active = lifestyle === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectWithAutoAdvance(() => setLifestyle(item.id as any))}
                  className={`rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="block text-base font-black text-white">{item.title}</span>
                  <span className="mt-1 block text-xs text-zinc-400 leading-relaxed">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </SliderStepper>
      )}

      {/* SLIDE 6: EXPERIENCE */}
      {currentSlide === 6 && (
        <SliderStepper
          currentStep={6}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="What is your lifting experience?"
          subtitle="Guides exercise complexity and neuromuscular loading protocols."
          badge="Experience"
        >
          <div className="grid gap-3 w-full max-w-md">
            {[
              { id: 'beginner', label: 'Beginner (< 1 Year)', desc: 'Focus on movement mechanics, posture cues, and base motor learning.' },
              { id: 'intermediate', label: 'Intermediate (1–3 Years)', desc: 'Consistent resistance training background ready for progressive overload.' },
              { id: 'advanced', label: 'Advanced (3+ Years)', desc: 'High volume work capacity and specialized biomechanical variations.' },
            ].map((lvl) => {
              const active = experienceLevel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => handleSelectWithAutoAdvance(() => setExperienceLevel(lvl.id as any))}
                  className={`rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="block text-base font-black text-white">{lvl.label}</span>
                  <span className="mt-1 block text-xs text-zinc-400 leading-relaxed">{lvl.desc}</span>
                </button>
              );
            })}
          </div>
        </SliderStepper>
      )}

      {/* SLIDE 7: FREQUENCY */}
      {currentSlide === 7 && (
        <SliderStepper
          currentStep={7}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="How many days can you train?"
          subtitle="We engineer an optimal push/pull/legs or upper/lower frequency split."
          badge="Schedule"
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

      {/* SLIDE 8: SESSION DURATION ESTIMATE */}
      {currentSlide === 8 && (
        <SliderStepper
          currentStep={8}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="How long is your ideal workout?"
          subtitle="Calibrates rest intervals and total number of working sets per day."
          badge="Duration"
        >
          <div className="grid gap-3 w-full max-w-md">
            {[
              { mins: 30, label: '30 Minutes', desc: 'Express / High-density circuit with minimal downtime.' },
              { mins: 45, label: '45 Minutes', desc: 'Standard hypertrophy split balancing strength & recovery.' },
              { mins: 60, label: '60 Minutes', desc: 'Full compound strength work with optimal rest sets.' },
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

      {/* SLIDE 9: EQUIPMENT */}
      {currentSlide === 9 && (
        <SliderStepper
          currentStep={9}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="What equipment do you have?"
          subtitle="Every programmed movement will strictly conform to your available gear."
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

      {/* SLIDE 10: JOINT SAFEGUARDS & PAIN MATRIX */}
      {currentSlide === 10 && (
        <SliderStepper
          currentStep={10}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleNext}
          title="Any joint discomfort or pain?"
          subtitle="Exercises causing impingement or shearing loads will be filtered out."
          badge={`${painCount} Safeguards`}
        >
          <div className="grid gap-2.5 w-full max-w-lg max-h-[50vh] overflow-y-auto pr-1">
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

      {/* SLIDE 11: GOALS & GENERATE ACTION */}
      {currentSlide === 11 && (
        <SliderStepper
          currentStep={11}
          totalSteps={totalSlides}
          onBack={handleBack}
          onNext={handleGeneratePlan}
          nextButtonText="Generate My AI Workout Plan"
          nextButtonLoading={generating}
          title="What are your primary goals?"
          subtitle="Select 1 or more focus areas to synthesize your personalized training split."
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
