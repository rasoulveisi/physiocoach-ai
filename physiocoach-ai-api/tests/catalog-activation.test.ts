import { describe, expect, it } from 'vitest';

import { createDb } from '../src/db/client';
import {
  activateCatalogVersion,
  evaluateCatalogCoverage,
  evaluateCatalogActivation,
  markCatalogReady,
} from '../src/services/catalog-activation';
import { createCatalogDb, createCompleteEvidenceJson } from './support/catalog-db';

describe('catalog activation gates', () => {
  it.each([
    ['source accounting', { sourceRecordCount: 2 }],
    ['required exercise metadata', { attributesJson: '{}' }],
    ['approved review status', { reviewStatus: 'pending' }],
    ['complete safety matrix', { ratingCount: 53 }],
    ['resolved evidence', { evidenceJson: '{"unresolvedConflicts":[]}' }],
    ['equipment coverage', { hasEquipment: false }],
  ])('does not let markCatalogReady bypass the %s gate', async (_gate, options) => {
    const database = createCatalogDb({ ratingCount: 54, ...options });

    await expect(markCatalogReady(createDb(database), 'catalog-1')).rejects.toThrow(
      'Catalog activation is blocked',
    );
    expect(database.statements.some((sql) => sql.includes('set "status" = ?'))).toBe(false);
  });

  it.each(['importing', 'analyzing', 'review_required'])(
    'cannot activate a catalog while its status is %s',
    async (status) => {
      await expect(
        activateCatalogVersion(
          createDb(createCatalogDb({ ratingCount: 54, status })),
          'catalog-1',
          'admin-1',
        ),
      ).rejects.toMatchObject({
        evaluation: {
          blockers: expect.arrayContaining([
            expect.objectContaining({ code: 'catalog_not_ready' }),
          ]),
        },
      });
    },
  );

  it('marks a complete review-required catalog ready before it can be activated', async () => {
    const database = createCatalogDb({ ratingCount: 54, status: 'review_required' });

    await expect(markCatalogReady(createDb(database), 'catalog-1')).resolves.toMatchObject({
      ready: true,
      status: 'ready',
    });
    expect(database.statements).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          '"status" = ? and "exercise_catalog_versions"."review_revision" = ?',
        ),
      ]),
    );
  });
  it('rejects active to ready and never reopens a published catalog', async () => {
    await expect(
      markCatalogReady(
        createDb(createCatalogDb({ ratingCount: 54, status: 'active' })),
        'catalog-1',
      ),
    ).rejects.toMatchObject({
      evaluation: {
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'catalog_not_review_required' }),
        ]),
      },
    });
  });

  it('reports substantive ready coverage for an active catalog without reopening it', async () => {
    const database = createCatalogDb({ ratingCount: 54, status: 'active' });

    await expect(evaluateCatalogCoverage(createDb(database), 'catalog-1')).resolves.toMatchObject({
      status: 'active',
      ready: true,
      blockers: [],
    });
    await expect(markCatalogReady(createDb(database), 'catalog-1')).rejects.toThrow(
      'Catalog activation is blocked',
    );
  });

  it('fails readiness when the optimistic revision update changes no row', async () => {
    await expect(
      markCatalogReady(
        createDb(createCatalogDb({ ratingCount: 54, status: 'review_required', updateChanges: 0 })),
        'catalog-1',
      ),
    ).rejects.toMatchObject({
      evaluation: {
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'catalog_changed_during_readiness' }),
        ]),
      },
    });
  });

  it('blocks readiness while duplicate review groups remain pending', async () => {
    await expect(
      evaluateCatalogActivation(
        createDb(
          createCatalogDb({
            ratingCount: 54,
            status: 'review_required',
            pendingDuplicateGroups: 1,
          }),
        ),
        'catalog-1',
        false,
      ),
    ).resolves.toMatchObject({
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'pending_duplicate_reviews' }),
      ]),
    });
  });

  it.each([
    ['invalid rating enum', { ratingValues: ['unsafe'] }, 'invalid_safety_rating_content'],
    ['empty rating reason', { ratingReasons: [''] }, 'invalid_safety_rating_content'],
    [
      'decreasing severity strictness',
      { ratingValues: ['avoid', 'caution', 'recommended'] },
      'non_monotonic_safety_ratings',
    ],
  ])('blocks readiness for %s', async (_case, options, code) => {
    await expect(
      evaluateCatalogActivation(
        createDb(createCatalogDb({ ratingCount: 54, status: 'review_required', ...options })),
        'catalog-1',
        false,
      ),
    ).resolves.toMatchObject({
      blockers: expect.arrayContaining([expect.objectContaining({ code })]),
    });
  });
  it('blocks activation when one approved exercise lacks a matrix cell', async () => {
    const db = createDb(createCatalogDb({ ratingCount: 53 }));

    await expect(evaluateCatalogActivation(db, 'catalog-1')).resolves.toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'incomplete_safety_coverage' }),
      ]),
    });
  });

  it('blocks activation when persisted exercise rows do not match the imported record count', async () => {
    const db = createDb(
      createCatalogDb({
        ratingCount: 54,
        sourceRecordCount: 1_324,
        importedRecordCount: 1_324,
      }),
    );

    await expect(evaluateCatalogActivation(db, 'catalog-1')).resolves.toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'source_accounting_incomplete' }),
      ]),
    });
  });

  it('blocks activation when a matrix cell uses an invalid severity despite having 54 distinct cells', async () => {
    const db = createDb(
      createCatalogDb({
        ratingCount: 54,
        ratingSeverities: ['invalid', 'moderate', 'severe'],
      }),
    );

    await expect(evaluateCatalogActivation(db, 'catalog-1')).resolves.toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'incomplete_safety_coverage' }),
      ]),
    });
  });

  it('blocks activation when persisted evidence has no resolved-conflict declaration', async () => {
    const db = createDb(
      createCatalogDb({
        ratingCount: 54,
        evidenceJson: '{"unresolvedConflicts":[]}',
      }),
    );

    await expect(evaluateCatalogActivation(db, 'catalog-1')).resolves.toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'unresolved_safety_conflicts' }),
      ]),
    });
  });

  it('blocks activation when evidence has only a conflict-resolution proof', async () => {
    const db = createDb(
      createCatalogDb({
        ratingCount: 54,
        evidenceJson:
          '{"conflictResolution":{"status":"resolved","analysisVersion":"safety-v1","unresolvedConflicts":[]}}',
      }),
    );

    await expect(evaluateCatalogActivation(db, 'catalog-1')).resolves.toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'unresolved_safety_conflicts' }),
      ]),
    });
  });

  it('blocks activation when final ratings are complete but analyzer AI evidence is empty', async () => {
    const evidence = JSON.parse(createCompleteEvidenceJson()) as {
      ai: { ratings: unknown[] };
    };
    evidence.ai.ratings = [];
    const db = createDb(
      createCatalogDb({
        ratingCount: 54,
        evidenceJson: JSON.stringify(evidence),
      }),
    );

    await expect(evaluateCatalogActivation(db, 'catalog-1')).resolves.toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'unresolved_safety_conflicts' }),
      ]),
    });
  });

  it('blocks activation when evidence declares an unresolved conflict despite a resolved declaration', async () => {
    const db = createDb(
      createCatalogDb({
        ratingCount: 54,
        evidenceJson:
          '{"unresolvedConflicts":["rule-ai mismatch"],"conflictResolution":{"status":"resolved","analysisVersion":"safety-v1","unresolvedConflicts":[]}}',
      }),
    );

    await expect(evaluateCatalogActivation(db, 'catalog-1')).resolves.toMatchObject({
      ready: false,
      blockers: expect.arrayContaining([
        expect.objectContaining({ code: 'unresolved_safety_conflicts' }),
      ]),
    });
  });

  it('retires the active catalog before activating a catalog that passes every gate', async () => {
    const database = createCatalogDb({ ratingCount: 54 });
    const result = await activateCatalogVersion(createDb(database), 'catalog-1', 'admin-1');

    expect(result).toMatchObject({ ready: true, actor: 'admin-1' });
    expect(database.statements).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"status" = ? and exists'),
        expect.stringContaining(
          'set "status" = ?, "activated_at" = ? where ("exercise_catalog_versions"."id" = ?',
        ),
      ]),
    );
  });
});
