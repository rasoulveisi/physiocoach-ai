import { useState, useEffect } from 'react';
import {
  Activity,
  Check,
  Clock,
  Dumbbell,
  Flame,
  HeartPulse,
  Info,
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
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
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

      const finalEquipment = selectedEquipment.length > 0 ? selectedEquipment : ['full_gym'];

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
                id: 'desk_job' as const,
                title: 'Desk / Sedentary',
                badge: 'Sedentary',
                badgeVariant: 'amber' as const,
                summary: 'High postural load and lumbar compression risk',
                tooltip: 'Prolonged sitting with kyphosis or lumbar compression risks',
              },
              {
                id: 'standing_job' as const,
                title: 'Standing Job',
                badge: 'Moderate',
                badgeVariant: 'cyan' as const,
                summary: 'On your feet with regular active daily movement',
                tooltip: 'On your feet most of the day with moderate daily energy expenditure',
              },
              {
                id: 'active' as const,
                title: 'Physically Active',
                badge: 'High Baseline',
                badgeVariant: 'lime' as const,
                summary: 'High daily movement, manual work, or athletic baseline',
                tooltip: 'High daily movement, physical labor, or high athletic baseline',
              },
            ].map((item) => {
              const active = lifestyle === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectWithAutoAdvance(() => setLifestyle(item.id))}
                  className={`rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white">{item.title}</span>
                      <Tooltip content={item.tooltip} position="top">
                        <Info className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-help" />
                      </Tooltip>
                    </div>
                    <Badge variant={item.badgeVariant} pill>
                      {item.badge}
                    </Badge>
                  </div>
                  <span className="mt-1 block text-xs text-zinc-400 leading-relaxed">{item.summary}</span>
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
              {
                id: 'beginner' as const,
                title: 'Beginner (< 1 Year)',
                badge: 'Beginner',
                badgeVariant: 'lime' as const,
                summary: 'Movement mechanics & postural motor learning',
                tooltip: 'Focus on movement mechanics, posture cues, and base motor learning.',
              },
              {
                id: 'intermediate' as const,
                title: 'Intermediate (1–3 Years)',
                badge: 'Intermediate',
                badgeVariant: 'cyan' as const,
                summary: 'Consistent progressive overload & hypertrophy volume',
                tooltip: 'Consistent resistance training background ready for progressive overload.',
              },
              {
                id: 'advanced' as const,
                title: 'Advanced (3+ Years)',
                badge: 'Advanced',
                badgeVariant: 'amber' as const,
                summary: 'High work capacity & specialized variations',
                tooltip: 'High volume work capacity and specialized biomechanical variations.',
              },
            ].map((lvl) => {
              const active = experienceLevel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => handleSelectWithAutoAdvance(() => setExperienceLevel(lvl.id))}
                  className={`rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white">{lvl.title}</span>
                      <Tooltip content={lvl.tooltip} position="top">
                        <Info className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-help" />
                      </Tooltip>
                    </div>
                    <Badge variant={lvl.badgeVariant} pill>
                      {lvl.badge}
                    </Badge>
                  </div>
                  <span className="mt-1 block text-xs text-zinc-400 leading-relaxed">{lvl.summary}</span>
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
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
            {[
              { mins: 30, num: '30', label: 'Minutes', tag: 'Express', tooltip: 'Express / High-density circuit with minimal downtime.' },
              { mins: 45, num: '45', label: 'Minutes', tag: 'Balanced', tooltip: 'Standard hypertrophy split balancing strength & recovery.' },
              { mins: 60, num: '60', label: 'Minutes', tag: 'Compound', tooltip: 'Full compound strength work with optimal rest sets.' },
              { mins: 75, num: '75+', label: 'Minutes', tag: 'Athlete', tooltip: 'Comprehensive athlete session including warm-ups & accessories.' },
            ].map((item) => {
              const active = sessionMinutes === item.mins;
              return (
                <Tooltip key={item.mins} content={item.tooltip} position="top" className="w-full">
                  <button
                    type="button"
                    onClick={() => handleSelectWithAutoAdvance(() => setSessionMinutes(item.mins))}
                    className={`w-full h-28 rounded-2xl border p-3 flex flex-col items-center justify-center transition-all duration-150 active:scale-95 text-center relative ${
                      active
                        ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <span className="text-3xl font-black tabular-nums tracking-tight text-white">{item.num}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mt-0.5">{item.label}</span>
                    <Badge variant={active ? 'lime' : 'neutral'} pill className="mt-1 text-[10px] px-2 py-0">
                      {item.tag}
                    </Badge>
                  </button>
                </Tooltip>
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
              {
                id: 'full_gym',
                label: 'Full Commercial Gym',
                tags: ['Barbells', 'Dumbbells', 'Cables', 'Squat Racks', 'Machines'],
              },
              {
                id: 'home_gym',
                label: 'Home Gym Setup',
                tags: ['Barbell', 'Squat Rack', 'Bench', 'Dumbbells'],
              },
              {
                id: 'dumbbells_only',
                label: 'Dumbbells & Flat Bench',
                tags: ['Adjustable Dumbbells', 'Bench / Floor'],
              },
              {
                id: 'resistance_bands',
                label: 'Bands & Bodyweight',
                tags: ['Loop Bands', 'Pull-Up Bar', 'Calisthenics'],
              },
            ].map((gear) => {
              const active = selectedEquipment.includes(gear.id);
              return (
                <button
                  key={gear.id}
                  type="button"
                  onClick={() => toggleEquipment(gear.id)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400/30'
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
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {gear.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant={active ? 'lime' : 'neutral'}
                        className="text-[10px] py-0.5"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
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
          <div className="grid gap-2 w-full max-w-lg max-h-[50vh] overflow-y-auto pr-1">
            {ANATOMY_PINS.map((pin) => {
              const active = activePains[pin.code];
              return (
                <div
                  key={pin.code}
                  className={`rounded-xl border px-3 py-2.5 transition-all flex items-center justify-between gap-2 ${
                    active
                      ? 'border-amber-400/60 bg-amber-500/10 shadow-sm ring-1 ring-amber-400/20'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => togglePainPin(pin.code)}
                    className="flex items-center gap-2.5 text-left min-w-0 flex-1 py-0.5"
                  >
                    <div
                      className={`size-4.5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        active
                          ? 'border-amber-400 bg-amber-400 text-zinc-950'
                          : 'border-zinc-700 bg-zinc-800'
                      }`}
                    >
                      {active && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-xs sm:text-sm font-bold text-white">{pin.label}</span>
                      <Badge variant="dark" pill className="text-[10px] text-zinc-400 px-1.5 py-0 shrink-0 hidden sm:inline-flex">
                        {pin.region}
                      </Badge>
                    </div>
                  </button>

                  {active && (
                    <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-950 p-0.5 shrink-0">
                      {(
                        [
                          { key: 'mild', label: 'Mild', activeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
                          { key: 'moderate', label: 'Mod', activeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
                          { key: 'severe', label: 'Sev', activeClass: 'bg-red-500/20 text-red-300 border border-red-500/30' },
                        ] as const
                      ).map(({ key, label, activeClass }) => {
                        const isSelected = active.severity === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setPainSeverity(pin.code, key)}
                            className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                              isSelected
                                ? activeClass
                                : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
              { id: 'posture_improvement', label: 'Posture Correction', tag: 'Alignment', icon: ShieldCheck, desc: 'Fix rounded shoulders & anterior tilt' },
              { id: 'strength', label: 'Maximum Strength', tag: 'Power', icon: Dumbbell, desc: 'Compound overload & neural drive' },
              { id: 'muscle_gain', label: 'Hypertrophy', tag: 'Volume', icon: Zap, desc: 'Muscle volume & aesthetic definition' },
              { id: 'mobility', label: 'Joint Mobility', tag: 'Durability', icon: Activity, desc: 'Resilient knees, hips & rotator cuff' },
              { id: 'fat_loss', label: 'Metabolic Burn', tag: 'Conditioning', icon: Flame, desc: 'High density conditioning & calorie burn' },
              { id: 'recomposition', label: 'Body Recomposition', tag: 'Hybrid', icon: Scale, desc: 'Simultaneous lean gain & fat reduction' },
            ].map((g) => {
              const active = selectedGoals.includes(g.id);
              const Icon = g.icon;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGoal(g.id)}
                  className={`rounded-2xl border p-3.5 text-left transition-all duration-150 active:scale-[0.98] ${
                    active
                      ? 'border-lime-400 bg-lime-400/10 text-white shadow-sm ring-1 ring-lime-400/30'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-7 rounded-lg border flex items-center justify-center shrink-0 ${
                          active
                            ? 'border-lime-400/40 bg-lime-400/20 text-lime-400'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-sm font-black text-white">{g.label}</span>
                    </div>
                    <Badge variant={active ? 'lime' : 'neutral'} pill className="text-[10px] px-1.5 py-0">
                      {g.tag}
                    </Badge>
                  </div>
                  <span className="block text-xs text-zinc-400 leading-relaxed">{g.desc}</span>
                </button>
              );
            })}
          </div>

          {generating && (
            <div className="w-full max-w-lg rounded-2xl border border-lime-400/30 bg-zinc-950/90 p-5 shadow-2xl backdrop-blur-md space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-lime-400" />
                  </span>
                  <span className="font-mono text-xs font-black uppercase tracking-wider text-lime-400">
                    AI Synthesis Engine Active
                  </span>
                </div>
                <Sparkles className="h-4 w-4 text-lime-400 animate-pulse" />
              </div>

              {/* Stage Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="success" pill className="text-[11px] py-1 px-2.5 font-mono">
                  <Check className="h-3 w-3 stroke-[3]" /> Posture Matrix
                </Badge>
                <Badge variant="cyan" pill className="text-[11px] py-1 px-2.5 font-mono">
                  <Check className="h-3 w-3 stroke-[3]" /> Volume Balanced
                </Badge>
                <Badge variant="lime" pill className="text-[11px] py-1 px-2.5 font-mono">
                  <Sparkles className="h-3 w-3" /> AI Plan Ready
                </Badge>
              </div>

              {/* Phase Status Text */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 px-3 text-center">
                <p className="font-mono text-xs font-semibold text-zinc-300">
                  {phaseText || 'Synthesizing evidence-based AI workout split…'}
                </p>
              </div>
            </div>
          )}
        </SliderStepper>
      )}
    </>
  );
}
