export type SetType = 'working' | 'warmup' | 'drop' | 'failure';

export interface ParsedImportSet {
  setIndex: number;
  setType: SetType;
  weightKg: number;
  reps: number;
  rpe?: number | null;
  notes?: string | null;
}

export interface ParsedImportExercise {
  name: string;
  sets: ParsedImportSet[];
}

export interface ParsedImportWorkout {
  title: string;
  date: string;
  notes?: string | null;
  exercises: ParsedImportExercise[];
}

export interface CatalogExerciseItem {
  id: string;
  name: string;
  movementPattern?: string;
  primaryMuscle?: string | null;
}

export interface ParseResult {
  sourceType: 'hevy' | 'strong' | 'lyfta' | 'csv' | 'json';
  workouts: ParsedImportWorkout[];
  uniqueExercises: string[];
}

/**
 * Universal workout parser for CSV (Hevy, Strong, generic) and JSON (Lyfta)
 */
export function parseWorkoutFile(fileContent: string, fileName: string): ParseResult {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.json') || fileContent.trim().startsWith('{')) {
    return parseWorkoutJson(fileContent);
  }

  return parseWorkoutCsv(fileContent);
}

function parseWorkoutJson(jsonText: string): ParseResult {
  const data = JSON.parse(jsonText);
  const rawWorkouts = Array.isArray(data) ? data : data.workouts || data.sessions || [];

  const workouts: ParsedImportWorkout[] = [];

  for (const raw of rawWorkouts) {
    const title = raw.title || raw.name || raw.workout_name || 'Imported Workout';
    const date =
      raw.workout_perform_date || raw.performedAt || raw.date || new Date().toISOString();
    const rawExercises = raw.exercises || raw.exercise_list || [];

    const exercises: ParsedImportExercise[] = [];

    for (const rawEx of rawExercises) {
      const name = rawEx.excercise_name || rawEx.exercise_name || rawEx.name || 'Exercise';
      const rawSets = rawEx.sets || [];
      const sets: ParsedImportSet[] = [];

      for (let i = 0; i < rawSets.length; i++) {
        const s = rawSets[i];
        let setType: SetType = 'working';
        const typeId = String(s.set_type_id ?? s.setType ?? s.type ?? '').toLowerCase();

        if (typeId === '1' || typeId.includes('warm')) {
          setType = 'warmup';
        } else if (typeId === '4' || typeId.includes('fail')) {
          setType = 'failure';
        } else if (typeId === '5' || typeId.includes('drop')) {
          setType = 'drop';
        }

        sets.push({
          setIndex: s.setIndex || i + 1,
          setType,
          weightKg: parseFloat(s.weight ?? s.weight_kg ?? 0) || 0,
          reps: parseInt(s.reps ?? 0, 10) || 0,
          rpe: s.rir !== undefined ? 10 - Number(s.rir) : s.rpe ? Number(s.rpe) : undefined,
          notes: s.notes || undefined,
        });
      }

      if (sets.length > 0) {
        exercises.push({ name, sets });
      }
    }

    if (exercises.length > 0) {
      workouts.push({ title, date, notes: raw.notes, exercises });
    }
  }

  const uniqueExercises = Array.from(
    new Set(workouts.flatMap((w) => w.exercises.map((e) => e.name))),
  );

  return {
    sourceType: 'lyfta',
    workouts,
    uniqueExercises,
  };
}

