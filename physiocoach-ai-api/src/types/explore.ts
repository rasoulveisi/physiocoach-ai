export type WorkoutSplitType = 'push_pull_legs' | 'upper_lower' | 'full_body' | 'custom';
export type ExperienceLevelType = 'beginner' | 'intermediate' | 'advanced';

export interface ExploreExerciseItem {
  id: string;
  name: string;
  movementPattern: 'squat' | 'hinge' | 'push' | 'pull' | 'lunge' | 'carry' | 'core' | 'mobility';
  muscleGroup: string;
  sets: number;
  reps: string;
  restSeconds: number;
  rpe?: number | undefined;
  notes?: string | undefined;
  masterExerciseId?: string | undefined;
}

export interface ExploreDayItem {
  dayNumber: number;
  name: string;
  focus: string;
  exercises: ExploreExerciseItem[];
}

export interface ExplorePlanAuthor {
  name: string;
  role: string;
  avatar?: string | undefined;
  verified: boolean;
}

export interface ExploreProgression {
  baselineIntensity: string;
  progressionRule: string;
  increasePercent: number;
  conditions: string[];
}

export interface ExplorePrimaryExercise {
  name: string;
  masterExerciseId?: string | undefined;
  movementPattern?: string | undefined;
  muscleGroup?: string | undefined;
  mediaUrl?: string | undefined;
}

export interface ExplorePlanForkInfo {
  planId: string;
  authorName: string;
  planTitle?: string | undefined;
}

export interface ExplorePlanDto {
  id: string;
  title: string;
  description: string;
  split: WorkoutSplitType;
  frequencyDays: number;
  experienceLevel: ExperienceLevelType;
  equipment: string[];
  jointTags: string[];
  targetPersonas: string[];
  totalWeeklySets: number;
  author: ExplorePlanAuthor;
  cloneCount: number;
  days: ExploreDayItem[];
  summary?: string | undefined;
  safetyNotes?: string[] | undefined;
  progression?: ExploreProgression | undefined;
  isVerified: boolean;
  rating: number;
  reviewsCount: number;
  createdAt: string;
  primaryExercise?: ExplorePrimaryExercise | undefined;
  forkedFrom?: ExplorePlanForkInfo | undefined;
}

