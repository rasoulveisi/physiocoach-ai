import { and, eq, like, not, or, sql } from 'drizzle-orm';
import { exerciseMedia, masterExercises } from '../db/schema';
import type { getApiRouteContext } from '../routes/context';

export interface AlternativeMovement {
  id: string;
  name: string;
  targetMuscle: string;
  shearReductionReason: string;
  setupCue: string;
  mediaUrl: string | null;
}

export interface PainConditionInfo {
  code: string;
  displayName: string;
  bodyRegion: string;
  biomechanicalCause: string;
  jointShearRating: 'high' | 'moderate' | 'low';
}

export interface OriginalExerciseInfo {
  id: string;
  name: string;
  movementPattern: string;
  target: string;
  bodyPart: string;
  mediaUrl: string | null;
}

export interface SeoMetadata {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  schemaJsonLd: Record<string, unknown>;
}

export interface ExerciseAlternativesResult {
  originalExercise: OriginalExerciseInfo;
  painCondition: PainConditionInfo;
  alternatives: AlternativeMovement[];
  seoMetadata: SeoMetadata;
}

export interface KnownPainCondition {
  code: string;
  suffixes: string[];
  displayName: string;
  bodyRegion: string;
  biomechanicalCause: string;
  jointShearRating: 'high' | 'moderate' | 'low';
}

export const KNOWN_PAIN_CONDITIONS: KnownPainCondition[] = [
  {
    code: 'shoulder_impingement',
    suffixes: [
      'subacromial-impingement',
      'shoulder-impingement',
      'impingement',
    ],
    displayName: 'Subacromial Shoulder Impingement',
    bodyRegion: 'shoulders',
    biomechanicalCause:
      'Subacromial space reduction under internal rotation or flared humeral abduction during horizontal and overhead pressing.',
    jointShearRating: 'high',
  },
  {
    code: 'shoulder_pain',
    suffixes: [
      'shoulder-pain',
      'rotator-cuff-pain',
      'shoulder-strain',
      'shoulder-discomfort',
      'shoulder',
    ],
    displayName: 'Shoulder Pain / Rotator Cuff Strain',
    bodyRegion: 'shoulders',
    biomechanicalCause:
      'Excessive anterior glenohumeral shear and rotator cuff impingement in deep horizontal or overhead extensions.',
    jointShearRating: 'high',
  },
  {
    code: 'lower_back_pain',
    suffixes: [
      'lower-back-pain',
      'low-back-pain',
      'lumbar-disc-strain',
      'lumbar-strain',
      'lumbar-pain',
      'back-pain',
      'lower-back',
      'lumbar',
    ],
    displayName: 'Lower Back Pain / Lumbar Disc Strain',
    bodyRegion: 'lower_back',
    biomechanicalCause:
      'High lumbar shear moment and compressive spinal axial loading during unsupported spinal flexion under load.',
    jointShearRating: 'high',
  },
  {
    code: 'knee_pain',
    suffixes: [
      'patellar-tendinopathy',
      'patellofemoral-pain',
      'anterior-knee-pain',
      'knee-pain',
      'knee-strain',
      'knee',
    ],
    displayName: 'Anterior Knee Pain / Patellofemoral Strain',
    bodyRegion: 'knees',
    biomechanicalCause:
      'Excessive anterior patellofemoral shear forces and steep tibiofemoral angles under deep forward knee travel.',
    jointShearRating: 'high',
  },
  {
    code: 'elbow_pain',
    suffixes: [
      'elbow-tendinopathy',
      'tennis-elbow',
      'golfers-elbow',
      'triceps-tendon-pain',
      'elbow-pain',
      'elbow',
    ],
    displayName: 'Elbow Pain / Triceps & Epicondyle Strain',
    bodyRegion: 'elbows',
    biomechanicalCause:
      'High eccentric torque and repetitive shear friction at the common extensor/flexor and triceps tendon insertions.',
    jointShearRating: 'moderate',
  },
  {
    code: 'wrist_pain',
    suffixes: [
      'wrist-pain',
      'wrist-strain',
      'carpal-pain',
      'carpal-tunnel',
      'wrist',
    ],
    displayName: 'Wrist Pain / Carpal Extension Stress',
    bodyRegion: 'wrists',
    biomechanicalCause:
      'Severe hyperextension under direct axial compression loading on the carpal and radiocarpal joints.',
    jointShearRating: 'moderate',
  },
  {
    code: 'neck_pain',
    suffixes: [
      'cervical-spine-strain',
      'cervical-strain',
      'neck-pain',
      'neck-strain',
      'neck',
    ],
    displayName: 'Neck Pain / Cervical Spine Strain',
    bodyRegion: 'neck',
    biomechanicalCause:
      'Hyper-activation of upper trapezius/levator scapulae and compressive cervical spine hyperextension.',
    jointShearRating: 'moderate',
  },
  {
    code: 'hip_pain',
    suffixes: [
      'femoroacetabular-impingement',
      'hip-impingement',
      'hip-pain',
      'hip-strain',
      'hip',
    ],
    displayName: 'Femoroacetabular Hip Impingement / Hip Strain',
    bodyRegion: 'hips',
    biomechanicalCause:
      'Deep acetabular rim compression and labral shear during deep end-range hip flexion under heavy axial load.',
    jointShearRating: 'high',
  },
];