function parseWorkoutCsv(csvText: string): ParseResult {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV file contains no data rows.');
  }

  // Parse header
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/["']/g, '').trim());

  const dateIdx = header.findIndex((h) => h.includes('date'));
  const titleIdx = header.findIndex((h) => h.includes('workout') || h.includes('title') || h.includes('routine'));
  const nameIdx = header.findIndex((h) => h.includes('exercise') || h.includes('name'));
  const weightIdx = header.findIndex((h) => h.includes('weight') || h.includes('kg') || h.includes('lbs'));
  const repsIdx = header.findIndex((h) => h.includes('rep'));
  const typeIdx = header.findIndex((h) => h.includes('type') || h.includes('tag'));
  const rpeIdx = header.findIndex((h) => h.includes('rpe') || h.includes('rir'));
  const notesIdx = header.findIndex((h) => h.includes('note') || h.includes('comment'));

  if (nameIdx === -1) {
    throw new Error('Could not find Exercise Name column in CSV header.');
  }

  let isHevy = header.some((h) => h.includes('exercise title') || h.includes('set order'));
  let isStrong = header.some((h) => h.includes('workout notes') || (header.includes('workout name') && header.includes('duration')));

  const workoutMap = new Map<string, ParsedImportWorkout>();

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    const exerciseName = row[nameIdx]?.trim();
    if (!exerciseName) continue;

    const rawDate = dateIdx >= 0 ? row[dateIdx]?.trim() : '';
    const date = rawDate || new Date().toISOString().slice(0, 10);
    const title = (titleIdx >= 0 ? row[titleIdx]?.trim() : '') || 'Imported Workout';
    const groupKey = `${date}__${title}`;

    if (!workoutMap.has(groupKey)) {
      workoutMap.set(groupKey, {
        title,
        date,
        notes: notesIdx >= 0 ? row[notesIdx]?.trim() : undefined,
        exercises: [],
      });
    }

    const currentWorkout = workoutMap.get(groupKey)!;
    let exerciseGroup = currentWorkout.exercises.find((e) => e.name === exerciseName);
    if (!exerciseGroup) {
      exerciseGroup = { name: exerciseName, sets: [] };
      currentWorkout.exercises.push(exerciseGroup);
    }

    const rawType = (typeIdx >= 0 ? row[typeIdx]?.trim() : '').toLowerCase();
    let setType: SetType = 'working';
    if (rawType.includes('warm') || rawType === 'w') {
      setType = 'warmup';
    } else if (rawType.includes('drop') || rawType === 'd') {
      setType = 'drop';
    } else if (rawType.includes('fail') || rawType === 'f') {
      setType = 'failure';
    }

    const weightVal = weightIdx >= 0 ? parseFloat(row[weightIdx]) || 0 : 0;
    const repsVal = repsIdx >= 0 ? parseInt(row[repsIdx], 10) || 0 : 0;
    const rpeVal = rpeIdx >= 0 ? parseFloat(row[rpeIdx]) || null : null;

    exerciseGroup.sets.push({
      setIndex: exerciseGroup.sets.length + 1,
      setType,
      weightKg: weightVal,
      reps: repsVal,
      rpe: rpeVal,
      notes: notesIdx >= 0 ? row[notesIdx]?.trim() : undefined,
    });
  }

  const workouts = Array.from(workoutMap.values());
  const uniqueExercises = Array.from(
    new Set(workouts.flatMap((w) => w.exercises.map((e) => e.name))),
  );

  return {
    sourceType: isHevy ? 'hevy' : isStrong ? 'strong' : 'csv',
    workouts,
    uniqueExercises,
  };
}

function parseCsvLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

/**
 * Fast fuzzy matching against master exercises
 */
export function fuzzyMatchExercise(
  rawName: string,
  catalog: CatalogExerciseItem[],
): { id: string | null; name: string; score: number } {
  const clean = normalize(rawName);

  // 1. Exact match
  const exact = catalog.find((c) => normalize(c.name) === clean);
  if (exact) return { id: exact.id, name: exact.name, score: 100 };

  // 2. Contains match
  const contains = catalog.find((c) => {
    const cClean = normalize(c.name);
    return cClean.includes(clean) || clean.includes(cClean);
  });
  if (contains) return { id: contains.id, name: contains.name, score: 85 };

  // 3. Word token overlap
  const words = clean.split(' ').filter((w) => w.length > 2);
  if (words.length > 0) {
    let bestScore = 0;
    let bestMatch: CatalogExerciseItem | null = null;

    for (const item of catalog) {
      const cWords = normalize(item.name).split(' ');
      const matchCount = words.filter((w) => cWords.includes(w)).length;
      const score = Math.round((matchCount / Math.max(words.length, cWords.length)) * 100);

      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch) {
      return { id: bestMatch.id, name: bestMatch.name, score: bestScore };
    }
  }

  // Fallback: custom exercise
  return { id: null, name: rawName, score: 0 };
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[()[\]{}_,.-]/g, ' ')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\s+/g, ' ')
    .trim();
}
