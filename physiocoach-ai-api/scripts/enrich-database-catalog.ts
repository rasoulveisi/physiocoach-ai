import { eq } from 'drizzle-orm';
import { createDb } from '../src/db/client';
import {
  masterExercises,
  exerciseMedia,
  exerciseEquipment,
  exerciseMuscles,
  masterEquipment,
  masterMuscles,
} from '../src/db/schema';

const CANONICAL_MUSCLES: Record<string, { name: string; bodyRegion: 'anterior' | 'posterior' }> = {
  quadriceps: { name: 'Quadriceps', bodyRegion: 'anterior' },
  hamstrings: { name: 'Hamstrings', bodyRegion: 'posterior' },
  glutes: { name: 'Glutes', bodyRegion: 'posterior' },
  pectorals: { name: 'Pectorals', bodyRegion: 'anterior' },
  deltoids: { name: 'Deltoids', bodyRegion: 'anterior' },
  lats: { name: 'Latissimus Dorsi', bodyRegion: 'posterior' },
  traps: { name: 'Trapezius', bodyRegion: 'posterior' },
  biceps: { name: 'Biceps', bodyRegion: 'anterior' },
  triceps: { name: 'Triceps', bodyRegion: 'posterior' },
  abs: { name: 'Abdominals', bodyRegion: 'anterior' },
  'lower_back': { name: 'Lower Back', bodyRegion: 'posterior' },
  calves: { name: 'Calves', bodyRegion: 'posterior' },
};

const CANONICAL_EQUIPMENT: Record<string, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  band: 'Resistance Band',
  kettlebell: 'Kettlebell',
  bench: 'Bench',
  pull_up_bar: 'Pull-up Bar',
};

interface ClassifiedExercise {
  primaryMuscle: string;
  target: string;
  bodyPart: string;
  movementPattern: string;
  secondaryMuscles: string[];
  equipment: string[];
  recommendedLevel: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  attributesJson: Record<string, unknown>;
  excludedLimitations: string[];
}