export interface ParsedAlternativeSlug {
  rawSlug: string;
  exerciseSlug: string;
  exerciseNameQuery: string;
  painCondition: KnownPainCondition;
}

export function parseAlternativeSlug(slug: string): ParsedAlternativeSlug {
  const normalized = slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  // Match suffixes sorted by length descending to match most specific first
  const allSuffixesWithCondition: Array<{ suffix: string; condition: KnownPainCondition }> = [];
  for (const condition of KNOWN_PAIN_CONDITIONS) {
    for (const suffix of condition.suffixes) {
      allSuffixesWithCondition.push({ suffix, condition });
    }
  }
  allSuffixesWithCondition.sort((a, b) => b.suffix.length - a.suffix.length);

  for (const { suffix, condition } of allSuffixesWithCondition) {
    const targetSuffix = `-${suffix}`;
    if (normalized.endsWith(targetSuffix) && normalized.length > targetSuffix.length) {
      const exerciseSlug = normalized.slice(0, -targetSuffix.length);
      const exerciseNameQuery = exerciseSlug.replace(/[-_]+/g, ' ');
      return {
        rawSlug: normalized,
        exerciseSlug,
        exerciseNameQuery,
        painCondition: condition,
      };
    }
  }

  // Fallback if no suffix matched directly: default to lower_back_pain or shoulder_pain
  let fallbackCondition = KNOWN_PAIN_CONDITIONS.find((c) => c.code === 'lower_back_pain')!;
  const exSlug = normalized;

  if (normalized.includes('squat') || normalized.includes('lunge') || normalized.includes('leg')) {
    fallbackCondition = KNOWN_PAIN_CONDITIONS.find((c) => c.code === 'knee_pain')!;
  } else if (normalized.includes('press') || normalized.includes('bench') || normalized.includes('dip')) {
    fallbackCondition = KNOWN_PAIN_CONDITIONS.find((c) => c.code === 'shoulder_pain')!;
  }

  return {
    rawSlug: normalized,
    exerciseSlug: exSlug,
    exerciseNameQuery: exSlug.replace(/[-_]+/g, ' '),
    painCondition: fallbackCondition,
  };
}

interface CuratedProfile {
  aliases: string[];
  original: {
    id: string;
    name: string;
    movementPattern: string;
    target: string;
    bodyPart: string;
    mediaUrl: string;
  };
  conditionCode: string;
  alternatives: AlternativeMovement[];
}

