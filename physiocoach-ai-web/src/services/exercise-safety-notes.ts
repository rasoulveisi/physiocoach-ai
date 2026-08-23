export interface ExerciseSafetyNotes {
  tips: string[];
}

const FALLBACK_SAFETY_NOTES: ExerciseSafetyNotes = {
  tips: ['Use a weight you can control from start to finish with full range of motion.'],
};

interface SafetyNoteDefinition {
  aliases: string[];
  tips: string[];
}

// Canonical clinical / biomechanical cue dictionary
const SAFETY_NOTE_DEFINITIONS: SafetyNoteDefinition[] = [
  // Squat patterns
  {
    aliases: ['squat', 'back squat', 'barbell squat', 'barbell back squat'],
    tips: [
      'Brace your core and maintain a neutral spine throughout the lift.',
      'Knees track over toes; sit into the hips without lumbar flexion.',
      'Drive through mid-foot with a controlled 2–3s descent.',
    ],
  },
  {
    aliases: ['front squat', 'barbell front squat'],
    tips: [
      'Keep elbows high and torso upright; bar rests across front deltoids.',
      'Knees push out over toes; keep heels firmly planted.',
      'Descend with control while holding strict thoracic extension.',
    ],
  },
  {
    aliases: ['goblet squat'],
    tips: [
      'Keep dumbbell tight to chest with torso upright.',
      'Knees track over toes; move with control through full depth.',
    ],
  },

  // Horizontal pressing
  {
    aliases: ['bench press', 'barbell bench press', 'flat bench press'],
    tips: [
      'Retract and depress scapulae; keep slight arch with feet planted.',
      'Lower to mid-chest with elbows at 45–70° — avoid shoulder flare.',
      'Control eccentric descent and press without shoulders rolling forward.',
    ],
  },
  {
    aliases: ['dumbbell press', 'db press', 'dumbbell bench press', 'db bench press'],
    tips: [
      'Keep scapulae retracted and ribs stacked; elbows angled at ~45°.',
      'Lower dumbbells under control to chest level — no shoulder shrugging.',
      'Press to lockout with wrists vertically stacked over elbows.',
    ],
  },
  {
    aliases: ['incline dumbbell press', 'incline bench press', 'incline db press'],
    tips: [
      'Set bench to 30–45°; maintain retracted scapular position.',
      'Lower to upper chest line with controlled cadence.',
    ],
  },

  // Hinge patterns
  {
    aliases: ['deadlift', 'conventional deadlift', 'barbell deadlift'],
    tips: [
      'Brace hard, pack lats, and maintain a neutral spine from setup to lockout.',
      'Push the floor away through mid-foot; keep bar tight to shins.',
      'Hinge through hips; never allow lower back rounding under load.',
    ],
  },
  {
    aliases: ['romanian deadlift', 'db rdl', 'rdl', 'dumbbell rdl', 'dumbbell romanian deadlift', 'barbell rdl'],
    tips: [
      'Push hips back horizontally with soft knees; hinge at hips, not spine.',
      'Maintain neutral neck and spine; stop when hamstrings reach full stretch.',
    ],
  },

  // Vertical pressing
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
      'Brace glutes and core; keep ribs locked down and spine neutral.',
      'Press bar straight overhead without excessive lumbar hyperextension.',
      'Keep wrists stacked over elbows; lock out under full control.',
    ],
  },

  // Horizontal & vertical pulling
  {
    aliases: ['barbell row', 'bent over row', 'barbell bent over row', 'bent over barbell row'],
    tips: [
      'Hinge at hips to ~45° with neutral spine; pull bar to lower ribs.',
      'Retract scapulae and squeeze back at peak contraction.',
      'Avoid momentum or jerking the torso upward.',
    ],
  },
  {
    aliases: ['chest supported row', 'chest support row', 'chest supported dumbbell row', 'chest supported db row'],
    tips: [
      'Keep sternum supported against pad; avoid neck strain.',
      'Drive elbows back and pause briefly at top contraction.',
    ],
  },
  {
    aliases: ['lat pulldown', 'lat pull down', 'lateral pulldown'],
    tips: [
      'Depress shoulders before pulling; pull bar toward upper chest.',
      'Avoid leaning excessively backward or using momentum.',
    ],
  },
  {
    aliases: ['pull up', 'pull ups', 'pullup', 'pullups', 'chin up', 'chinup', 'assisted pull up'],
    tips: [
      'Initiate pull by depressing shoulder blades from full hang.',
      'Drive elbows down toward hips; avoid swinging or kipping.',
      'Lower under control to a safe, controlled dead hang.',
    ],
  },

  // Single-leg & lunge patterns
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
      'Keep torso upright and pelvis square; front knee tracks over 2nd toe.',
      'Descend under control until back knee hovers just above the floor.',
      'Drive through front heel and mid-foot to return to start.',
    ],
  },

  // Glute / hip-dominant
  {
    aliases: ['hip thrust', 'barbell hip thrust'],
    tips: [
      'Position upper back across bench; keep chin tucked and ribs down.',
      'Drive through heels to full hip extension; avoid hyperextending lumbar spine.',
    ],
  },

  // Bodyweight / machine pressing
  {
    aliases: ['dip', 'dips', 'tricep dip', 'parallel bar dip', 'chest dip', 'weighted dip'],
    tips: [
      'Lean slightly forward; pack shoulders down and back.',
      'Lower to approximately 90° elbow flexion to protect anterior capsule.',
      'Press up smoothly without harsh lockout.',
    ],
  },
  {
    aliases: ['leg press', 'machine leg press', 'sled leg press'],
    tips: [
      'Keep lower back and sacrum firmly pressed into pad — avoid pelvic tilt.',
      'Lower to ~90° knee bend without buttocks lifting.',
      'Do not violently lock out knees at top.',
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

  if (Object.prototype.hasOwnProperty.call(EXERCISE_SAFETY_NOTES, normalizedName)) {
    return EXERCISE_SAFETY_NOTES[normalizedName];
  }

  // Substring alias matching
  for (const [key, notes] of Object.entries(EXERCISE_SAFETY_NOTES)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return notes;
    }
  }

  return FALLBACK_SAFETY_NOTES;
};