export function classifyExercise(name: string, rawInstructions?: string | null): ClassifiedExercise {
  const norm = name.toLowerCase().trim();

  // 1. Determine Equipment
  const eqList: string[] = [];
  if (norm.includes('barbell') || norm.includes('olympic') || norm.includes('clean and jerk') || norm.includes('snatch')) {
    eqList.push('barbell');
  }
  if (norm.includes('dumbbell') || norm.includes('db ') || norm.endsWith(' db')) {
    eqList.push('dumbbell');
  }
  if (norm.includes('cable') || norm.includes('pulldown') || norm.includes('pushdown') || norm.includes('crossover')) {
    eqList.push('cable');
  }
  if (norm.includes('machine') || norm.includes('smith') || norm.includes('hack squat') || norm.includes('leg press') || norm.includes('chest press machine') || norm.includes('lever') || norm.includes('assisted')) {
    eqList.push('machine');
  }
  if (norm.includes('band') || norm.includes('loop')) {
    eqList.push('band');
  }
  if (norm.includes('kettlebell') || norm.includes('kb ')) {
    eqList.push('kettlebell');
  }
  if (norm.includes('pull up') || norm.includes('pull-up') || norm.includes('chin up') || norm.includes('chin-up') || norm.includes('hanging')) {
    eqList.push('pull_up_bar');
  }
  if (norm.includes('bench')) {
    eqList.push('bench');
  }
  if (eqList.length === 0) {
    eqList.push('bodyweight');
  }

  // 2. Determine Primary Muscle, Body Part, Pattern, Secondary Muscles
  let primaryMuscle = 'abs';
  let bodyPart = 'waist';
  let movementPattern = 'core';
  let secondaryMuscles: string[] = [];

  // Chest / Pectorals
  if (
    norm.includes('bench press') ||
    norm.includes('chest') ||
    norm.includes('push up') ||
    norm.includes('push-up') ||
    norm.includes('pushup') ||
    norm.includes('pec') ||
    norm.includes('fly') ||
    norm.includes('flye') ||
    norm.includes('dip') ||
    norm.includes('crossover')
  ) {
    primaryMuscle = 'pectorals';
    bodyPart = 'chest';
    movementPattern = norm.includes('dip') || norm.includes('fly') ? 'isolation' : 'horizontal_push';
    secondaryMuscles = ['deltoids', 'triceps'];
  }
  // Shoulders / Deltoids
  else if (
    norm.includes('overhead press') ||
    norm.includes('shoulder press') ||
    norm.includes('military press') ||
    norm.includes('lateral raise') ||
    norm.includes('front raise') ||
    norm.includes('rear delt') ||
    norm.includes('delt') ||
    norm.includes('shoulder') ||
    norm.includes('arnold press') ||
    norm.includes('upright row')
  ) {
    primaryMuscle = 'deltoids';
    bodyPart = 'shoulders';
    movementPattern = norm.includes('raise') ? 'isolation' : 'vertical_push';
    secondaryMuscles = ['triceps', 'traps'];
  }
  // Upper Back / Lats
  else if (
    norm.includes('pull up') ||
    norm.includes('pull-up') ||
    norm.includes('chin up') ||
    norm.includes('chin-up') ||
    norm.includes('pulldown') ||
    norm.includes('lat')
  ) {
    primaryMuscle = 'lats';
    bodyPart = 'back';
    movementPattern = 'vertical_pull';
    secondaryMuscles = ['biceps', 'traps'];
  }
  // Back / Traps / Mid Back Rows
  else if (
    norm.includes('row') ||
    norm.includes('shrug') ||
    norm.includes('face pull') ||
    norm.includes('back')
  ) {
    primaryMuscle = norm.includes('shrug') ? 'traps' : 'lats';
    bodyPart = 'back';
    movementPattern = norm.includes('shrug') || norm.includes('face pull') ? 'isolation' : 'horizontal_pull';
    secondaryMuscles = ['biceps', 'deltoids', 'traps'];
  }
  // Arms: Biceps
  else if (
    norm.includes('bicep') ||
    norm.includes('biceps') ||
    norm.includes('curl') ||
    norm.includes('preacher')
  ) {
    primaryMuscle = 'biceps';
    bodyPart = 'upper_arms';
    movementPattern = 'isolation';
    secondaryMuscles = ['deltoids'];
  }
  // Arms: Triceps
  else if (
    norm.includes('tricep') ||
    norm.includes('triceps') ||
    norm.includes('pushdown') ||
    norm.includes('skull crusher') ||
    norm.includes('kickback') ||
    norm.includes('close grip bench') ||
    norm.includes('french press')
  ) {
    primaryMuscle = 'triceps';
    bodyPart = 'upper_arms';
    movementPattern = 'isolation';
    secondaryMuscles = ['deltoids', 'pectorals'];
  }
  // Lower Body: Quads
  else if (
    norm.includes('squat') ||
    norm.includes('leg press') ||
    norm.includes('leg extension') ||
    norm.includes('step up') ||
    norm.includes('step-up') ||
    norm.includes('hack') ||
    norm.includes('sissy') ||
    norm.includes('quad')
  ) {
    primaryMuscle = 'quadriceps';
    bodyPart = 'upper_legs';
    movementPattern = 'squat';
    secondaryMuscles = ['glutes', 'calves', 'hamstrings'];
  }
  // Lower Body: Lunges & Unilateral
  else if (
    norm.includes('lunge') ||
    norm.includes('split squat') ||
    norm.includes('bulgarian')
  ) {
    primaryMuscle = 'quadriceps';
    bodyPart = 'upper_legs';
    movementPattern = 'lunge';
    secondaryMuscles = ['glutes', 'hamstrings', 'calves'];
  }
  // Lower Body: Hamstrings / Posterior Hinge
  else if (
    norm.includes('deadlift') ||
    norm.includes('rdl') ||
    norm.includes('romanian') ||
    norm.includes('hamstring') ||
    norm.includes('leg curl') ||
    norm.includes('good morning') ||
    norm.includes('hyperextension')
  ) {
    primaryMuscle = 'hamstrings';
    bodyPart = 'upper_legs';
    movementPattern = norm.includes('leg curl') ? 'isolation' : 'hinge';
    secondaryMuscles = ['glutes', 'lower_back'];
  }
  // Lower Body: Glutes & Hips
  else if (
    norm.includes('hip thrust') ||
    norm.includes('glute') ||
    norm.includes('bridge') ||
    norm.includes('kickback') ||
    norm.includes('abduction') ||
    norm.includes('hip extension')
  ) {
    primaryMuscle = 'glutes';
    bodyPart = 'upper_legs';
    movementPattern = norm.includes('thrust') || norm.includes('bridge') ? 'hinge' : 'isolation';
    secondaryMuscles = ['hamstrings', 'quadriceps'];
  }
  // Calves
  else if (
    norm.includes('calf') ||
    norm.includes('calves') ||
    norm.includes('gastrocnemius') ||
    norm.includes('soleus') ||
    norm.includes('heel raise')
  ) {
    primaryMuscle = 'calves';
    bodyPart = 'lower_legs';
    movementPattern = 'isolation';
    secondaryMuscles = [];
  }
  // Lower Back
  else if (
    norm.includes('lower back') ||
    norm.includes('erector') ||
    norm.includes('superman')
  ) {
    primaryMuscle = 'lower_back';
    bodyPart = 'back';
    movementPattern = 'hinge';
    secondaryMuscles = ['glutes', 'hamstrings'];
  }
  // Core & Abs
  else if (
    norm.includes('crunch') ||
    norm.includes('sit-up') ||
    norm.includes('sit up') ||
    norm.includes('plank') ||
    norm.includes('ab ') ||
    norm.includes('abs') ||
    norm.includes('v-up') ||
    norm.includes('twist') ||
    norm.includes('leg raise') ||
    norm.includes('wheel') ||
    norm.includes('rollerout') ||
    norm.includes('hollow') ||
    norm.includes('side bend') ||
    norm.includes('wind sprints') ||
    norm.includes('air bike')
  ) {
    primaryMuscle = 'abs';
    bodyPart = 'waist';
    movementPattern = 'core';
    secondaryMuscles = ['lower_back'];
  }
  // Mobility / Stretches
  else if (norm.includes('stretch') || norm.includes('mobility') || norm.includes('circles') || norm.includes('slingers')) {
    movementPattern = 'mobility';
    if (norm.includes('quad')) {
      primaryMuscle = 'quadriceps';
      bodyPart = 'upper_legs';
    } else if (norm.includes('hamstring')) {
      primaryMuscle = 'hamstrings';
      bodyPart = 'upper_legs';
    } else if (norm.includes('pec') || norm.includes('chest')) {
      primaryMuscle = 'pectorals';
      bodyPart = 'chest';
    } else if (norm.includes('glute')) {
      primaryMuscle = 'glutes';
      bodyPart = 'upper_legs';
    } else if (norm.includes('ankle') || norm.includes('calf')) {
      primaryMuscle = 'calves';
      bodyPart = 'lower_legs';
    } else {
      primaryMuscle = 'abs';
      bodyPart = 'waist';
    }
  }

  // 3. Determine Recommended Experience Level
  let recommendedLevel: 'beginner' | 'intermediate' | 'advanced';

  // Advanced criteria
  if (
    norm.includes('snatch') ||
    norm.includes('clean and jerk') ||
    norm.includes('clean & jerk') ||
    norm.includes('muscle up') ||
    norm.includes('muscle-up') ||
    norm.includes('pistol squat') ||
    norm.includes('deficit deadlift') ||
    norm.includes('overhead squat') ||
    norm.includes('dragon flag') ||
    norm.includes('back lever') ||
    norm.includes('front lever') ||
    norm.includes('archer') ||
    norm.includes('depth jump') ||
    norm.includes('box jump 3')
  ) {
    recommendedLevel = 'advanced';
  }
  // Intermediate criteria
  else if (
    (eqList.includes('barbell') && !norm.includes('curl') && !norm.includes('shrug')) ||
    norm.includes('pull up') ||
    norm.includes('pull-up') ||
    norm.includes('chin up') ||
    norm.includes('chin-up') ||
    norm.includes('dip') ||
    norm.includes('bulgarian') ||
    norm.includes('romanian deadlift') ||
    norm.includes('rdl') ||
    norm.includes('dumbbell bench press') ||
    norm.includes('overhead press') ||
    norm.includes('hanging leg raise')
  ) {
    recommendedLevel = 'intermediate';
  }
  // Beginner criteria (machines, bands, basic bodyweight, isolations)
  else {
    recommendedLevel = 'beginner';
  }

  // 4. Generate Clean 3-Step Execution Instructions
  let instructions: string[];
  if (rawInstructions && rawInstructions.length > 30) {
    const rawParts = rawInstructions
      .split(/\r?\n+|\.\s+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 5);
    if (rawParts.length >= 3) {
      instructions = [
        `1. Setup: ${rawParts[0]}`,
        `2. Execution: ${rawParts[1]}`,
        `3. Control & Return: ${rawParts.slice(2).join('. ')}`,
      ];
    } else {
      instructions = [
        `1. Setup: Position yourself with stable posture and engage your core before starting the movement.`,
        `2. Execution: Perform ${name} through a controlled, full range of motion while maintaining proper joint alignment.`,
        `3. Control & Return: Return slowly to the starting position with continuous muscle tension.`,
      ];
    }
  } else {
    instructions = [
      `1. Setup: Position yourself with stable posture and engage your core before starting the movement.`,
      `2. Execution: Perform ${name} through a controlled, full range of motion while maintaining proper joint alignment.`,
      `3. Control & Return: Return slowly to the starting position with continuous muscle tension.`,
    ];
  }

  // 5. Build attributes JSON & Safety ratings
  const attributesJson: Record<string, unknown> = {
    movementPattern,
    bodyRegion: bodyPart,
    primaryMuscles: [primaryMuscle],
    secondaryMuscles,
    equipmentRequired: eqList,
    technicalComplexity: recommendedLevel,
    spinalLoad: (norm.includes('squat') || norm.includes('deadlift')) && eqList.includes('barbell') ? 'high' : 'low',
    impactLevel: norm.includes('jump') || norm.includes('sprint') ? 'high' : 'low',
  };

  const excludedLimitations: string[] = [];
  if (attributesJson.spinalLoad === 'high') {
    excludedLimitations.push('lower_back_pain');
  }
  if (norm.includes('deep squat') || norm.includes('sissy squat')) {
    excludedLimitations.push('knee_pain');
  }
  if (norm.includes('behind neck') || norm.includes('upright row')) {
    excludedLimitations.push('shoulder_pain');
  }

  return {
    primaryMuscle,
    target: primaryMuscle,
    bodyPart,
    movementPattern,
    secondaryMuscles,
    equipment: eqList,
    recommendedLevel,
    instructions,
    attributesJson,
    excludedLimitations,
  };
}

