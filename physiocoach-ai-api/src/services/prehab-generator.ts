export interface PrehabExercise {
  id: string;
  name: string;
  targetJoint: string;
  durationSeconds?: number | undefined;
  reps?: number | undefined;
  purpose: string;
  movementCue: string;
  mediaUrl?: string | undefined;
}

export interface PrehabExerciseCandidate extends PrehabExercise {
  patterns: string[];
  limitations: string[];
  muscleGroups: string[];
  joints: string[];
}

export interface PrehabGenerateInput {
  exercises: Array<{
    name: string;
    movementPattern?: string | undefined;
    muscleGroups?: string[] | undefined;
  }>;
  limitations?: string[] | undefined;
  sessionId?: string | undefined;
}

export interface PrehabGenerateOutput {
  success: true;
  totalMinutes: number;
  targetJoints: string[];
  routine: PrehabExercise[];
}

export const CLINICAL_PREHAB_CATALOG: PrehabExerciseCandidate[] = [
  {
    id: 'prehab_90_90_hip_flow',
    name: '90/90 Hip Flow',
    targetJoint: 'Hips',
    durationSeconds: 60,
    purpose: 'Restores internal and external hip capsule rotation for deep squat and hinge mechanics.',
    movementCue: 'Sit tall, smoothly pivot knees side-to-side keeping heels pinned without collapsing the spine.',
    mediaUrl: '/images/exercises/catalog/0002.webp',
    patterns: ['squat', 'hinge', 'lunge'],
    limitations: ['knee_pain', 'hip_pain', 'lower_back_pain', 'tight_hips'],
    muscleGroups: ['glutes', 'hip_flexors', 'adductors'],
    joints: ['Hips'],
  },
  {
    id: 'prehab_worlds_greatest_stretch',
    name: "World's Greatest Stretch",
    targetJoint: 'Thoracic Spine & Hips',
    reps: 6,
    purpose: 'Multi-planar mobility opening hip flexors, activating glutes, and improving thoracic rotation.',
    movementCue: 'Step into deep lunge, sink inside elbow toward floor, then reach arm high rotating chest to ceiling.',
    mediaUrl: '/images/exercises/catalog/0001.webp',
    patterns: ['squat', 'hinge', 'push', 'pull', 'overhead', 'lunge'],
    limitations: ['lower_back_pain', 'desk_job', 'rounded_shoulders', 'stiff_spine'],
    muscleGroups: ['hip_flexors', 'hamstrings', 'thoracic_extensors'],
    joints: ['Thoracic Spine', 'Hips'],
  },
  {
    id: 'prehab_band_pull_aparts',
    name: 'Band Pull-Aparts',
    targetJoint: 'Shoulders & Scapulae',
    reps: 15,
    purpose: 'Primes rear deltoids, rhomboids, and lower traps for horizontal and vertical pressing stability.',
    movementCue: 'Lock ribcage down, pull band apart across upper chest by retracting shoulder blades.',
    mediaUrl: '/images/exercises/catalog/0006.webp',
    patterns: ['push', 'pull', 'overhead'],
    limitations: ['shoulder_pain', 'rounded_shoulders', 'neck_pain', 'impingement'],
    muscleGroups: ['rear_delts', 'rhomboids', 'upper_back'],
    joints: ['Shoulders', 'Scapulae'],
  },
  {
    id: 'prehab_scapular_wall_slides',
    name: 'Scapular Wall Slides',
    targetJoint: 'Scapulothoracic & Shoulders',
    reps: 10,
    purpose: 'Activates serratus anterior and restores upward scapular rotation to prevent impingement.',
    movementCue: 'Press forearms and wrists against wall, glide upwards in a wide "Y" without arching lower back.',
    mediaUrl: '/images/exercises/catalog/0007.webp',
    patterns: ['overhead', 'push', 'pull'],
    limitations: ['shoulder_pain', 'rounded_shoulders', 'neck_pain', 'shoulder_impingement'],
    muscleGroups: ['serratus_anterior', 'lower_traps', 'rotator_cuff'],
    joints: ['Shoulders', 'Thoracic Spine'],
  },
  {
    id: 'prehab_glute_bridges',
    name: 'Glute Bridges & Hold',
    targetJoint: 'Hips & Glutes',
    reps: 12,
    purpose: 'Neuromuscular gluteus maximus activation to prevent anterior knee dominance and spinal shear.',
    movementCue: 'Drive firmly through heels, squeeze glutes at the top for 2 seconds with neutral pelvis.',
    mediaUrl: '/images/exercises/catalog/0009.webp',
    patterns: ['squat', 'hinge', 'lunge'],
    limitations: ['lower_back_pain', 'knee_pain', 'anterior_pelvic_tilt'],
    muscleGroups: ['glutes', 'hamstrings', 'core'],
    joints: ['Hips', 'Glutes'],
  },
  {
    id: 'prehab_cat_cow',
    name: 'Cat-Cow Spinal Waves',
    targetJoint: 'Spine & Core',
    reps: 8,
    purpose: 'Mobilizes segmental spinal flexion and extension with synchronized diaphragmatic breath.',
    movementCue: 'Inhale arching thoracic spine and lifting chin; exhale tucking pelvis and doming upper back.',
    mediaUrl: '/images/exercises/catalog/0010.webp',
    patterns: ['hinge', 'squat', 'core', 'carry'],
    limitations: ['lower_back_pain', 'neck_pain', 'stiff_spine'],
    muscleGroups: ['erector_spinae', 'core', 'lats'],
    joints: ['Spine', 'Core'],
  },
  {
    id: 'prehab_ankle_mobilization',
    name: 'Ankle Dorsiflexion Wall Mobilization',
    targetJoint: 'Ankles',
    reps: 10,
    purpose: 'Enhances talocrural joint range of motion to ensure upright torso and avoid knee collapse during squats.',
    movementCue: 'Keep heel firmly planted, drive knee straight forward past big toe toward wall with controlled pulses.',
    mediaUrl: '/images/exercises/catalog/0011.webp',
    patterns: ['squat', 'lunge'],
    limitations: ['knee_pain', 'ankle_mobility', 'patellar_tendonitis'],
    muscleGroups: ['calves', 'tibialis_anterior'],
    joints: ['Ankles'],
  },
  {
    id: 'prehab_deadbug',
    name: 'Deadbug with Isometric Press',
    targetJoint: 'Core & Lumbar Spine',
    reps: 10,
    purpose: 'Deep transverse abdominis activation establishing anti-extension lumbar stiffness under load.',
    movementCue: 'Press lower back into floor without gap, slowly extend opposite arm and leg while exhaling fully.',
    mediaUrl: '/images/exercises/catalog/0012.webp',
    patterns: ['core', 'carry', 'overhead', 'hinge'],
    limitations: ['lower_back_pain', 'anterior_pelvic_tilt', 'core_weakness'],
    muscleGroups: ['transverse_abdominis', 'obliques'],
    joints: ['Core', 'Spine'],
  },
  {
    id: 'prehab_face_pull_rotator',
    name: 'Face Pull with External Rotation',
    targetJoint: 'Rotator Cuff & Shoulders',
    reps: 12,
    purpose: 'Activates infraspinatus and teres minor to dynamically seat humeral head in glenoid socket.',
    movementCue: 'Pull light band toward eye level, then rotate forearms vertically into "L" position while squeezing rear delts.',
    mediaUrl: '/images/exercises/catalog/0013.webp',
    patterns: ['overhead', 'push', 'pull'],
    limitations: ['shoulder_pain', 'rotator_cuff', 'rounded_shoulders'],
    muscleGroups: ['infraspinatus', 'teres_minor', 'rear_delts'],
    joints: ['Shoulders', 'Rotator Cuff'],
  },
  {
    id: 'prehab_cossack_squat_flow',
    name: 'Cossack Squat Dynamic Stretch',
    targetJoint: 'Hips & Adductors',
    reps: 8,
    purpose: 'Opens frontal plane hip adductors and enhances single-leg ankle and knee tracking.',
    movementCue: 'Shift weight into deep side squat, keep trailing heel down with toes pointed skyward, chest proud.',
    mediaUrl: '/images/exercises/catalog/0014.webp',
    patterns: ['squat', 'lunge'],
    limitations: ['groin_tightness', 'hip_mobility', 'knee_pain'],
    muscleGroups: ['adductors', 'glutes', 'hamstrings'],
    joints: ['Hips', 'Adductors'],
  },
  {
    id: 'prehab_prone_ytw',
    name: 'Prone Y-T-W Scapular Raises',
    targetJoint: 'Upper Back & Shoulders',
    reps: 8,
    purpose: 'Recruits mid and lower trapezius for thoracic extension and scapular depression under load.',
    movementCue: 'Lie chest down, lift arms into Y, T, and W positions using mid-back muscles, holding 1s at top.',
    mediaUrl: '/images/exercises/catalog/0015.webp',
    patterns: ['pull', 'push', 'overhead'],
    limitations: ['rounded_shoulders', 'thoracic_kyphosis', 'neck_pain'],
    muscleGroups: ['lower_traps', 'mid_traps', 'rhomboids'],
    joints: ['Upper Back', 'Shoulders'],
  },
  {
    id: 'prehab_quadruped_t_spine',
    name: 'Quadruped Thoracic Rotations',
    targetJoint: 'Thoracic Spine',
    reps: 8,
    purpose: 'Restores mid-back rotational freedom to eliminate compensatory strain in lumbar and cervical spine.',
    movementCue: 'From hands and knees, place one hand behind head, sweep elbow across chest then flare wide open to ceiling.',
    mediaUrl: '/images/exercises/catalog/0016.webp',
    patterns: ['pull', 'overhead', 'hinge', 'push'],
    limitations: ['stiff_spine', 'desk_job', 'shoulder_pain'],
    muscleGroups: ['thoracic_rotators', 'rhomboids'],
    joints: ['Thoracic Spine'],
  },
];

