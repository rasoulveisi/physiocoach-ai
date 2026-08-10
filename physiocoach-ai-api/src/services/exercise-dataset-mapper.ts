import { z } from 'zod';
import {
  exerciseCatalogVersions,
  exerciseAliases,
  exerciseEquipment,
  exerciseMuscles,
  masterEquipment,
  masterExercises,
  masterMuscles,
} from '../db/schema';

const SOURCE = 'hasaneyldrm_exercises_dataset';
const SOURCE_REPOSITORY = 'https://github.com/hasaneyldrm/exercises-dataset';
const SOURCE_LICENSE_NAME = 'MIT';
const SOURCE_LICENSE_URL = 'https://github.com/hasaneyldrm/exercises-dataset/blob/main/LICENSE';
const SOURCE_LICENSE_AUTHOR = 'hasaneyldrm';
const SOURCE_ATTRIBUTION = 'hasaneyldrm/exercises-dataset metadata and instructions (MIT)';
const INSTRUCTION_LANGUAGES = ['en', 'it', 'tr', 'es', 'ru', 'zh', 'hi', 'pl', 'ko', 'fr'] as const;

const localizedInstructionsSchema = z
  .object(
    Object.fromEntries(
      INSTRUCTION_LANGUAGES.map((language) => [language, z.string().trim().min(1)]),
    ) as Record<(typeof INSTRUCTION_LANGUAGES)[number], z.ZodString>,
  )
  .strict();

const localizedStepsSchema = z
  .object(
    Object.fromEntries(
      INSTRUCTION_LANGUAGES.map((language) => [language, z.array(z.string().trim().min(1)).min(1)]),
    ) as Record<(typeof INSTRUCTION_LANGUAGES)[number], z.ZodArray<z.ZodString>>,
  )
  .strict();

/** Published hasaneyldrm/exercises-dataset record. Media references are validated but never imported. */
export const sourceExerciseSchema = z
  .object({
    id: z.string().trim().regex(/^\d+$/, 'id must be a numeric string'),
    name: z.string().trim().min(1),
    category: z.string().trim().min(1),
    body_part: z.string().trim().min(1),
    equipment: z.string().trim().min(1),
    instructions: localizedInstructionsSchema,
    instruction_steps: localizedStepsSchema,
    muscle_group: z.string().trim().min(1),
    secondary_muscles: z.array(z.string().trim().min(1)),
    target: z.string().trim().min(1),
    image: z.string().trim().min(1),
    gif_url: z.string().trim().min(1),
    media_id: z.string().trim().min(1),
    created_at: z.string().trim().min(1),
    attribution: z.string().trim().min(1),
  })
  .strict();

type SourceExercise = z.infer<typeof sourceExerciseSchema>;
type CatalogVersionInsert = typeof exerciseCatalogVersions.$inferInsert;
type MasterExerciseInsert = typeof masterExercises.$inferInsert;
type MasterEquipmentInsert = typeof masterEquipment.$inferInsert;
type MasterMuscleInsert = typeof masterMuscles.$inferInsert;
type ExerciseEquipmentInsert = typeof exerciseEquipment.$inferInsert;
type ExerciseMuscleInsert = typeof exerciseMuscles.$inferInsert;
type ExerciseAliasInsert = typeof exerciseAliases.$inferInsert;

export interface ExerciseDatasetImport {
  catalogVersion: CatalogVersionInsert;
  exercises: MasterExerciseInsert[];
  equipment: MasterEquipmentInsert[];
  muscles: MasterMuscleInsert[];
  exerciseEquipment: ExerciseEquipmentInsert[];
  exerciseMuscles: ExerciseMuscleInsert[];
  aliases: ExerciseAliasInsert[];
  media: [];
  rejected: Array<{ sourceId: string; reason: string }>;
  duplicateNameGroups: Array<{ normalizedName: string; sourceIds: string[] }>;
  accounted: number;
}

