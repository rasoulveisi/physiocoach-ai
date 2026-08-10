import { describe, expect, it } from 'vitest';
import {
  ExerciseCatalogRecordSchema,
  CatalogMediaMetadataSchema,
} from '../src/types/exercise-catalog';

describe('exercise catalog zod contracts', () => {
  it('requires stable exercise ids, movement pattern, muscle links, and equipment links', () => {
    const parsed = ExerciseCatalogRecordSchema.safeParse({
      id: '',
      name: 'Goblet squat',
      source: 'external',
      sourceId: 'source-ex-1',
      movementPattern: 'squat',
      equipmentLinks: [{ exerciseId: '', equipmentId: 'eq_1' }],
      muscleLinks: [{ exerciseId: 'ex_1', muscleId: '' }],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['id', 'equipmentLinks.0.exerciseId', 'muscleLinks.0.muscleId']),
    );
  });

  it('requires a movement pattern and non-empty link arrays', () => {
    const parsed = ExerciseCatalogRecordSchema.safeParse({
      id: 'ex_003',
      canonicalId: 'ex_003',
      name: 'Goblet squat',
      source: 'PhysioCoach',
      sourceId: 'pc-ex-3',
      movementPattern: 'invalid-pattern',
      equipmentLinks: [],
      muscleLinks: [],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['movementPattern', 'equipmentLinks', 'muscleLinks']),
    );
  });

  it('requires license attribution when source asset is not PhysioCoach-owned', () => {
    const parsed = ExerciseCatalogRecordSchema.safeParse({
      id: 'ex_001',
      canonicalId: 'ex_001',
      name: 'Goblet squat',
      source: 'third-party',
      sourceId: 'source-ex-1',
      movementPattern: 'squat',
      equipmentLinks: [{ exerciseId: 'ex_001', equipmentId: 'eq_dumbbells_only' }],
      muscleLinks: [{ exerciseId: 'ex_001', muscleId: 'muscle_quads' }],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['licenseName', 'licenseUrl', 'licenseAuthor', 'attributionText']),
    );
  });

  it('accepts PhysioCoach-owned catalog records with no explicit attribution fields', () => {
    const parsed = ExerciseCatalogRecordSchema.safeParse({
      id: 'ex_002',
      canonicalId: 'ex_002',
      name: 'Goblet squat',
      source: 'PhysioCoach',
      sourceId: 'pc-ex-2',
      movementPattern: 'squat',
      equipmentLinks: [{ exerciseId: 'ex_002', equipmentId: 'eq_dumbbells_only' }],
      muscleLinks: [{ exerciseId: 'ex_002', muscleId: 'muscle_quads' }],
    });

    expect(parsed.success).toBe(true);
  });

  it('defaults omitted muscle link isPrimary to true to match DB default', () => {
    const parsed = ExerciseCatalogRecordSchema.parse({
      id: 'ex_004',
      canonicalId: 'ex_004',
      name: 'Goblet squat',
      source: 'PhysioCoach',
      sourceId: 'pc-ex-4',
      movementPattern: 'squat',
      equipmentLinks: [{ exerciseId: 'ex_004', equipmentId: 'eq_dumbbells_only' }],
      muscleLinks: [{ exerciseId: 'ex_004', muscleId: 'muscle_quads' }],
    });

    expect(parsed.muscleLinks[0]?.isPrimary).toBe(true);
  });

  it('rejects nested links that reference a different exercise id', () => {
    const parsed = ExerciseCatalogRecordSchema.safeParse({
      id: 'ex_005',
      canonicalId: 'ex_005',
      name: 'Goblet squat',
      source: 'PhysioCoach',
      sourceId: 'pc-ex-5',
      movementPattern: 'squat',
      equipmentLinks: [{ exerciseId: 'other_exercise', equipmentId: 'eq_dumbbells_only' }],
      muscleLinks: [{ exerciseId: 'other_exercise', muscleId: 'muscle_quads' }],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['equipmentLinks.0.exerciseId', 'muscleLinks.0.exerciseId']),
    );
  });

  it('validates media metadata and attribution rules consistently', () => {
    const parsed = CatalogMediaMetadataSchema.safeParse({
      id: 'media_001',
      exerciseId: 'ex_001',
      storageUrl: 'https://media.example.com/ex-1/thumbnail.webp',
      mediaType: 'image',
      source: 'third-party',
      sourceId: 'asset-1',
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['licenseName', 'licenseUrl', 'licenseAuthor', 'attributionText']),
    );
  });
});