export async function runDatabaseEnrichment() {
  console.log('🚀 Connecting to Neon PostgreSQL...');
  const db = createDb();

  // 1. Fetch all master exercises
  const exercises = await db.select().from(masterExercises);
  console.log(`📋 Found ${exercises.length} master exercises to classify and optimize.`);

  if (exercises.length === 0) {
    console.log('⚠️ No exercises found in database.');
    return;
  }

  // 2. Ensure Master Equipment rows exist
  console.log('📦 Upserting master equipment records...');
  for (const [slug, name] of Object.entries(CANONICAL_EQUIPMENT)) {
    await db
      .insert(masterEquipment)
      .values({
        id: `eq_${slug}`,
        canonicalId: `eq_${slug}`,
        name,
        nameLocalized: name,
        source: 'physiocoach_canonical',
        sourceId: slug,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
  }

  // 3. Ensure Master Muscles rows exist
  console.log('💪 Upserting master muscles records...');
  for (const [slug, meta] of Object.entries(CANONICAL_MUSCLES)) {
    await db
      .insert(masterMuscles)
      .values({
        id: `mus_${slug}`,
        canonicalId: `mus_${slug}`,
        name: meta.name,
        nameLocalized: meta.name,
        source: 'physiocoach_canonical',
        sourceId: slug,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();
  }

  // 4. Iterate and enrich each exercise in-place
  let updatedCount = 0;
  let mediaLinkedCount = 0;

  console.log('⚡ Processing in-place exercise classifications & media links...');
  const CHUNK_SIZE = 20;
  for (let i = 0; i < exercises.length; i += CHUNK_SIZE) {
    const chunk = exercises.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (exercise) => {
        const classification = classifyExercise(exercise.name, exercise.instructions);

        // Extract 4-digit index for image mapping (e.g. "ex_catalog_..._0001" -> "0001")
        const match = exercise.id.match(/(\d{4})$/);
        const catalogCode = match ? match[1] : null;

        // A. Update master_exercises row in-place (ID strictly unchanged!)
        await db
          .update(masterExercises)
          .set({
            bodyPart: classification.bodyPart,
            primaryMuscle: classification.primaryMuscle,
            target: classification.target,
            movementPattern: classification.movementPattern,
            secondaryMusclesJson: JSON.stringify(classification.secondaryMuscles),
            recommendedLevel: classification.recommendedLevel,
            instructionsJson: JSON.stringify(classification.instructions),
            attributesJson: JSON.stringify(classification.attributesJson),
            excludedLimitationsJson: JSON.stringify(classification.excludedLimitations),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(masterExercises.id, exercise.id));

        // B. Link Media if 4-digit code found
        if (catalogCode) {
          const mediaId = `media_${exercise.id}`;
          const storageUrl = `/images/exercises/catalog/${catalogCode}.webp`;

          await db
            .insert(exerciseMedia)
            .values({
              id: mediaId,
              exerciseId: exercise.id,
              storageUrl,
              mediaType: 'image/webp',
              widthPx: 720,
              heightPx: 720,
              altText: `${exercise.name} execution visual`,
              storageProvider: 'local_assets',
              ownershipStatus: 'licensed',
              reviewStatus: 'approved',
              source: 'physiocoach_catalog',
              sourceId: catalogCode,
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .onConflictDoUpdate({
              target: exerciseMedia.id,
              set: {
                storageUrl,
                reviewStatus: 'approved',
                updatedAt: new Date().toISOString(),
              },
            });

          mediaLinkedCount++;
        }

        // C. Link Equipment junction
        for (const eqSlug of classification.equipment) {
          await db
            .insert(exerciseEquipment)
            .values({
              exerciseId: exercise.id,
              equipmentId: `eq_${eqSlug}`,
            })
            .onConflictDoNothing();
        }

        // D. Link Muscle junction
        await db
          .insert(exerciseMuscles)
          .values({
            exerciseId: exercise.id,
            muscleId: `mus_${classification.primaryMuscle}`,
            isPrimary: true,
          })
          .onConflictDoNothing();

        updatedCount++;
      }),
    );

    console.log(`  ✓ Enriched ${Math.min(i + CHUNK_SIZE, exercises.length)}/${exercises.length} exercises (Media: ${mediaLinkedCount})`);
  }

  console.log(`\n🎉 Successfully completed database enrichment!`);
  console.log(`📊 Summary:`);
  console.log(`  - Total Exercises Enriched: ${updatedCount}`);
  console.log(`  - Media Records Linked: ${mediaLinkedCount}`);
  console.log(`  - Exercise IDs Modified: 0 (100% Immutable)`);
}

// Run directly if invoked via CLI
runDatabaseEnrichment()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Enrichment failed:', err);
    process.exit(1);
  });
