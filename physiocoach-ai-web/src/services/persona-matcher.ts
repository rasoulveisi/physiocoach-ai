/**
 * Client-side Persona Matcher & Badge Configurator
 * Feature 3.3: Explore Marketplace Publishing & Persona Matching
 */

export interface CandidatePersonaResult {
  personas: string[];
  targetAudience: string;
  jointTags: string[];
}

export function evaluateCandidatePersonas(rawPlan: Record<string, unknown>): CandidatePersonaResult {
  const days = Array.isArray(rawPlan.days) ? rawPlan.days : [];

  let totalSets = 0;
  let pushSets = 0;
  let pullSets = 0;
  let squatSets = 0;
  let hingeSets = 0;
  let lungeSets = 0;
  let coreSets = 0;
  let mobilitySets = 0;

  const muscleSets: Record<string, number> = {};
  const names: string[] = [];

  for (const day of days) {
    const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
    for (const ex of exercises) {
      const sets = typeof ex.sets === 'number' ? ex.sets : Array.isArray(ex.sets) ? ex.sets.length : 3;
      totalSets += sets;

      const name = (ex.name || ex.exerciseName || '').toLowerCase().trim();
      if (name) names.push(name);

      const pattern = (ex.movementPattern || '').toLowerCase().trim();
      if (pattern.includes('push')) pushSets += sets;
      else if (pattern.includes('pull')) pullSets += sets;
      else if (pattern.includes('squat')) squatSets += sets;
      else if (pattern.includes('hinge')) hingeSets += sets;
      else if (pattern.includes('lunge')) lungeSets += sets;
      else if (pattern.includes('core')) coreSets += sets;
      else if (pattern.includes('mobility') || pattern.includes('carry')) mobilitySets += sets;

      const primaryMuscle = (
        ex.muscleGroup || (Array.isArray(ex.muscleGroups) ? ex.muscleGroups[0] : '') || ''
      ).toLowerCase().trim();
      if (primaryMuscle) {
        muscleSets[primaryMuscle] = (muscleSets[primaryMuscle] || 0) + sets;
      }
    }
  }

  const allNames = names.join(' ');
  const matchedPersonas: string[] = [];
  const jointTags: string[] = [];

  const backVolume = (muscleSets['back'] || 0) + (muscleSets['lats'] || 0) + (muscleSets['upper_back'] || 0);
  const chestVolume = muscleSets['chest'] || 0;
  const hamstringGluteVolume = (muscleSets['hamstrings'] || 0) + (muscleSets['glutes'] || 0);
  const quadVolume = muscleSets['quads'] || 0;

  // 1. Desk Workers with Lower Back Discomfort
  if (
    pullSets >= pushSets ||
    backVolume >= chestVolume ||
    coreSets + mobilitySets >= 2 ||
    allNames.includes('row') ||
    allNames.includes('face pull') ||
    allNames.includes('deadbug') ||
    allNames.includes('plank')
  ) {
    matchedPersonas.push('Desk Workers with Lower Back Discomfort');
    jointTags.push('Low Spine Load');
  }

  // 2. Knee-Friendly Hypertrophy
  if (
    hingeSets + lungeSets >= squatSets ||
    hamstringGluteVolume >= quadVolume ||
    allNames.includes('rdl') ||
    allNames.includes('romanian') ||
    allNames.includes('hip thrust') ||
    allNames.includes('box squat') ||
    allNames.includes('split squat')
  ) {
    matchedPersonas.push('Knee-Friendly Hypertrophy');
    jointTags.push('Knee-Friendly');
  }

  // 3. Shoulder-Safe Strength
  if (
    pullSets >= pushSets ||
    allNames.includes('dumbbell') ||
    allNames.includes('incline') ||
    allNames.includes('neutral') ||
    allNames.includes('face pull') ||
    !allNames.includes('behind neck')
  ) {
    matchedPersonas.push('Shoulder-Safe Strength');
    jointTags.push('Shoulder-Safe');
  }

  // 4. Minimal Equipment Longevity
  if (
    allNames.includes('dumbbell') ||
    allNames.includes('bodyweight') ||
    allNames.includes('band') ||
    allNames.includes('push-up')
  ) {
    matchedPersonas.push('Minimal Equipment Longevity');
  }

  // 5. Post-Rehab Foundation
  if ((totalSets <= 45 && days.length <= 4) || mobilitySets >= 2) {
    matchedPersonas.push('Post-Rehab Foundation');
    if (!jointTags.includes('Thoracic Mobility')) {
      jointTags.push('Thoracic Mobility');
    }
  }

  if (matchedPersonas.length < 2) {
    matchedPersonas.push('All-Round Athletic Conditioning');
  }
  if (matchedPersonas.length < 3) {
    matchedPersonas.push('Community Hypertrophy & Longevity');
  }

  if (jointTags.length === 0) {
    jointTags.push('AI Personalized', 'Active Plan');
  }

  const primaryPersonas = matchedPersonas.slice(0, 3);
  const targetAudience = `Suitable for ${primaryPersonas.slice(0, 2).join(' and ')} seeking structured joint-safe progression.`;

  return {
    personas: primaryPersonas,
    targetAudience,
    jointTags: Array.from(new Set(jointTags)),
  };
}

export function getPersonaColorClasses(persona: string): {
  badgeBg: string;
  textColor: string;
  borderColor: string;
} {
  const p = persona.toLowerCase();
  if (p.includes('desk') || p.includes('posture') || p.includes('spine')) {
    return {
      badgeBg: 'bg-[#06B6D4]/10',
      textColor: 'text-[#06B6D4]',
      borderColor: 'border-[#06B6D4]/30',
    };
  }
  if (p.includes('knee') || p.includes('hypertrophy')) {
    return {
      badgeBg: 'bg-[#10E760]/10',
      textColor: 'text-[#10E760]',
      borderColor: 'border-[#10E760]/30',
    };
  }
  if (p.includes('shoulder') || p.includes('safe') || p.includes('strength')) {
    return {
      badgeBg: 'bg-[#F59E0B]/10',
      textColor: 'text-[#F59E0B]',
      borderColor: 'border-[#F59E0B]/30',
    };
  }
  if (p.includes('rehab') || p.includes('mobility')) {
    return {
      badgeBg: 'bg-purple-500/10',
      textColor: 'text-purple-400',
      borderColor: 'border-purple-500/30',
    };
  }
  return {
    badgeBg: 'bg-zinc-800/80',
    textColor: 'text-zinc-200',
    borderColor: 'border-zinc-700',
  };
}