const CURATED_PROFILES: CuratedProfile[] = [
  // 1. Bench Press + Shoulder Pain / Shoulder Impingement
  {
    aliases: [
      'bench-press',
      'barbell-bench-press',
      'flat-bench-press',
      'flat-barbell-bench-press',
      'dumbbell-bench-press',
      'chest-press',
    ],
    conditionCode: 'shoulder_pain',
    original: {
      id: '0025',
      name: 'Barbell Bench Press',
      movementPattern: 'horizontal_push',
      target: 'Pectoralis Major',
      bodyPart: 'Chest',
      mediaUrl: '/images/exercises/catalog/0025.webp',
    },
    alternatives: [
      {
        id: 'dumbbell_floor_press',
        name: 'Dumbbell Floor Press',
        targetMuscle: 'Pectoralis Major & Triceps',
        shearReductionReason:
          'Floor contact mechanically blocks humeral extension beyond 90 degrees, completely eliminating anterior capsule stretch and rotator cuff impingement.',
        setupCue:
          'Lower dumbbells under strict control until upper arms touch the floor; pause for 1 second to release elastic strain before pressing explosively.',
        mediaUrl: '/images/exercises/catalog/0142.webp',
      },
      {
        id: 'neutral_grip_dumbbell_press',
        name: 'Neutral-Grip Dumbbell Bench Press',
        targetMuscle: 'Pectoralis Major (Sternal Head) & Anterior Deltoid',
        shearReductionReason:
          'A 45-degree angled or neutral grip widens the subacromial space by avoiding internal humeral rotation under heavy load.',
        setupCue:
          'Hold dumbbells with palms angled 45 degrees towards each other; keep elbows tucked close to ribcage throughout the pressing path.',
        mediaUrl: '/images/exercises/catalog/0168.webp',
      },
      {
        id: 'standing_cable_chest_press',
        name: 'Standing Converging Cable Chest Press',
        targetMuscle: 'Pectoralis Major & Serratus Anterior',
        shearReductionReason:
          'Continuous line of resistance allows unrestricted scapular movement and natural joint convergence with zero fixed-bar joint torque.',
        setupCue:
          'Set cable pulleys at mid-chest height, brace core in a staggered stance, and press along your natural scapular plane.',
        mediaUrl: '/images/exercises/catalog/0214.webp',
      },
    ],
  },
  // 2. Back Squat + Knee Pain / Patellar Tendinopathy
  {
    aliases: [
      'back-squat',
      'barbell-squat',
      'barbell-back-squat',
      'squat',
      'front-squat',
      'goblet-squat',
    ],
    conditionCode: 'knee_pain',
    original: {
      id: '0043',
      name: 'Barbell Back Squat',
      movementPattern: 'squat',
      target: 'Quadriceps',
      bodyPart: 'Upper Legs',
      mediaUrl: '/images/exercises/catalog/0043.webp',
    },
    alternatives: [
      {
        id: 'box_squat',
        name: 'Box Squat (Parallel Box)',
        targetMuscle: 'Glutes, Hamstrings & Vastus Lateralis',
        shearReductionReason:
          'Breaking the stretch-shortening cycle on a box enforces vertical shins, reducing anterior patellofemoral shear forces by over 35%.',
        setupCue:
          'Hinge hips backwards and sit onto the box with vertical shins; pause 1 count without rocking back, then drive upward through midfoot.',
        mediaUrl: '/images/exercises/catalog/0147.webp',
      },
      {
        id: 'barbell_rdl',
        name: 'Barbell Romanian Deadlift (RDL)',
        targetMuscle: 'Hamstrings & Gluteus Maximus',
        shearReductionReason:
          'Replaces deep knee flexion with a pure posterior-chain hip hinge, placing zero acute compressive load on the patellar tendon.',
        setupCue:
          'Push hips backwards with soft knees, keeping the barbell in contact with your thighs until maximal hamstring tension is reached.',
        mediaUrl: '/images/exercises/catalog/0032.webp',
      },
      {
        id: 'reverse_sled_drag',
        name: 'Reverse Sled Drag / Retro Step-Downs',
        targetMuscle: 'Vastus Medialis Oblique (VMO) & Quadriceps',
        shearReductionReason:
          'Delivers high quadriceps metabolic fatigue and knee synovial fluid circulation with zero peak eccentric impact on the patella.',
        setupCue:
          'Keep chest upright, step backward toe-to-heel under continuous tension, and maintain knee alignment over the second toe.',
        mediaUrl: '/images/exercises/catalog/0060.webp',
      },
    ],
  },
  // 3. Deadlift + Lower Back Pain / Lumbar Strain
  {
    aliases: [
      'deadlift',
      'barbell-deadlift',
      'conventional-deadlift',
      'sumo-deadlift',
      'rack-pull',
    ],
    conditionCode: 'lower_back_pain',
    original: {
      id: '0032',
      name: 'Barbell Deadlift',
      movementPattern: 'hinge',
      target: 'Glutes & Erector Spinae',
      bodyPart: 'Back',
      mediaUrl: '/images/exercises/catalog/0032.webp',
    },
    alternatives: [
      {
        id: 'trap_bar_deadlift',
        name: 'Trap Bar (Hex Bar) Deadlift (High Handles)',
        targetMuscle: 'Quadriceps, Glutes & Hamstrings',
        shearReductionReason:
          'Neutral elevated handles position the load directly inside the base of support, reducing the lumbar shear moment arm by ~30%.',
        setupCue:
          'Stand inside hex bar, grab high handles, keep chest upright, and push the floor away like a leg press.',
        mediaUrl: '/images/exercises/catalog/0088.webp',
      },
      {
        id: 'chest_supported_incline_row',
        name: 'Chest-Supported Dumbbell / T-Bar Row',
        targetMuscle: 'Latissimus Dorsi, Rhomboids & Trapezius',
        shearReductionReason:
          'Bench chest support completely eliminates lumbar spine axial compression and offloads isometric back extensor fatigue.',
        setupCue:
          'Lie prone on a 30-45 degree incline bench, press sternum into pad, and drive elbows straight back towards hips.',
        mediaUrl: '/images/exercises/catalog/0187.webp',
      },
      {
        id: 'barbell_hip_thrust',
        name: 'Barbell Glute Bridge / Hip Thrust',
        targetMuscle: 'Gluteus Maximus & Hamstrings',
        shearReductionReason:
          'Maximizes hip extension power and hypertrophy with a horizontal vector and zero vertical spinal axial loading.',
        setupCue:
          'Rest upper back across bench, position bar with foam pad across hip crease, and drive through heels to complete hip lockout.',
        mediaUrl: '/images/exercises/catalog/0047.webp',
      },
    ],
  },
  // 4. Overhead Press + Shoulder Impingement / Shoulder Pain
  {
    aliases: [
      'overhead-press',
      'barbell-overhead-press',
      'military-press',
      'shoulder-press',
      'dumbbell-shoulder-press',
      'seated-overhead-press',
    ],
    conditionCode: 'shoulder_impingement',
    original: {
      id: '0044',
      name: 'Barbell Overhead Press',
      movementPattern: 'vertical_push',
      target: 'Anterior & Lateral Deltoids',
      bodyPart: 'Shoulders',
      mediaUrl: '/images/exercises/catalog/0044.webp',
    },
    alternatives: [
      {
        id: 'half_kneeling_landmine_press',
        name: 'Half-Kneeling Landmine Press',
        targetMuscle: 'Anterior Deltoid, Upper Pectorals & Serratus Anterior',
        shearReductionReason:
          'The ~45-degree pressing trajectory bypasses end-range subacromial pinch while promoting healthy upward scapular rotation.',
        setupCue:
          'Kneel on the same side as working arm, lean slightly into the bar, and press upward along its natural arc without arching lower back.',
        mediaUrl: '/images/exercises/catalog/0205.webp',
      },
      {
        id: 'high_incline_neutral_db_press',
        name: 'High-Incline Neutral Dumbbell Press (70°)',
        targetMuscle: 'Anterior Deltoids & Clavicular Pectoralis',
        shearReductionReason:
          'High incline pressing provides vertical overhead stimulus while neutral dumbbells allow free humeroscapular articulation.',
        setupCue:
          'Set bench to 65-70 degrees, keep palms facing each other, and press smoothly without flaring elbows out wide.',
        mediaUrl: '/images/exercises/catalog/0165.webp',
      },
      {
        id: 'cable_lateral_raise_scapular',
        name: 'Cable Lateral Raise (Scapular Plane)',
        targetMuscle: 'Lateral Deltoid',
        shearReductionReason:
          'Raising 30 degrees forward in the scapular plane with continuous cable resistance preserves supraspinatus tendon clearance.',
        setupCue:
          'Set cable at wrist height, stand tall, and raise arm diagonally forward at a 30-degree angle relative to torso.',
        mediaUrl: '/images/exercises/catalog/0212.webp',
      },
    ],
  },
  // 5. Barbell Row + Lower Back Pain
  {
    aliases: [
      'barbell-row',
      'bent-over-row',
      'barbell-bent-over-row',
      'pendlay-row',
      't-bar-row',
    ],
    conditionCode: 'lower_back_pain',
    original: {
      id: '0027',
      name: 'Barbell Bent-Over Row',
      movementPattern: 'horizontal_pull',
      target: 'Latissimus Dorsi & Rhomboids',
      bodyPart: 'Back',
      mediaUrl: '/images/exercises/catalog/0027.webp',
    },
    alternatives: [
      {
        id: 'chest_supported_incline_row',
        name: 'Chest-Supported Incline Dumbbell Row',
        targetMuscle: 'Latissimus Dorsi, Rhomboids & Mid-Traps',
        shearReductionReason:
          'Incline bench pad completely absorbs torso weight, eliminating isometric lumbar endurance demand and spinal shear moments.',
        setupCue:
          'Lie chest-down on a 30-degree incline bench, initiate pull by retracting shoulder blades, and pull elbows towards hips.',
        mediaUrl: '/images/exercises/catalog/0187.webp',
      },
      {
        id: 'seated_cable_row_neutral',
        name: 'Seated Cable Row (Neutral V-Grip)',
        targetMuscle: 'Middle Trapezius & Lats',
        shearReductionReason:
          'Seated upright posture maintains an anatomically neutral spine without cantilevered trunk leverage over the lumbar discs.',
        setupCue:
          'Sit tall with chest proud and slight knee bend; pull attachment to lower abdomen while keeping spine stable.',
        mediaUrl: '/images/exercises/catalog/0228.webp',
      },
      {
        id: 'single_arm_db_row',
        name: 'Single-Arm Dumbbell Row (3-Point Bench Support)',
        targetMuscle: 'Latissimus Dorsi',
        shearReductionReason:
          'Non-working hand and knee braced on the bench distribute gravitational loads, preventing spinal twisting and flexion strain.',
        setupCue:
          'Plant one knee and hand on flat bench, keep spine level like a table, and pull dumbbell straight back towards hip crease.',
        mediaUrl: '/images/exercises/catalog/0185.webp',
      },
    ],
  },
  // 6. Lunges + Knee Pain
  {
    aliases: [
      'lunges',
      'walking-lunges',
      'forward-lunges',
      'lunge',
      'walking-lunge',
      'step-ups',
    ],
    conditionCode: 'knee_pain',
    original: {
      id: '0060',
      name: 'Walking Lunges',
      movementPattern: 'lunge',
      target: 'Quadriceps & Gluteus Maximus',
      bodyPart: 'Upper Legs',
      mediaUrl: '/images/exercises/catalog/0060.webp',
    },
    alternatives: [
      {
        id: 'reverse_lunges',
        name: 'Step-Back Reverse Lunge',
        targetMuscle: 'Gluteus Maximus & Hamstrings',
        shearReductionReason:
          'Stepping backward absorbs braking force through the hip joint, keeping the lead tibia vertical and sparing patellofemoral cartilage.',
        setupCue:
          'Step back onto ball of foot, sink rear knee straight down, and ensure lead shin stays vertical throughout the rep.',
        mediaUrl: '/images/exercises/catalog/0062.webp',
      },
      {
        id: 'bulgarian_split_squat_forward_lean',
        name: 'Bulgarian Split Squat (Forward Torso Lean)',
        targetMuscle: 'Glutes & Posterior Chain',
        shearReductionReason:
          'A 15-degree forward torso incline shifts moment arm demands from the anterior patella to the posterior gluteal complex.',
        setupCue:
          'Place rear foot on bench, hinge slightly at hips with flat back, and lower hips down and back into lead heel.',
        mediaUrl: '/images/exercises/catalog/0115.webp',
      },
      {
        id: 'box_step_ups_slow_eccentric',
        name: 'Box Step-Ups (Controlled Eccentric)',
        targetMuscle: 'Quadriceps & Gluteus Medius',
        shearReductionReason:
          'Eliminates ballistic impact loading while building single-leg strength through controlled concentric elevation.',
        setupCue:
          'Plant entire lead foot on box, drive straight up without pushing off rear toe, then lower under a 3-second tempo.',
        mediaUrl: '/images/exercises/catalog/0074.webp',
      },
    ],
  },
  // 7. Skull Crushers + Elbow Pain
  {
    aliases: [
      'skull-crushers',
      'skull-crusher',
      'lying-triceps-extension',
      'barbell-skull-crushers',
      'french-press',
    ],
    conditionCode: 'elbow_pain',
    original: {
      id: '0080',
      name: 'Barbell Skull Crushers',
      movementPattern: 'isolation',
      target: 'Triceps Brachii',
      bodyPart: 'Upper Arms',
      mediaUrl: '/images/exercises/catalog/0080.webp',
    },
    alternatives: [
      {
        id: 'cable_triceps_pushdown_rope',
        name: 'Cable Triceps Pushdown (Rope Attachment)',
        targetMuscle: 'Triceps Brachii (Lateral & Medial Heads)',
        shearReductionReason:
          'Flexible rope handles permit natural forearm pronation at peak contraction, preventing rigid elbow joint torque.',
        setupCue:
          'Keep upper arms pinned to ribs, pull rope down, and spread rope ends outward at the bottom of the movement.',
        mediaUrl: '/images/exercises/catalog/0230.webp',
      },
      {
        id: 'incline_dumbbell_overhead_extension',
        name: 'Incline Bench Neutral Dumbbell Triceps Extension',
        targetMuscle: 'Triceps Brachii (Long Head)',
        shearReductionReason:
          'Incline angle and neutral grip alignment place the distal triceps tendon in a smoother anatomical groove.',
        setupCue:
          'Lie back on a 45-degree bench with palms facing inward; bend only at elbows while keeping upper arms angled back.',
        mediaUrl: '/images/exercises/catalog/0175.webp',
      },
      {
        id: 'close_grip_pushups',
        name: 'Close-Grip Push-Ups / Floor Dips',
        targetMuscle: 'Triceps Brachii & Pectorals',
        shearReductionReason:
          'Closed kinetic chain loading allows micro-adjustments in wrist/elbow positioning to eliminate focal tendon stress.',
        setupCue:
          'Place hands shoulder-width apart on floor or elevated box, tuck elbows close to ribcage, and lower smoothly.',
        mediaUrl: '/images/exercises/catalog/0018.webp',
      },
    ],
  },
  // 8. Pull-Ups / Lat Pulldown + Shoulder Pain
  {
    aliases: [
      'pull-ups',
      'pull-up',
      'chin-ups',
      'chin-up',
      'lat-pulldown',
      'lat-pull-down',
    ],
    conditionCode: 'shoulder_pain',
    original: {
      id: '0050',
      name: 'Pull-Ups',
      movementPattern: 'vertical_pull',
      target: 'Latissimus Dorsi',
      bodyPart: 'Back',
      mediaUrl: '/images/exercises/catalog/0050.webp',
    },
    alternatives: [
      {
        id: 'neutral_grip_lat_pulldown',
        name: 'Neutral-Grip Lat Pulldown (Parallel Handles)',
        targetMuscle: 'Latissimus Dorsi & Biceps Brachii',
        shearReductionReason:
          'Parallel neutral grip avoids extreme internal glenohumeral rotation, preventing subacromial impingement at full overhead stretch.',
        setupCue:
          'Grasp parallel handles, lean back ~10 degrees, and pull elbows straight down towards your lateral ribcage.',
        mediaUrl: '/images/exercises/catalog/0225.webp',
      },
      {
        id: 'half_kneeling_single_arm_pulldown',
        name: 'Half-Kneeling Single-Arm Cable Pulldown',
        targetMuscle: 'Latissimus Dorsi & Serratus Anterior',
        shearReductionReason:
          'Unilateral cable mechanics permit the scapula to rotate freely throughout the full arc of movement without constraint.',
        setupCue:
          'Kneel facing cable pulley, let cable gently stretch shoulder up, then drive elbow down firmly into hip pocket.',
        mediaUrl: '/images/exercises/catalog/0210.webp',
      },
      {
        id: 'straight_arm_cable_pulldown',
        name: 'Straight-Arm Cable Pulldown',
        targetMuscle: 'Latissimus Dorsi & Teres Major',
        shearReductionReason:
          'Isolates latissimus dorsi contraction without elbow flexion or anterior shoulder capsule tensile loading.',
        setupCue:
          'Keep slight bend in elbows, hinge slightly at hips, and sweep the bar down in an arc until it touches your upper thighs.',
        mediaUrl: '/images/exercises/catalog/0220.webp',
      },
    ],
  },
];