export const VERIFIED_EXPLORE_TEMPLATES: ExplorePlanDto[] = [
  {
    id: 'template-ppl-knee-safe',
    title: 'PPL Knee-Safe (Patellar Unloaded)',
    description:
      'Clinical push-pull-legs hyper-specialized for athletes with patellar tendon irritation or anterior knee pain. Emphasizes vertical shin squats, deep hinge loading, and scapular stabilization without shear stress.',
    split: 'push_pull_legs',
    frequencyDays: 3,
    experienceLevel: 'intermediate',
    equipment: ['barbell', 'dumbbells', 'bench', 'cable_machine'],
    jointTags: ['Knee-Friendly', 'Low Patellar Shear', 'Hip Hinge Focused'],
    targetPersonas: [
      'Athletes with Patellar Tendinopathy',
      'Knee-Friendly Hypertrophy',
      'Runners with Knee Overuse',
    ],
    totalWeeklySets: 48,
    author: {
      name: 'Dr. Marcus Vance, DPT, CSCS',
      role: 'Clinical Sports Physical Therapist',
      verified: true,
    },
    cloneCount: 0,
    rating: 5.0,
    reviewsCount: 0,
    createdAt: '2026-06-01T00:00:00.000Z',
    isVerified: true,
    summary:
      'Eliminates anterior tibial shear by replacing quad-dominant deep forward knee travel with vertical-shin box squats and glute-biased hinges.',
    safetyNotes: [
      'Maintain vertical shin angle during single-leg lunges to shift load away from the patellar tendon.',
      'Stop Romanian deadlifts immediately if hamstrings lose tension or lumbar rounds.',
      'Tuck elbows 45° during all horizontal and incline presses to preserve glenohumeral clearance.',
    ],
    progression: {
      baselineIntensity: 'low-moderate',
      progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
      increasePercent: 10,
      conditions: ['Two pain-free sessions', 'Zero anterior knee aching post-workout'],
    },
    days: [
      {
        dayNumber: 1,
        name: 'Day 1: Push A (Chest, Delts & Triceps)',
        focus: 'Upper Body Hypertrophy & Neutral Pressing',
        exercises: [
          {
            id: 'ppl-d1-ex1',
            name: 'Incline Dumbbell Bench Press',
            movementPattern: 'push',
            muscleGroup: 'chest',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            rpe: 8,
            notes: 'Tuck elbows to 45 degrees to protect anterior capsule and rotator cuff.',
          },
          {
            id: 'ppl-d1-ex2',
            name: 'Standing Cable Chest Flyes',
            movementPattern: 'push',
            muscleGroup: 'chest',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            rpe: 8,
            notes: 'Squeeze pectorals at mid-line without allowing shoulders to roll forward.',
          },
          {
            id: 'ppl-d1-ex3',
            name: 'Dumbbell Lateral Raises (Scapular Plane)',
            movementPattern: 'push',
            muscleGroup: 'shoulders',
            sets: 4,
            reps: '12-15',
            restSeconds: 60,
            rpe: 8,
            notes: 'Raise arms in the scapular plane (30° forward) with slight forward torso lean.',
          },
          {
            id: 'ppl-d1-ex4',
            name: 'Overhead Cable Triceps Extension',
            movementPattern: 'push',
            muscleGroup: 'triceps',
            sets: 3,
            reps: '12',
            restSeconds: 60,
            rpe: 8,
            notes: 'Maintain neutral cervical spine and keep ribs clamped down.',
          },
          {
            id: 'ppl-d1-ex5',
            name: 'Serratus Wall Slides with Foam Roller',
            movementPattern: 'mobility',
            muscleGroup: 'serratus',
            sets: 3,
            reps: '10',
            restSeconds: 45,
            notes: 'Active upward scapular rotation and protraction at the top range.',
          },
        ],
      },
      {
        dayNumber: 2,
        name: 'Day 2: Pull A (Back, Rear Delts & Biceps)',
        focus: 'Scapulothoracic Strength & Upper Back Density',
        exercises: [
          {
            id: 'ppl-d2-ex1',
            name: 'Chest-Supported T-Bar Row',
            movementPattern: 'pull',
            muscleGroup: 'back',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            rpe: 8,
            notes: 'Drive elbows down and back with zero spinal jerking or lumbar extension.',
          },
          {
            id: 'ppl-d2-ex2',
            name: 'Neutral-Grip Lat Pulldown',
            movementPattern: 'pull',
            muscleGroup: 'lats',
            sets: 3,
            reps: '10-12',
            restSeconds: 75,
            rpe: 8,
            notes: 'Keep chest lifted and pull towards collarbone with neutral wrist alignment.',
          },
          {
            id: 'ppl-d2-ex3',
            name: 'Face Pulls with External Rotation',
            movementPattern: 'pull',
            muscleGroup: 'rear_delts',
            sets: 4,
            reps: '15',
            restSeconds: 60,
            rpe: 8,
            notes: 'Thumbs pointing backward at eye level, focus on rotator cuff activation.',
          },
          {
            id: 'ppl-d2-ex4',
            name: 'Incline Dumbbell Biceps Curl',
            movementPattern: 'pull',
            muscleGroup: 'biceps',
            sets: 3,
            reps: '10-12',
            restSeconds: 60,
            rpe: 8,
            notes: 'Full stretch at bottom, strict curl without swinging torso.',
          },
          {
            id: 'ppl-d2-ex5',
            name: 'Dead Hang (Spinal Decompression)',
            movementPattern: 'mobility',
            muscleGroup: 'spine',
            sets: 3,
            reps: '45s hold',
            restSeconds: 60,
            notes: 'Full passive hang for glenohumeral joint distraction and disc decompression.',
          },
        ],
      },
      {
        dayNumber: 3,
        name: 'Day 3: Legs A (Knee-Safe Posterior Chain)',
        focus: 'Glute, Hamstring & Calves with Zero Anterior Knee Shear',
        exercises: [
          {
            id: 'ppl-d3-ex1',
            name: 'Romanian Deadlift with Dumbbells',
            movementPattern: 'hinge',
            muscleGroup: 'hamstrings',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            rpe: 8,
            notes: 'Hinge hips backward, keep knees soft, dumbbells skimming shins.',
          },
          {
            id: 'ppl-d3-ex2',
            name: 'Barbell Hip Thrust with Pad',
            movementPattern: 'hinge',
            muscleGroup: 'glutes',
            sets: 4,
            reps: '10-12',
            restSeconds: 90,
            rpe: 8,
            notes: 'Full glute lockout at top with tucked chin and vertical shins at 90 degrees.',
          },
          {
            id: 'ppl-d3-ex3',
            name: 'Bulgarian Split Squat (Vertical Shin Biased)',
            movementPattern: 'lunge',
            muscleGroup: 'quads',
            sets: 3,
            reps: '10 / leg',
            restSeconds: 75,
            rpe: 8,
            notes: 'Keep front shin vertical to load hip extensors rather than the patellar tendon.',
          },
          {
            id: 'ppl-d3-ex4',
            name: 'Seated Calf Raise',
            movementPattern: 'squat',
            muscleGroup: 'calves',
            sets: 4,
            reps: '15',
            restSeconds: 60,
            rpe: 8,
            notes: '3-second isometric pause at the bottom stretch position.',
          },
          {
            id: 'ppl-d3-ex5',
            name: 'Copenhagen Plank Hold',
            movementPattern: 'core',
            muscleGroup: 'adductors',
            sets: 3,
            reps: '25s / side',
            restSeconds: 60,
            notes: 'Adductor and pelvic stability to enhance frontal-plane knee tracking.',
          },
        ],
      },
    ],
  },
  {
    id: 'template-desk-worker-posture',
    title: 'Upper/Lower Desk-Worker Posture',
    description:
      'Targeted posture-corrective hypertrophy program designed for desk-bound professionals. Reverses forward head carriage, relieves thoracic stiffness, and activates dormant glutes.',
    split: 'upper_lower',
    frequencyDays: 4,
    experienceLevel: 'beginner',
    equipment: ['dumbbells', 'cable_machine', 'bench', 'resistance_bands'],
    jointTags: ['Low Spine Load', 'Posture Corrective', 'Thoracic Mobility'],
    targetPersonas: [
      'Desk Workers with Back Pain',
      'Sedentary Professionals',
      'Forward Head & Kyphosis Recovery',
    ],
    totalWeeklySets: 66,
    author: {
      name: 'Elena Rostova, PT, OCS',
      role: 'Orthopedic Clinical Specialist',
      verified: true,
    },
    cloneCount: 0,
    rating: 5.0,
    reviewsCount: 0,
    createdAt: '2026-06-02T00:00:00.000Z',
    isVerified: true,
    summary:
      'Counteracts 8+ hours of daily sitting by prioritizing thoracic extension, lower trap strengthening, and glute medius activation.',
    safetyNotes: [
      'Press lumbar firmly into the floor during deadbugs to prevent anterior pelvic tilt.',
      'Maintain upright spine on box squats; avoid rounding forward when sitting back.',
      'Focus on scapular retraction before bending elbows on all rowing movements.',
    ],
    progression: {
      baselineIntensity: 'low-moderate',
      progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
      increasePercent: 10,
      conditions: ['Two pain-free sessions', 'No neck or low back tightness'],
    },
    days: [
      {
        dayNumber: 1,
        name: 'Day 1: Upper A (Thoracic Mobility & Horizontal Pulling)',
        focus: 'Scapular Retraction & Anterior Shoulder Opening',
        exercises: [
          {
            id: 'posture-d1-ex1',
            name: 'Dumbbell Neutral Flat Bench Press',
            movementPattern: 'push',
            muscleGroup: 'chest',
            sets: 3,
            reps: '10',
            restSeconds: 75,
            rpe: 7,
            notes: 'Palms facing inward protects AC joint and subacromial space.',
          },
          {
            id: 'posture-d1-ex2',
            name: 'Chest-Supported Neutral Dumbbell Row',
            movementPattern: 'pull',
            muscleGroup: 'back',
            sets: 4,
            reps: '12',
            restSeconds: 75,
            rpe: 8,
            notes: 'Retract scapulae firmly before initiating elbow pull.',
          },
          {
            id: 'posture-d1-ex3',
            name: 'Prone Y-T-W Raises on Incline Bench',
            movementPattern: 'pull',
            muscleGroup: 'traps',
            sets: 3,
            reps: '12',
            restSeconds: 60,
            notes: 'Strengthens lower and middle trapezius for thoracic posture.',
          },
          {
            id: 'posture-d1-ex4',
            name: 'Half-Kneeling Single-Arm Cable Overhead Press',
            movementPattern: 'push',
            muscleGroup: 'shoulders',
            sets: 3,
            reps: '10 / side',
            restSeconds: 60,
            rpe: 7,
            notes: 'Glute engaged on down-knee leg to prevent lumbar hyperextension.',
          },
          {
            id: 'posture-d1-ex5',
            name: 'Deadbug Core Stabilization',
            movementPattern: 'core',
            muscleGroup: 'abdominals',
            sets: 3,
            reps: '12 / side',
            restSeconds: 45,
            notes: 'Press lumbar spine flush against the floor throughout.',
          },
        ],
      },
      {
        dayNumber: 2,
        name: 'Day 2: Lower A (Glute Activation & Pelvic Alignment)',
        focus: 'Glute Medius & Hamstring Strength',
        exercises: [
          {
            id: 'posture-d2-ex1',
            name: 'Trap Bar Deadlift (High Handles)',
            movementPattern: 'hinge',
            muscleGroup: 'glutes',
            sets: 4,
            reps: '8',
            restSeconds: 90,
            rpe: 8,
            notes: 'High handles and upright torso angle minimize lumbar moment arm.',
          },
          {
            id: 'posture-d2-ex2',
            name: 'Goblet Box Squat',
            movementPattern: 'squat',
            muscleGroup: 'quads',
            sets: 3,
            reps: '10',
            restSeconds: 75,
            rpe: 7,
            notes: 'Sit back gently onto box to reinforce neutral spinal mechanics.',
          },
          {
            id: 'posture-d2-ex3',
            name: 'Side-Lying Clamshell with Mini-Band',
            movementPattern: 'mobility',
            muscleGroup: 'glutes',
            sets: 3,
            reps: '15 / side',
            restSeconds: 45,
            notes: 'Pelvis rolled slightly forward to isolate gluteus medius.',
          },
          {
            id: 'posture-d2-ex4',
            name: 'Standing Dumbbell Calf Raises',
            movementPattern: 'squat',
            muscleGroup: 'calves',
            sets: 3,
            reps: '15',
            restSeconds: 60,
            rpe: 8,
          },
          {
            id: 'posture-d2-ex5',
            name: 'Pallof Press with Cable or Resistance Band',
            movementPattern: 'core',
            muscleGroup: 'obliques',
            sets: 3,
            reps: '12 / side',
            restSeconds: 45,
            notes: 'Anti-rotation core brace resisting lateral pull.',
          },
        ],
      },
      {
        dayNumber: 3,
        name: 'Day 3: Upper B (Posterior Delts & Lat Expansion)',
        focus: 'Thoracic Extension & Rotator Cuff Health',
        exercises: [
          {
            id: 'posture-d3-ex1',
            name: 'Lat Pulldown with Wide Neutral Grip',
            movementPattern: 'pull',
            muscleGroup: 'lats',
            sets: 4,
            reps: '10',
            restSeconds: 75,
            rpe: 8,
            notes: 'Focus on lat contraction, avoid excessive backward lean.',
          },
          {
            id: 'posture-d3-ex2',
            name: 'Incline Dumbbell Row',
            movementPattern: 'pull',
            muscleGroup: 'back',
            sets: 3,
            reps: '12',
            restSeconds: 75,
            rpe: 8,
            notes: 'Scapular protraction at stretch, strong squeeze at top.',
          },
          {
            id: 'posture-d3-ex3',
            name: 'Cable External Rotations at 90 Degrees',
            movementPattern: 'mobility',
            muscleGroup: 'rotator_cuff',
            sets: 3,
            reps: '15',
            restSeconds: 60,
            notes: 'Keep elbow level with shoulder with controlled light tension.',
          },
          {
            id: 'posture-d3-ex4',
            name: 'Dumbbell Hammer Curl',
            movementPattern: 'pull',
            muscleGroup: 'biceps',
            sets: 3,
            reps: '12',
            restSeconds: 60,
            rpe: 8,
          },
          {
            id: 'posture-d3-ex5',
            name: 'Foam Roller Thoracic Extensions',
            movementPattern: 'mobility',
            muscleGroup: 'spine',
            sets: 3,
            reps: '10',
            restSeconds: 45,
            notes: 'Support cervical spine with both hands during extension.',
          },
        ],
      },
      {
        dayNumber: 4,
        name: 'Day 4: Lower B (Hip Hinge & Unilateral Balance)',
        focus: 'Single-Leg Stability & Posterior Chain',
        exercises: [
          {
            id: 'posture-d4-ex1',
            name: 'Romanian Deadlift with Dumbbells',
            movementPattern: 'hinge',
            muscleGroup: 'hamstrings',
            sets: 4,
            reps: '10',
            restSeconds: 90,
            rpe: 8,
            notes: 'Hinge back with flat spine, feeling hamstrings load.',
          },
          {
            id: 'posture-d4-ex2',
            name: 'Step-Ups with Dumbbells (Low Box)',
            movementPattern: 'lunge',
            muscleGroup: 'glutes',
            sets: 3,
            reps: '10 / side',
            restSeconds: 60,
            rpe: 7,
            notes: 'Drive purely through front heel, zero toe-push from trailing leg.',
          },
          {
            id: 'posture-d4-ex3',
            name: 'Swiss Ball Hamstring Curls',
            movementPattern: 'hinge',
            muscleGroup: 'hamstrings',
            sets: 3,
            reps: '12',
            restSeconds: 60,
            rpe: 8,
            notes: 'Keep hips elevated and level throughout the entire curl.',
          },
          {
            id: 'posture-d4-ex4',
            name: 'Bird-Dog Quadruped',
            movementPattern: 'core',
            muscleGroup: 'spine',
            sets: 3,
            reps: '10 / side',
            restSeconds: 45,
            notes: 'Extend opposite arm and leg without lumbar rotation.',
          },
          {
            id: 'posture-d4-ex5',
            name: 'RKC Plank (Max Tension)',
            movementPattern: 'core',
            muscleGroup: 'core',
            sets: 3,
            reps: '20s max tension',
            restSeconds: 45,
            notes: 'Engage abs, glutes, and lats with maximal isometric tension.',
          },
        ],
      },
    ],
  },
  {
    id: 'template-fullbody-minimalist',
    title: '3-Day Full Body Minimalist',
    description:
      'High-yield, time-efficient compound training protocol. Maximum muscle stimulus and metabolic conditioning in 45 minutes with low joint wear.',
    split: 'full_body',
    frequencyDays: 3,
    experienceLevel: 'beginner',
    equipment: ['dumbbells', 'barbell', 'bench'],
    jointTags: ['Time-Efficient', 'Joint-Preserving', 'Full Body Balance'],
    targetPersonas: [
      'Time-Crunched Strength',
      'Busy Executives',
      'Total Body Reconditioning',
    ],
    totalWeeklySets: 45,
    author: {
      name: 'Coach Julian Mercer, CSCS',
      role: 'Strength & Conditioning Specialist',
      verified: true,
    },
    cloneCount: 0,
    rating: 5.0,
    reviewsCount: 0,
    createdAt: '2026-06-03T00:00:00.000Z',
    isVerified: true,
    summary:
      'Combines high-leverage compound movements into 45-minute structured sessions to stimulate strength and posture without excess joint fatigue.',
    safetyNotes: [
      'Limit deadlift volume when fatigued; stop sets with 2 reps in reserve (RPE 8).',
      'Use floor press to protect shoulders from extreme extension at bottom range.',
      'Maintain braced core on all carries to protect lumbar spine.',
    ],
    progression: {
      baselineIntensity: 'low-moderate',
      progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
      increasePercent: 10,
      conditions: ['Two pain-free sessions', 'Solid form on all compound lifts'],
    },
    days: [
      {
        dayNumber: 1,
        name: 'Day 1: Full Body A (Strength & Posture Foundation)',
        focus: 'Major Multi-Joint Compounds',
        exercises: [
          {
            id: 'fb-d1-ex1',
            name: 'Hex Bar Deadlift',
            movementPattern: 'hinge',
            muscleGroup: 'glutes',
            sets: 3,
            reps: '6',
            restSeconds: 120,
            rpe: 8,
            notes: 'Neutral grip and centered load reduce lumbar moment arm.',
          },
          {
            id: 'fb-d1-ex2',
            name: 'Incline Dumbbell Bench Press',
            movementPattern: 'push',
            muscleGroup: 'chest',
            sets: 3,
            reps: '8-10',
            restSeconds: 90,
            rpe: 8,
            notes: '45-degree angle protects anterior capsule.',
          },
          {
            id: 'fb-d1-ex3',
            name: 'Chest-Supported Neutral Dumbbell Row',
            movementPattern: 'pull',
            muscleGroup: 'back',
            sets: 3,
            reps: '10-12',
            restSeconds: 75,
            rpe: 8,
            notes: 'Scapular retraction without spinal twisting.',
          },
          {
            id: 'fb-d1-ex4',
            name: 'Standing Overhead Dumbbell Carry',
            movementPattern: 'carry',
            muscleGroup: 'core',
            sets: 3,
            reps: '40m walk',
            restSeconds: 60,
            notes: 'Core brace, active shoulder elevation.',
          },
          {
            id: 'fb-d1-ex5',
            name: 'Hanging Knee Raises',
            movementPattern: 'core',
            muscleGroup: 'abs',
            sets: 3,
            reps: '12',
            restSeconds: 60,
            notes: 'Posterior pelvic tilt at peak contraction.',
          },
        ],
      },
      {
        dayNumber: 2,
        name: 'Day 2: Full Body B (Hypertrophy & Posterior Chain)',
        focus: 'Unilateral Balance & Upper Back Density',
        exercises: [
          {
            id: 'fb-d2-ex1',
            name: 'Dumbbell Bulgarian Split Squats',
            movementPattern: 'lunge',
            muscleGroup: 'quads',
            sets: 3,
            reps: '8-10 / leg',
            restSeconds: 90,
            rpe: 8,
            notes: 'Forward torso lean loads glutes and protects front knee.',
          },
          {
            id: 'fb-d2-ex2',
            name: 'Dumbbell Floor Press',
            movementPattern: 'push',
            muscleGroup: 'chest',
            sets: 3,
            reps: '10',
            restSeconds: 75,
            rpe: 8,
            notes: 'Floor stops hyperextension of shoulders at bottom.',
          },
          {
            id: 'fb-d2-ex3',
            name: 'Neutral-Grip Lat Pulldown or Chin-Up',
            movementPattern: 'pull',
            muscleGroup: 'lats',
            sets: 3,
            reps: '10-12',
            restSeconds: 75,
            rpe: 8,
            notes: 'Dual handle pull to chest level.',
          },
          {
            id: 'fb-d2-ex4',
            name: 'Barbell Romanian Deadlift',
            movementPattern: 'hinge',
            muscleGroup: 'hamstrings',
            sets: 3,
            reps: '8-10',
            restSeconds: 90,
            rpe: 8,
            notes: 'Controlled 3-second eccentric lower.',
          },
          {
            id: 'fb-d2-ex5',
            name: 'Side Plank with Leg Lift',
            movementPattern: 'core',
            muscleGroup: 'obliques',
            sets: 3,
            reps: '30s / side',
            restSeconds: 45,
            notes: 'Glute medius and quadratus lumborum endurance.',
          },
        ],
      },
      {
        dayNumber: 3,
        name: 'Day 3: Full Body C (Capacity & Dynamic Stability)',
        focus: 'Tempo & Functional Symmetry',
        exercises: [
          {
            id: 'fb-d3-ex1',
            name: 'Goblet Squat (Tempo 3-1-1)',
            movementPattern: 'squat',
            muscleGroup: 'quads',
            sets: 3,
            reps: '10',
            restSeconds: 90,
            rpe: 7,
            notes: '3s lowering, 1s pause, explode up.',
          },
          {
            id: 'fb-d3-ex2',
            name: 'Push-Ups on Handles or Dumbbells',
            movementPattern: 'push',
            muscleGroup: 'chest',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            rpe: 8,
            notes: 'Neutral wrist alignment, solid core plank.',
          },
          {
            id: 'fb-d3-ex3',
            name: 'Single-Leg Romanian Deadlift with Dumbbell',
            movementPattern: 'hinge',
            muscleGroup: 'hamstrings',
            sets: 3,
            reps: '10 / leg',
            restSeconds: 60,
            rpe: 7,
            notes: 'Balance and hip stability.',
          },
          {
            id: 'fb-d3-ex4',
            name: 'Face Pulls with Cable or Band',
            movementPattern: 'pull',
            muscleGroup: 'rear_delts',
            sets: 3,
            reps: '15',
            restSeconds: 60,
            rpe: 8,
            notes: 'Rotator cuff and upper back posture balance.',
          },
          {
            id: 'fb-d3-ex5',
            name: "Farmer's Walk with Heavy Dumbbells",
            movementPattern: 'carry',
            muscleGroup: 'grip',
            sets: 3,
            reps: '50m walk',
            restSeconds: 60,
            notes: 'Grip strength and spinal posture integrity.',
          },
        ],
      },
    ],
  },
  {
    id: 'template-shoulder-safe-hypertrophy',
    title: 'Shoulder-Safe Hypertrophy',
    description:
      'Advanced muscle building split strictly engineered around rotator cuff biomechanics. Zero subacromial impingement, neutral grip angles, and heavy horizontal pulling balance.',
    split: 'upper_lower',
    frequencyDays: 4,
    experienceLevel: 'advanced',
    equipment: ['dumbbells', 'cable_machine', 'barbell', 'bench'],
    jointTags: ['Shoulder-Safe', 'Subacromial Space Preserving', 'Rotator Cuff Protective'],
    targetPersonas: [
      'Shoulder Impingement Athletes',
      'Overhead Athletes',
      'Lifters with AC Joint Irritation',
    ],
    totalWeeklySets: 66,
    author: {
      name: 'Dr. Zachary Cole, MD, CSCS',
      role: 'Sports Medicine Physician & Coach',
      verified: true,
    },
    cloneCount: 0,
    rating: 5.0,
    reviewsCount: 0,
    createdAt: '2026-06-04T00:00:00.000Z',
    isVerified: true,
    summary:
      'Eliminates provocative overhead flaring and impingement triggers while delivering high-volume hypertrophy for upper and lower musculature.',
    safetyNotes: [
      'Use 30-degree incline with semi-supinated grips on dumbbell presses to widen subacromial space.',
      'Perform landmine press instead of strict overhead barbell presses for natural scapulohumeral rhythm.',
      'Never skip face pulls or external rotations to counterbalance chest and lat volume.',
    ],
    progression: {
      baselineIntensity: 'low-moderate',
      progressionRule: 'Increase load or reps by +10% after 2 pain-free sessions.',
      increasePercent: 10,
      conditions: ['Two pain-free sessions', 'Zero anterior shoulder pinching'],
    },
    days: [
      {
        dayNumber: 1,
        name: 'Day 1: Upper Push (Subacromial Space Preserving)',
        focus: 'Chest, Anterior Delts & Triceps with Neutral Pressing',
        exercises: [
          {
            id: 'sh-d1-ex1',
            name: 'Low-Incline Dumbbell Neutral Press',
            movementPattern: 'push',
            muscleGroup: 'chest',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            rpe: 8,
            notes: '30-degree incline, palms semi-supinated to avoid impingement.',
          },
          {
            id: 'sh-d1-ex2',
            name: 'Cable Crossover (High to Low Angle)',
            movementPattern: 'push',
            muscleGroup: 'chest',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            rpe: 8,
            notes: 'Declined angle takes stress off supraspinatus tendon.',
          },
          {
            id: 'sh-d1-ex3',
            name: 'Landmine Single-Arm Press',
            movementPattern: 'push',
            muscleGroup: 'shoulders',
            sets: 3,
            reps: '10 / side',
            restSeconds: 75,
            rpe: 8,
            notes: 'Natural arcing movement path preserves glenohumeral clearance.',
          },
          {
            id: 'sh-d1-ex4',
            name: 'Cable Rope Triceps Pressdown',
            movementPattern: 'push',
            muscleGroup: 'triceps',
            sets: 3,
            reps: '12-15',
            restSeconds: 60,
            rpe: 8,
            notes: 'Flare ropes apart at bottom.',
          },
          {
            id: 'sh-d1-ex5',
            name: 'Scapular Push-Ups',
            movementPattern: 'mobility',
            muscleGroup: 'serratus',
            sets: 3,
            reps: '15',
            restSeconds: 45,
            notes: 'Activate serratus anterior to maintain upward scapular rotation.',
          },
        ],
      },
      {
        dayNumber: 2,
        name: 'Day 2: Lower (Posterior Chain & Quad Capacity)',
        focus: 'Knee & Hip Hypertrophy',
        exercises: [
          {
            id: 'sh-d2-ex1',
            name: 'Safety Bar Squat or Goblet Squat',
            movementPattern: 'squat',
            muscleGroup: 'quads',
            sets: 4,
            reps: '8',
            restSeconds: 90,
            rpe: 8,
            notes: 'Keeps shoulders in neutral position without external shoulder rotation stress.',
          },
          {
            id: 'sh-d2-ex2',
            name: 'Romanian Deadlift with Dumbbells',
            movementPattern: 'hinge',
            muscleGroup: 'hamstrings',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            rpe: 8,
            notes: 'Deep hamstring stretch with flat back.',
          },
          {
            id: 'sh-d2-ex3',
            name: 'Leg Press (Feet High & Wide)',
            movementPattern: 'squat',
            muscleGroup: 'glutes',
            sets: 3,
            reps: '12',
            restSeconds: 75,
            rpe: 8,
            notes: 'Glute and adductor emphasis.',
          },
          {
            id: 'sh-d2-ex4',
            name: 'Seated Calf Raises',
            movementPattern: 'squat',
            muscleGroup: 'calves',
            sets: 4,
            reps: '15',
            restSeconds: 60,
            rpe: 8,
          },
          {
            id: 'sh-d2-ex5',
            name: 'Deadbug with Stability Ball',
            movementPattern: 'core',
            muscleGroup: 'core',
            sets: 3,
            reps: '12 / side',
            restSeconds: 45,
            notes: 'Lumbar-pelvic control and anti-extension bracing.',
          },
        ],
      },
      {
        dayNumber: 3,
        name: 'Day 3: Upper Pull (Scapulothoracic & Rotator Cuff)',
        focus: 'Back Thickness, Rear Delts & Scapular Retraction',
        exercises: [
          {
            id: 'sh-d3-ex1',
            name: 'Chest-Supported Neutral Grip Row',
            movementPattern: 'pull',
            muscleGroup: 'back',
            sets: 4,
            reps: '8-10',
            restSeconds: 90,
            rpe: 8,
            notes: 'Eliminates lower back strain, strict scapular squeeze.',
          },
          {
            id: 'sh-d3-ex2',
            name: 'Wide-Grip Cable Lat Pulldown (Neutral Grips)',
            movementPattern: 'pull',
            muscleGroup: 'lats',
            sets: 4,
            reps: '10-12',
            restSeconds: 75,
            rpe: 8,
            notes: 'Pull to collarbone, avoid rounding forward.',
          },
          {
            id: 'sh-d3-ex3',
            name: 'Face Pull with Rope (High Pulley)',
            movementPattern: 'pull',
            muscleGroup: 'rear_delts',
            sets: 4,
            reps: '15-20',
            restSeconds: 60,
            rpe: 8,
            notes: 'External rotation focus, thumbs pointing backward at finish.',
          },
          {
            id: 'sh-d3-ex4',
            name: 'Incline Dumbbell Rear Delt Flyes',
            movementPattern: 'pull',
            muscleGroup: 'rear_delts',
            sets: 3,
            reps: '15',
            restSeconds: 60,
            rpe: 8,
            notes: 'Thumbs facing downward/neutral, elbows soft.',
          },
          {
            id: 'sh-d3-ex5',
            name: 'Incline Dumbbell Biceps Curls',
            movementPattern: 'pull',
            muscleGroup: 'biceps',
            sets: 3,
            reps: '12',
            restSeconds: 60,
            rpe: 8,
          },
        ],
      },
      {
        dayNumber: 4,
        name: 'Day 4: Lower & Core (Unilateral Stability & Hamstrings)',
        focus: 'Balance, Calves & Trunk Integrity',
        exercises: [
          {
            id: 'sh-d4-ex1',
            name: 'Dumbbell Walking Lunges',
            movementPattern: 'lunge',
            muscleGroup: 'quads',
            sets: 3,
            reps: '10 steps / leg',
            restSeconds: 75,
            rpe: 8,
            notes: 'Controlled knee tracking over second toe.',
          },
          {
            id: 'sh-d4-ex2',
            name: 'Lying Leg Curl',
            movementPattern: 'hinge',
            muscleGroup: 'hamstrings',
            sets: 4,
            reps: '10-12',
            restSeconds: 75,
            rpe: 8,
            notes: 'Point toes forward, 2-second eccentric lower.',
          },
          {
            id: 'sh-d4-ex3',
            name: 'Dumbbell Step-Ups onto 18-inch Box',
            movementPattern: 'lunge',
            muscleGroup: 'glutes',
            sets: 3,
            reps: '10 / side',
            restSeconds: 60,
            rpe: 7,
            notes: 'Drive through front foot, glute focus.',
          },
          {
            id: 'sh-d4-ex4',
            name: 'Standing Dumbbell Calf Raises',
            movementPattern: 'squat',
            muscleGroup: 'calves',
            sets: 4,
            reps: '12-15',
            restSeconds: 60,
            rpe: 8,
          },
          {
            id: 'sh-d4-ex5',
            name: 'Suitcase Carry with Dumbbell',
            movementPattern: 'carry',
            muscleGroup: 'core',
            sets: 3,
            reps: '40m / side',
            restSeconds: 60,
            notes: 'Resist lateral flexion, strict upright posture.',
          },
        ],
      },
    ],
  },
];

export function getVerifiedExplorePlans(): ExplorePlanDto[] {
  return VERIFIED_EXPLORE_TEMPLATES.map((tpl) => {
    const firstEx = tpl.days[0]?.exercises[0];
    return {
      ...tpl,
      primaryExercise: firstEx
        ? {
            name: firstEx.name,
            masterExerciseId: firstEx.masterExerciseId || firstEx.id,
            movementPattern: firstEx.movementPattern,
            muscleGroup: firstEx.muscleGroup,
          }
        : undefined,
    };
  });
}

export function findExplorePlanById(id: string): ExplorePlanDto | undefined {
  const match = VERIFIED_EXPLORE_TEMPLATES.find((tpl) => tpl.id === id);
  if (!match) return undefined;
  const firstEx = match.days[0]?.exercises[0];
  return {
    ...match,
    primaryExercise: firstEx
      ? {
          name: firstEx.name,
          masterExerciseId: firstEx.masterExerciseId || firstEx.id,
          movementPattern: firstEx.movementPattern,
          muscleGroup: firstEx.muscleGroup,
        }
      : undefined,
  };
}
