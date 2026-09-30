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

function parseSetType(raw: string | number | undefined | null): SetType {
  const str = String(raw ?? '').toLowerCase().trim();
  if (str === '1' || str === 'w' || str.includes('warm')) return 'warmup';
  if (str === '4' || str === 'f' || str.includes('fail')) return 'failure';
  if (str === '5' || str === 'd' || str.includes('drop')) return 'drop';
  return 'working';
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields;
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

function parseWorkoutJson(jsonText: string): ParseResult {
  const data = JSON.parse(jsonText);
  const rawWorkouts: any[] = Array.isArray(data) ? data : data.workouts || data.sessions || [];
  const workouts: ParsedImportWorkout[] = [];

  for (const raw of rawWorkouts) {
    const title = raw.title || raw.name || raw.workout_name || 'Imported Workout';
    const date =
      raw.workout_perform_date || raw.performedAt || raw.date || new Date().toISOString();
    const rawExercises: any[] = raw.exercises || raw.exercise_list || [];
    const exercises: ParsedImportExercise[] = [];

    for (const rawEx of rawExercises) {
      const name = rawEx.excercise_name || rawEx.exercise_name || rawEx.name || 'Exercise';
      const rawSets: any[] = rawEx.sets || [];
      const sets: ParsedImportSet[] = [];

      for (let i = 0; i < rawSets.length; i++) {
        const s = rawSets[i];
        const setType = parseSetType(s.set_type_id ?? s.setType ?? s.type);

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

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/["']/g, '').trim());
  const findCol = (predicate: (h: string) => boolean) => header.findIndex(predicate);

  const dateIdx = findCol((h) => h.includes('date'));
  const titleIdx = findCol((h) => h.includes('workout') || h.includes('title') || h.includes('routine'));
  const nameIdx = findCol((h) => h.includes('exercise') || h.includes('name'));
  const weightIdx = findCol((h) => h.includes('weight') || h.includes('kg') || h.includes('lbs'));
  const repsIdx = findCol((h) => h.includes('rep'));
  const typeIdx = findCol((h) => h.includes('type') || h.includes('tag'));
  const rpeIdx = findCol((h) => h.includes('rpe') || h.includes('rir'));
  const notesIdx = findCol((h) => h.includes('note') || h.includes('comment'));

  if (nameIdx === -1) {
    throw new Error('Could not find Exercise Name column in CSV header.');
  }

  const isHevy = header.some((h) => h.includes('exercise title') || h.includes('set order'));
  const isStrong = header.some(
    (h) => h.includes('workout notes') || (header.includes('workout name') && header.includes('duration')),
  );

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

    const setType = parseSetType(typeIdx >= 0 ? row[typeIdx] : undefined);
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
  const queryTokens = new Set(clean.split(' ').filter((w) => w.length > 2));
  if (queryTokens.size > 0) {
    let bestScore = 0;
    let bestMatch: CatalogExerciseItem | null = null;

    for (const item of catalog) {
      const itemTokens = new Set(normalize(item.name).split(' ').filter((w) => w.length > 2));
      if (itemTokens.size === 0) continue;

      let matchCount = 0;
      for (const token of queryTokens) {
        if (itemTokens.has(token)) matchCount++;
      }

      const unionSize = new Set([...queryTokens, ...itemTokens]).size;
      const score = Math.round((matchCount / Math.max(1, unionSize)) * 100);

      if (score > bestScore && score >= 40) {
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
