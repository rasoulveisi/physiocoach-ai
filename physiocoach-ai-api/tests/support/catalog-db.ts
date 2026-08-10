export function createCatalogDb({
  ratingCount,
  sourceRecordCount = 1,
  importedRecordCount = 1,
  ratingSeverities = ['mild', 'moderate', 'severe'],
  ratingValues = ['recommended', 'recommended', 'recommended'],
  ratingReasons = ['Complete persisted rating reason.'],
  evidenceJson = createCompleteEvidenceJson(),
  status = 'ready',
  reviewStatus = 'approved',
  attributesJson = createCompleteAttributesJson(),
  hasEquipment = true,
  pendingDuplicateGroups = 0,
  updateChanges = 1,
}: {
  ratingCount: number;
  sourceRecordCount?: number;
  importedRecordCount?: number;
  ratingSeverities?: string[];
  ratingValues?: string[];
  ratingReasons?: string[];
  evidenceJson?: string;
  status?: string;
  reviewStatus?: string;
  attributesJson?: string;
  hasEquipment?: boolean;
  pendingDuplicateGroups?: number;
  updateChanges?: number;
}) {
  const rowsBySql = [
    [
      [
        'catalog-1',
        'dataset',
        'https://example.test/dataset',
        'abc',
        'hash',
        sourceRecordCount,
        importedRecordCount,
        0,
        status,
        'safety-v1',
        0,
        '2026-07-31T00:00:00.000Z',
        null,
      ],
    ],
    [['exercise-1', 'squat', 'quadriceps', 'quadriceps', attributesJson]],
    Array.from({ length: 18 }, (_, index) => [
      `consideration-id-${index + 1}`,
      `consideration-${index + 1}`,
    ]),
    [['exercise-1', reviewStatus, 1, 'recommended', 'Complete profile reason.']],
    Array.from({ length: ratingCount }, (_, index) => [
      'exercise-1',
      `consideration-id-${Math.floor(index / 3) + 1}`,
      ratingSeverities[index % 3],
      ratingValues[index % ratingValues.length],
      ratingReasons[index % ratingReasons.length],
    ]),
    [['exercise-1', evidenceJson]],
    hasEquipment ? [['exercise-1']] : [],
    Array.from({ length: pendingDuplicateGroups }, (_, index) => [`duplicate-${index + 1}`]),
  ];
  let queryIndex = 0;
  const statements: string[] = [];

  const database = {
    statements,
    prepare(sql: string) {
      statements.push(sql);
      return {
        bind() {
          return this;
        },
        async raw() {
          return rowsBySql[queryIndex++] ?? [];
        },
        async run() {
          return { success: true, meta: { changes: updateChanges } };
        },
      };
    },
    async batch(batch: Array<{ run(): Promise<unknown> }>) {
      return Promise.all(batch.map((statement) => statement.run()));
    },
  };
  return database as unknown as D1Database & { statements: string[] };
}

function createCompleteAttributesJson() {
  return JSON.stringify({
    movementPattern: 'squat',
    loadedRegions: ['hip', 'knee'],
    impactLevel: 'low',
    spinalLoad: 'low',
    balanceDemand: 'low',
    technicalComplexity: 'beginner',
    overhead: false,
    behindNeck: false,
    deepFlexion: false,
    explosive: false,
    unilateral: false,
    rotational: false,
    inverted: false,
  });
}

export function createCompleteEvidenceJson() {
  return JSON.stringify({
    analysisVersion: 'safety-v1',
    inputHash: 'a'.repeat(64),
    ai: {
      schemaVersion: '1.0',
      ratings: Array.from({ length: 54 }, (_, index) => ({
        considerationCode: `consideration-${Math.floor(index / 3) + 1}`,
        severity: ['mild', 'moderate', 'severe'][index % 3],
        rating: 'recommended',
        reason: 'Complete analyzer fixture evidence.',
        confidence: 1,
      })),
      summaryReason: 'Complete analyzer fixture evidence.',
      confidence: 1,
    },
    deterministic: { ratings: [], ruleCodes: [], reasons: [] },
    conflictResolution: {
      status: 'resolved',
      analysisVersion: 'safety-v1',
      unresolvedConflicts: [],
    },
  });
}
