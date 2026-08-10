import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  buildExerciseDatasetImportSql,
  mapExerciseDataset,
  sourceExerciseSchema,
} from '../src/services/exercise-dataset-mapper';

const sample = JSON.parse(
  await readFile(new URL('./fixtures/exercises-dataset-sample.json', import.meta.url), 'utf8'),
);

const metadata = {
  sourceCommitSha: 'abc123',
  datasetSha256: 'hash123',
  importedAt: '2026-07-28T00:00:00.000Z',
};

describe('exercise dataset mapper', () => {
  it('maps source ids without importing source media', () => {
    const result = mapExerciseDataset(sample, metadata);

    expect(result.accounted).toBe(sample.length);
    expect(result.exercises[0]).toMatchObject({
      id: expect.stringContaining('_0001'),
      source: 'hasaneyldrm_exercises_dataset',
      sourceId: '0001',
      catalogVersionId: result.catalogVersion.id,
      instructionsJson: expect.stringContaining('"fr"'),
    });
    expect(result.media).toEqual([]);
    expect(result.exercises[0]?.movementPattern).toBe('unclassified');
  });

  it('preserves separate source rows for each catalog version and emits additive SQL', () => {
    const first = mapExerciseDataset(sample, metadata);
    const second = mapExerciseDataset(sample, { ...metadata, sourceCommitSha: 'def456' });

    expect(first.exercises[0]?.id).not.toBe(second.exercises[0]?.id);
    expect(first.exercises[0]?.catalogVersionId).not.toBe(second.exercises[0]?.catalogVersionId);
    const sql = buildExerciseDatasetImportSql(first);
    expect(sql).toContain('INSERT INTO master_exercises');
    expect(sql).not.toContain('INSERT OR REPLACE');
    expect(sql).not.toMatch(/\b(?:BEGIN|COMMIT)\b/i);
  });

  it('reports duplicate normalized names without merging ids', () => {
    const duplicateNames = sample.map((exercise: Record<string, unknown>, index: number) => ({
      ...exercise,
      id: String(index + 1).padStart(4, '0'),
      name: index === 0 ? 'Lever Chest Press' : ' lever-chest   press ',
    }));

    const result = mapExerciseDataset(duplicateNames, metadata);

    expect(result.exercises).toHaveLength(2);
    expect(result.duplicateNameGroups).toEqual([
      expect.objectContaining({ normalizedName: 'lever chest press', sourceIds: ['0001', '0002'] }),
    ]);
  });

  it('accounts for invalid published records as rejected rather than dropping them', () => {
    const result = mapExerciseDataset(
      [{ ...sample[0], instructions: { en: 'Only English' } }],
      metadata,
    );

    expect(result.accounted).toBe(1);
    expect(result.exercises).toEqual([]);
    expect(result.rejected).toEqual([
      expect.objectContaining({
        sourceId: '0001',
        reason: expect.stringContaining('instructions'),
      }),
    ]);
  });

  it('rejects unknown published source fields', () => {
    expect(sourceExerciseSchema.safeParse({ ...sample[0], unexpected: true }).success).toBe(false);
  });
});