export interface ExerciseDatasetMetadata {
  sourceCommitSha: string;
  datasetSha256: string;
  importedAt: string;
  analysisVersion?: string;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizedName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sourceIdFromUnknown(record: unknown, index: number): string {
  if (record && typeof record === 'object' && typeof (record as { id?: unknown }).id === 'string') {
    return (record as { id: string }).id.trim() || `row-${index + 1}`;
  }
  return `row-${index + 1}`;
}

function sourceFields(sourceId: string) {
  return {
    source: SOURCE,
    sourceId,
    licenseName: SOURCE_LICENSE_NAME,
    licenseUrl: SOURCE_LICENSE_URL,
    licenseAuthor: SOURCE_LICENSE_AUTHOR,
    attributionText: SOURCE_ATTRIBUTION,
  };
}

function createCatalogVersion(
  metadata: ExerciseDatasetMetadata,
  sourceRecordCount: number,
): CatalogVersionInsert {
  const commit = metadata.sourceCommitSha.trim();
  const checksum = metadata.datasetSha256.trim();
  if (!commit || !checksum || !metadata.importedAt.trim()) {
    throw new Error('sourceCommitSha, datasetSha256, and importedAt are required.');
  }
  return {
    id: `catalog_exercises_dataset_${normalize(commit)}_${normalize(checksum).slice(0, 12)}`,
    source: SOURCE,
    sourceRepository: SOURCE_REPOSITORY,
    sourceCommitSha: commit,
    datasetSha256: checksum,
    sourceRecordCount,
    importedRecordCount: 0,
    rejectedRecordCount: 0,
    status: 'importing',
    analysisVersion: metadata.analysisVersion ?? 'safety-v1',
    createdAt: metadata.importedAt,
  };
}

/** Maps every input row either to an immutable source-backed record or an explicit rejection. */
export function mapExerciseDataset(
  records: unknown[],
  metadata: ExerciseDatasetMetadata,
): ExerciseDatasetImport {
  const catalogVersion = createCatalogVersion(metadata, records.length);
  const result: ExerciseDatasetImport = {
    catalogVersion,
    exercises: [],
    equipment: [],
    muscles: [],
    exerciseEquipment: [],
    exerciseMuscles: [],
    aliases: [],
    media: [],
    rejected: [],
    duplicateNameGroups: [],
    accounted: 0,
  };
  const equipmentById = new Set<string>();
  const musclesById = new Set<string>();
  const names = new Map<string, string[]>();
  const seenSourceIds = new Set<string>();

  records.forEach((rawRecord, index) => {
    const fallbackSourceId = sourceIdFromUnknown(rawRecord, index);
    const parsed = sourceExerciseSchema.safeParse(rawRecord);
    if (!parsed.success) {
      result.rejected.push({
        sourceId: fallbackSourceId,
        reason: `Invalid published source record: ${parsed.error.issues[0]?.path.join('.') ?? 'unknown field'}`,
      });
      result.accounted += 1;
      return;
    }
    const record = parsed.data;
    if (seenSourceIds.has(record.id)) {
      result.rejected.push({ sourceId: record.id, reason: 'Duplicate source id.' });
      result.accounted += 1;
      return;
    }
    seenSourceIds.add(record.id);
    mapAcceptedRecord(
      result,
      record,
      catalogVersion.id,
      equipmentById,
      musclesById,
      names,
      metadata.importedAt,
    );
    result.accounted += 1;
  });

  result.catalogVersion.importedRecordCount = result.exercises.length;
  result.catalogVersion.rejectedRecordCount = result.rejected.length;
  result.duplicateNameGroups = [...names.entries()]
    .filter(([, sourceIds]) => sourceIds.length > 1)
    .map(([name, sourceIds]) => ({ normalizedName: name, sourceIds: sourceIds.sort() }))
    .sort((left, right) => left.normalizedName.localeCompare(right.normalizedName));
  result.exercises.sort((left, right) => left.id.localeCompare(right.id));
  result.equipment.sort((left, right) => left.id.localeCompare(right.id));
  result.muscles.sort((left, right) => left.id.localeCompare(right.id));
  result.exerciseEquipment.sort((left, right) =>
    `${left.exerciseId}-${left.equipmentId}`.localeCompare(
      `${right.exerciseId}-${right.equipmentId}`,
    ),
  );
  result.exerciseMuscles.sort((left, right) =>
    `${left.exerciseId}-${left.muscleId}`.localeCompare(`${right.exerciseId}-${right.muscleId}`),
  );
  return result;
}

function mapAcceptedRecord(
  result: ExerciseDatasetImport,
  record: SourceExercise,
  catalogVersionId: string,
  equipmentById: Set<string>,
  musclesById: Set<string>,
  names: Map<string, string[]>,
  timestamp: string,
): void {
  const exerciseId = `ex_${catalogVersionId}_${record.id}`;
  const equipmentId = `eq_exercises_dataset_${normalize(record.equipment)}`;
  const primaryMuscle = record.target;
  const muscleNames = [
    ...new Set([primaryMuscle, record.muscle_group, ...record.secondary_muscles]),
  ];
  const nameKey = normalizedName(record.name);
  names.set(nameKey, [...(names.get(nameKey) ?? []), record.id]);

  if (!equipmentById.has(equipmentId)) {
    equipmentById.add(equipmentId);
    result.equipment.push({
      id: equipmentId,
      canonicalId: equipmentId,
      name: record.equipment,
      ...sourceFields(record.equipment),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  result.exerciseEquipment.push({ exerciseId, equipmentId });

  muscleNames.forEach((muscleName) => {
    const muscleId = `muscle_exercises_dataset_${normalize(muscleName)}`;
    if (!musclesById.has(muscleId)) {
      musclesById.add(muscleId);
      result.muscles.push({
        id: muscleId,
        canonicalId: muscleId,
        name: muscleName,
        ...sourceFields(muscleName),
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
    result.exerciseMuscles.push({
      exerciseId,
      muscleId,
      isPrimary: muscleName === primaryMuscle ? 1 : 0,
    });
  });

  result.exercises.push({
    id: exerciseId,
    canonicalId: exerciseId,
    name: record.name,
    movementPattern: 'unclassified',
    instructions: record.instructions.en,
    catalogVersionId,
    bodyPart: record.body_part,
    target: record.target,
    primaryMuscle,
    secondaryMusclesJson: JSON.stringify(record.secondary_muscles),
    instructionsJson: JSON.stringify({
      instructions: record.instructions,
      instructionSteps: record.instruction_steps,
    }),
    ...sourceFields(record.id),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function buildExerciseDatasetImportSql(imported: ExerciseDatasetImport): string {
  const lines = [insert('exercise_catalog_versions', toSqlCatalogVersion(imported.catalogVersion))];
  // These normalized dimensions are immutable by source ID and can be shared across snapshots.
  for (const record of imported.muscles)
    lines.push(insertOrIgnore('master_muscles', toSqlRecord(record)));
  for (const record of imported.equipment)
    lines.push(insertOrIgnore('master_equipment', toSqlRecord(record)));
  for (const record of imported.exercises)
    lines.push(insert('master_exercises', toSqlRecord(record)));
  for (const record of imported.aliases)
    lines.push(insert('exercise_aliases', toSqlRecord(record)));
  for (const record of imported.exerciseMuscles)
    lines.push(insert('exercise_muscles', toSqlRecord(record)));
  for (const record of imported.exerciseEquipment)
    lines.push(insert('exercise_equipment', toSqlRecord(record)));
  for (const group of imported.duplicateNameGroups) {
    lines.push(
      insert('exercise_duplicate_review_groups', {
        catalog_version_id: imported.catalogVersion.id,
        normalized_name: group.normalizedName,
        source_ids_json: JSON.stringify(group.sourceIds),
        status: 'pending',
        created_at: imported.catalogVersion.createdAt,
      }),
    );
  }
  return lines.join('\n');
}

function toSqlCatalogVersion(record: CatalogVersionInsert): Record<string, unknown> {
  return camelToSnake(record);
}

function toSqlRecord(record: Record<string, unknown>): Record<string, unknown> {
  return camelToSnake(record);
}

function camelToSnake(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ]),
  );
}

function insert(table: string, values: Record<string, unknown>): string {
  const columns = Object.keys(values);
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((column) => sqlValue(values[column])).join(', ')});`;
}

function insertOrIgnore(table: string, values: Record<string, unknown>): string {
  const columns = Object.keys(values);
  return `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((column) => sqlValue(values[column])).join(', ')});`;
}

function sqlValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}