export function inferMovementPattern(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('squat') || lower.includes('leg press') || lower.includes('hack')) return 'squat';
  if (lower.includes('deadlift') || lower.includes('rdl') || lower.includes('hinge') || lower.includes('good morning') || lower.includes('hip thrust')) return 'hinge';
  if (lower.includes('overhead press') || lower.includes('shoulder press') || lower.includes('military press') || lower.includes('arnold press') || lower.includes('handstand')) return 'overhead';
  if (lower.includes('bench press') || lower.includes('push up') || lower.includes('dip') || lower.includes('chest press') || lower.includes('dumbbell press')) return 'push';
  if (lower.includes('pull up') || lower.includes('chin up') || lower.includes('row') || lower.includes('lat pulldown') || lower.includes('pullover')) return 'pull';
  if (lower.includes('lunge') || lower.includes('split squat') || lower.includes('step up')) return 'lunge';
  if (lower.includes('carry') || lower.includes('walk') || lower.includes('farmer')) return 'carry';
  if (lower.includes('plank') || lower.includes('crunch') || lower.includes('ab') || lower.includes('core')) return 'core';
  return null;
}

export function generatePrehabRoutine(input: PrehabGenerateInput): PrehabGenerateOutput {
  const exercises = input.exercises || [];
  const limitations = (input.limitations || []).map((l) => l.toLowerCase().replace(/[\s-]/g, '_'));

  // 1. Gather all unique patterns and muscle groups from the session
  const patternSet = new Set<string>();
  const muscleSet = new Set<string>();

  for (const ex of exercises) {
    if (ex.movementPattern) {
      patternSet.add(ex.movementPattern.toLowerCase());
    } else {
      const inferred = inferMovementPattern(ex.name);
      if (inferred) patternSet.add(inferred);
    }

    if (Array.isArray(ex.muscleGroups)) {
      for (const m of ex.muscleGroups) {
        muscleSet.add(m.toLowerCase().replace(/[\s-]/g, '_'));
      }
    }
  }

  // Fallback patterns if session has no specific exercises
  if (patternSet.size === 0) {
    patternSet.add('squat');
    patternSet.add('push');
    patternSet.add('hinge');
  }

  // 2. Score candidate prehab exercises
  interface ScoredCandidate {
    candidate: PrehabExerciseCandidate;
    score: number;
  }

  const scored: ScoredCandidate[] = CLINICAL_PREHAB_CATALOG.map((cand) => {
    let score = 0;

    // Pattern matching
    for (const pat of cand.patterns) {
      if (patternSet.has(pat)) {
        score += 4;
      }
    }

    // Limitation matching
    for (const lim of cand.limitations) {
      for (const userLim of limitations) {
        if (userLim.includes(lim) || lim.includes(userLim)) {
          score += 6;
        }
      }
    }

    // Muscle group matching
    for (const mg of cand.muscleGroups) {
      if (muscleSet.has(mg)) {
        score += 2;
      }
    }

    return { candidate: cand, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // 3. Select 3-5 diverse exercises balancing joint coverage
  const selected: PrehabExerciseCandidate[] = [];
  const coveredJoints = new Set<string>();

  // First pass: add highest scoring distinct joint candidates
  for (const item of scored) {
    if (selected.length >= 5) break;

    const primaryJoint = item.candidate.joints[0] || item.candidate.targetJoint;
    if (!coveredJoints.has(primaryJoint)) {
      selected.push(item.candidate);
      item.candidate.joints.forEach((j) => coveredJoints.add(j));
    }
  }

  // Second pass: if less than 3-4 selected, fill from remaining top scoring candidates
  if (selected.length < 3) {
    for (const item of scored) {
      if (selected.length >= 4) break;
      if (!selected.some((s) => s.id === item.candidate.id)) {
        selected.push(item.candidate);
      }
    }
  }

  // Ensure between 3 and 5 exercises
  const finalRoutineCandidates = selected.slice(0, Math.min(5, Math.max(3, selected.length)));

  // Calculate approximate duration in seconds
  let totalEstimatedSeconds = 0;
  const routine: PrehabExercise[] = finalRoutineCandidates.map((c) => {
    const durationSeconds = c.durationSeconds ?? (c.reps ? undefined : 45);
    const reps = c.reps;

    if (durationSeconds) {
      totalEstimatedSeconds += durationSeconds + 10; // 10s transition
    } else if (reps) {
      const estimatedSecs = reps * 4 + 10;
      totalEstimatedSeconds += estimatedSecs;
    }

    return {
      id: c.id,
      name: c.name,
      targetJoint: c.targetJoint,
      ...(durationSeconds ? { durationSeconds } : {}),
      ...(reps ? { reps } : {}),
      purpose: c.purpose,
      movementCue: c.movementCue,
      ...(c.mediaUrl ? { mediaUrl: c.mediaUrl } : {}),
    };
  });

  const totalMinutes = Math.max(3, Math.ceil(totalEstimatedSeconds / 60));
  const targetJoints = Array.from(new Set(finalRoutineCandidates.flatMap((c) => c.joints)));

  return {
    success: true,
    totalMinutes,
    targetJoints,
    routine,
  };
}
