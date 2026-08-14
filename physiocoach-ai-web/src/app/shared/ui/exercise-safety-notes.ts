export interface ExerciseSafetyNotes {
  tips: string[];
}

const FALLBACK_SAFETY_NOTES: ExerciseSafetyNotes = {
  tips: ['Use a weight you can control from start to finish.'],
};

interface SafetyNoteDefinition {
  aliases: string[];
  tips: string[];
}

// Canonical clinical / biomechanical cue dictionary.
// Keys are normalized exercise names (lowercase, single spaces, no punctuation).
// Every alias resolves to the same high-impact cue set, so "DB RDL",
// "pull-up", and "Bent-Over Row" all hit the right entry.
const SAFETY_NOTE_DEFINITIONS: SafetyNoteDefinition[] = [
  // ── Squat patterns ─────────────────────────────────────────
  {
    aliases: ['squat', 'back squat', 'barbell squat', 'barbell back squat'],
    tips: [
      'Brace your core and keep a neutral spine from start to finish.',
      'Knees track over toes; sit to full depth without lumbar flexion.',
      'Drive through mid-foot with a controlled 2–3s descent.',
    ],
  },
  {
    aliases: ['front squat', 'barbell front squat'],
    tips: [
      'Keep elbows high and torso upright; bar rests across the front delts.',
      'Knees push out over toes; keep heels planted through the rep.',
      'Descend with control while holding a neutral spine.',
    ],
  },
  {
    aliases: ['goblet squat'],
    tips: ['Keep torso upright and knees tracking over toes.', 'Move with control through full range of motion.'],
  },

  // ── Horizontal pressing ────────────────────────────────────
  {
    aliases: ['bench press', 'barbell bench press', 'flat bench press'],
    tips: [
      'Retract and depress your scapulae; keep a slight arch with feet planted.',
      'Lower to mid-chest with elbows around 45–70° — no shoulder flare.',
      'Control the eccentric and press without shoulders rolling forward.',
    ],
  },
  {
    aliases: ['dumbbell press', 'db press', 'dumbbell bench press', 'db bench press'],
    tips: [
      'Keep scapulae retracted and ribs stacked; elbows around 45°.',
      'Lower dumbbells with control to chest level — no shrug.',
      'Press to lockout with wrists stacked over elbows.',
    ],
  },

  // ── Hinge patterns ─────────────────────────────────────────
  {
    aliases: ['deadlift', 'conventional deadlift', 'barbell deadlift'],
    tips: [
      'Brace hard and keep a neutral spine from setup to lockout.',
      'Push the floor away and keep the bar close to your shins.',
      'Hinge at the hips; never round the lower back.',
    ],
  },
  {
    aliases: ['romanian deadlift', 'db rdl', 'rdl', 'dumbbell rdl', 'dumbbell romanian deadlift'],
    tips: ['Hinge at hips, not lower back.', 'Use a neutral spine through the whole rep.'],
  },

  // ── Vertical pressing ──────────────────────────────────────
  {
    aliases: [
      'overhead press',
      'ohp',
      'shoulder press',
      'strict press',
      'military press',
      'barbell overhead press',
      'dumbbell shoulder press',
      'db shoulder press',
    ],
    tips: [
      'Brace glutes and core; keep ribs down and lumbar spine neutral.',
      'Press the bar straight overhead without excessive arch.',
      'Keep wrists stacked over elbows; avoid shrugging at lockout.',
    ],
  },

  // ── Horizontal / vertical pulling ──────────────────────────
  {
    aliases: ['barbell row', 'bent over row', 'barbell bent over row', 'bent over barbell row'],
    tips: [
      'Hinge at the hips with a neutral spine; pull the bar to your lower ribs.',
      'Retract your scapulae and pause at the top contraction.',
      'Avoid momentum or jerking your torso.',
    ],
  },
  {
    aliases: ['chest supported row', 'chest support row', 'chest supported dumbbell row', 'chest supported db row'],
    tips: ['Keep chest supported on the bench.', 'Pause briefly at top contraction.'],
  },
  {
    aliases: ['lat pulldown', 'lat pull down', 'lateral pulldown'],
    tips: ['Keep shoulders depressed and avoid shrugging.', 'Pull toward ribs, not behind the neck.'],
  },
  {
    aliases: ['pull up', 'pull ups', 'pullup', 'pullups', 'chin up', 'chinup', 'assisted pull up'],
    tips: [
      'Start from a dead hang with scapulae depressed.',
      'Drive elbows down; avoid kipping or shrugging.',
      'Lower under control back to a full hang.',
    ],
  },

  // ── Single-leg / lunge patterns ────────────────────────────
  {
    aliases: [
      'split squat',
      'bulgarian split squat',
      'dumbbell split squat',
      'lunge',
      'walking lunge',
      'reverse lunge',
      'forward lunge',
      'dumbbell lunge',
      'db lunge',
    ],
    tips: [
      'Keep torso upright; front knee tracks over toes.',
      'Descend with control; back knee lowers toward the floor.',
      'Maintain a neutral spine and level hips throughout.',
    ],
  },

  // ── Glute / hip-dominant ───────────────────────────────────
  {
    aliases: ['hip thrust', 'barbell hip thrust'],
    tips: ['Keep core braced and avoid overarch at top.'],
  },

  // ── Bodyweight / machine pressing ──────────────────────────
  {
    aliases: ['dip', 'dips', 'tricep dip', 'parallel bar dip', 'chest dip', 'weighted dip'],
    tips: [
      'Lean slightly forward; keep shoulders down and back.',
      'Lower to about 90° elbow bend — no deeper — to protect the shoulder.',
      'Press up with control; avoid a harsh lockout.',
    ],
  },
  {
    aliases: ['leg press', 'machine leg press', 'sled leg press'],
    tips: [
      'Keep your lower back pressed into the pad — no tailbone lift.',
      'Lower to about 90° knee bend without buttock lift.',
      'Control the descent and avoid full knee lockout at the top.',
    ],
  },
];

const EXERCISE_SAFETY_NOTES: Record<string, ExerciseSafetyNotes> = {};

for (const definition of SAFETY_NOTE_DEFINITIONS) {
  const notes: ExerciseSafetyNotes = { tips: definition.tips };
  for (const alias of definition.aliases) {
    EXERCISE_SAFETY_NOTES[alias] = notes;
  }
}

const normalizeExerciseName = (value: string): string =>
  (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

export const resolveExerciseSafetyNotes = (name: string): ExerciseSafetyNotes => {
  const normalizedName = normalizeExerciseName(name);

  return Object.prototype.hasOwnProperty.call(EXERCISE_SAFETY_NOTES, normalizedName)
    ? EXERCISE_SAFETY_NOTES[normalizedName]
    : FALLBACK_SAFETY_NOTES;
};