export async function resolveExerciseAlternatives(
  db: ReturnType<typeof getApiRouteContext>['db'],
  slug: string,
): Promise<ExerciseAlternativesResult> {
  const parsed = parseAlternativeSlug(slug);
  const condition = parsed.painCondition;

  // 1. Check curated profiles first for maximum precision
  const curatedMatch = CURATED_PROFILES.find((profile) => {
    const isExMatch = profile.aliases.some((alias) =>
      parsed.exerciseSlug.includes(alias) || alias.includes(parsed.exerciseSlug),
    );
    const isCondMatch =
      profile.conditionCode === condition.code ||
      (profile.conditionCode === 'shoulder_pain' && condition.code === 'shoulder_impingement') ||
      (profile.conditionCode === 'shoulder_impingement' && condition.code === 'shoulder_pain');
    return isExMatch && isCondMatch;
  }) || CURATED_PROFILES.find((profile) =>
    profile.aliases.some((alias) =>
      parsed.exerciseSlug.includes(alias) || alias.includes(parsed.exerciseSlug),
    ),
  );

  if (curatedMatch) {
    const original = { ...curatedMatch.original };
    const alternatives = curatedMatch.alternatives.map((alt) => ({ ...alt }));

    // If DB is connected, attempt to enrich media & details
    if (db) {
      try {
        const dbExRows = await db
          .select({
            id: masterExercises.id,
            canonicalId: masterExercises.canonicalId,
            name: masterExercises.name,
            movementPattern: masterExercises.movementPattern,
            target: masterExercises.target,
            bodyPart: masterExercises.bodyPart,
            mediaUrl: exerciseMedia.storageUrl,
          })
          .from(masterExercises)
          .leftJoin(exerciseMedia, eq(exerciseMedia.exerciseId, masterExercises.id))
          .where(
            or(
              like(sql`lower(${masterExercises.name})`, `%${parsed.exerciseNameQuery}%`),
              eq(masterExercises.canonicalId, original.id),
            ),
          )
          .limit(1);

        if (dbExRows[0]) {
          const row = dbExRows[0];
          original.id = row.canonicalId || row.id;
          original.name = row.name || original.name;
          if (row.movementPattern) original.movementPattern = row.movementPattern;
          if (row.target) original.target = row.target;
          if (row.bodyPart) original.bodyPart = row.bodyPart;
          if (row.mediaUrl) original.mediaUrl = row.mediaUrl;
        }
      } catch (err) {
        console.warn('Could not enrich exercise alternatives from DB:', err);
      }
    }

    const title = `${original.name} Alternatives for ${condition.displayName} | PhysioCoach AI`;
    const metaDescription = `Evidence-based biomechanical alternatives to ${original.name} for lifters experiencing ${condition.displayName}. Maintain target muscle hypertrophy while reducing joint shear.`;
    const canonicalUrl = `https://physiocoach.ai/tools/alternatives/${parsed.rawSlug}`;

    const schemaJsonLd = generateSchemaJsonLd({
      title,
      metaDescription,
      canonicalUrl,
      originalName: original.name,
      painCondition: condition,
      alternatives,
    });

    return {
      originalExercise: original,
      painCondition: condition,
      alternatives,
      seoMetadata: {
        title,
        metaDescription,
        canonicalUrl,
        schemaJsonLd,
      },
    };
  }

  // 2. Dynamic Database Lookup & Generation
  if (db) {
    try {
      const searchTerms = parsed.exerciseNameQuery.split(' ').filter(Boolean);
      const searchConditions = searchTerms.map((term) =>
        like(sql`lower(${masterExercises.name})`, `%${term.toLowerCase()}%`),
      );

      const dbRows = await db
        .select({
          id: masterExercises.id,
          canonicalId: masterExercises.canonicalId,
          name: masterExercises.name,
          movementPattern: masterExercises.movementPattern,
          target: masterExercises.target,
          primaryMuscle: masterExercises.primaryMuscle,
          bodyPart: masterExercises.bodyPart,
          excludedLimitationsJson: masterExercises.excludedLimitationsJson,
          mediaUrl: exerciseMedia.storageUrl,
        })
        .from(masterExercises)
        .leftJoin(exerciseMedia, eq(exerciseMedia.exerciseId, masterExercises.id))
        .where(searchConditions.length > 0 ? and(...searchConditions) : undefined)
        .limit(1);

      const matchedEx = dbRows[0];
      if (matchedEx) {
        const pattern = matchedEx.movementPattern || 'compound';
        const targetMuscle = matchedEx.target || matchedEx.primaryMuscle || 'Target Muscle';
        const bodyPart = matchedEx.bodyPart || 'Full Body';

        // Query alternatives in same pattern without this pain condition
        const altRows = await db
          .select({
            id: masterExercises.id,
            canonicalId: masterExercises.canonicalId,
            name: masterExercises.name,
            target: masterExercises.target,
            primaryMuscle: masterExercises.primaryMuscle,
            bodyPart: masterExercises.bodyPart,
            movementPattern: masterExercises.movementPattern,
            mediaUrl: exerciseMedia.storageUrl,
          })
          .from(masterExercises)
          .leftJoin(exerciseMedia, eq(exerciseMedia.exerciseId, masterExercises.id))
          .where(
            and(
              eq(masterExercises.movementPattern, pattern),
              not(eq(masterExercises.id, matchedEx.id)),
              not(like(sql`coalesce(${masterExercises.excludedLimitationsJson}, '')`, `%${condition.code}%`)),
            ),
          )
          .limit(3);

        const dynamicAlts: AlternativeMovement[] = altRows.map((alt, idx) => ({
          id: alt.canonicalId || alt.id || `alt_${idx + 1}`,
          name: alt.name,
          targetMuscle: alt.target || alt.primaryMuscle || targetMuscle,
          shearReductionReason: `Preserves ${alt.target || targetMuscle} activation while modifying joint angles to eliminate acute ${condition.bodyRegion} stress.`,
          setupCue: `Execute with strict tempo and controlled range of motion; avoid bouncing or rapid momentum shifts.`,
          mediaUrl: alt.mediaUrl || `/images/exercises/fallback.webp`,
        }));

        if (dynamicAlts.length < 3) {
          // Fill with default variations
          dynamicAlts.push({
            id: 'unilateral_variation',
            name: `Unilateral DB / Cable ${matchedEx.name}`,
            targetMuscle: targetMuscle,
            shearReductionReason: `Allows independent joint tracking along the natural physiological plane of motion without rigid barbell constraints.`,
            setupCue: `Brace core firmly and execute reps under a 3-second lowering tempo.`,
            mediaUrl: '/images/exercises/fallback.webp',
          });
        }

        const originalInfo: OriginalExerciseInfo = {
          id: matchedEx.canonicalId || matchedEx.id,
          name: matchedEx.name,
          movementPattern: pattern,
          target: targetMuscle,
          bodyPart: bodyPart,
          mediaUrl: matchedEx.mediaUrl || `/images/exercises/fallback.webp`,
        };

        const title = `${originalInfo.name} Alternatives for ${condition.displayName} | PhysioCoach AI`;
        const metaDescription = `Evidence-based injury-safe alternatives to ${originalInfo.name} for lifters experiencing ${condition.displayName}. Maintain muscle tension with low joint shear.`;
        const canonicalUrl = `https://physiocoach.ai/tools/alternatives/${parsed.rawSlug}`;
        const schemaJsonLd = generateSchemaJsonLd({
          title,
          metaDescription,
          canonicalUrl,
          originalName: originalInfo.name,
          painCondition: condition,
          alternatives: dynamicAlts.slice(0, 3),
        });

        return {
          originalExercise: originalInfo,
          painCondition: condition,
          alternatives: dynamicAlts.slice(0, 3),
          seoMetadata: {
            title,
            metaDescription,
            canonicalUrl,
            schemaJsonLd,
          },
        };
      }
    } catch (err) {
      console.warn('Failed dynamic alternative search:', err);
    }
  }

  // 3. Fallback Synthesized Result for Any General Exercise
  const formattedName = parsed.exerciseNameQuery
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const fallbackOriginal: OriginalExerciseInfo = {
    id: parsed.exerciseSlug,
    name: formattedName || 'Target Exercise',
    movementPattern: 'compound',
    target: 'Primary Muscle Group',
    bodyPart: condition.bodyRegion,
    mediaUrl: '/images/exercises/fallback.webp',
  };

  const fallbackAlternatives: AlternativeMovement[] = [
    {
      id: `${parsed.exerciseSlug}_dumbbell_variation`,
      name: `Neutral-Grip Dumbbell ${formattedName}`,
      targetMuscle: 'Prime Mover Muscles',
      shearReductionReason:
        'Neutral grip and independent dumbbell freedom eliminate joint impingement and excessive torsional shear.',
      setupCue: 'Maintain a stable braced posture, keeping dumbbells aligned with natural joint angles.',
      mediaUrl: '/images/exercises/fallback.webp',
    },
    {
      id: `${parsed.exerciseSlug}_supported_variation`,
      name: `Chest / Back Supported ${formattedName}`,
      targetMuscle: 'Target Muscle Group',
      shearReductionReason:
        'External pad support removes axial spinal compression and stabilizing joint strain.',
      setupCue: 'Pin torso securely against support pad and initiate movement strictly from target muscles.',
      mediaUrl: '/images/exercises/fallback.webp',
    },
    {
      id: `${parsed.exerciseSlug}_cable_variation`,
      name: `Standing Cable ${formattedName}`,
      targetMuscle: 'Target Muscle Group',
      shearReductionReason:
        'Constant line of resistance provides smooth force vectors without end-range joint collisions.',
      setupCue: 'Set pulleys to align directly with your limb path; execute with smooth 2-second concentric control.',
      mediaUrl: '/images/exercises/fallback.webp',
    },
  ];

  const title = `${fallbackOriginal.name} Alternatives for ${condition.displayName} | PhysioCoach AI`;
  const metaDescription = `Evidence-based injury-safe alternatives to ${fallbackOriginal.name} for lifters experiencing ${condition.displayName}. Maintain prime mover hypertrophy with low joint shear.`;
  const canonicalUrl = `https://physiocoach.ai/tools/alternatives/${parsed.rawSlug}`;

  const schemaJsonLd = generateSchemaJsonLd({
    title,
    metaDescription,
    canonicalUrl,
    originalName: fallbackOriginal.name,
    painCondition: condition,
    alternatives: fallbackAlternatives,
  });

  return {
    originalExercise: fallbackOriginal,
    painCondition: condition,
    alternatives: fallbackAlternatives,
    seoMetadata: {
      title,
      metaDescription,
      canonicalUrl,
      schemaJsonLd,
    },
  };
}

function generateSchemaJsonLd(params: {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  originalName: string;
  painCondition: KnownPainCondition;
  alternatives: AlternativeMovement[];
}): Record<string, unknown> {
  const { title, metaDescription, canonicalUrl, originalName, painCondition, alternatives } = params;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MedicalWebPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description: metaDescription,
        aspect: ['diagnosis', 'treatment', 'lifestyle'],
        medicalAudience: 'Patient',
        about: [
          {
            '@type': 'MedicalCondition',
            name: painCondition.displayName,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: `Why does ${originalName} cause or aggravate ${painCondition.displayName.toLowerCase()}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: painCondition.biomechanicalCause,
            },
          },
          {
            '@type': 'Question',
            name: `What are the best injury-safe alternatives to ${originalName}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `The top 3 safer alternative movements are ${alternatives.map((a) => a.name).join(', ')}. These preserve target muscle tension while substantially lowering joint shear.`,
            },
          },
          {
            '@type': 'Question',
            name: `How do these alternative exercises protect the ${painCondition.bodyRegion}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text:
                alternatives[0]?.shearReductionReason ||
                'By altering movement angles, avoiding terminal impingement zones, and optimizing biomechanical leverage under load.',
            },
          },
        ],
      },
    ],
  };
}
