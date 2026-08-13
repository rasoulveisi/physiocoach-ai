const dataEnvelopeResponse = {
  description: 'Stable MVP response envelope.',
  content: {
    'application/json': {
      schema: {
        $ref: '#/components/schemas/DataEnvelope',
      },
    },
  },
};

const dataEnvelopeConflictError = {
  description: 'Generation or normalization failed.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
};

const idPathParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: {
    type: 'string',
  },
};

const authTokenEnvelopeResponse = {
  description: 'Auth token envelope.',
  content: {
    'application/json': {
      schema: {
        $ref: '#/components/schemas/AuthTokenEnvelope',
      },
    },
  },
};

const errorResponse = {
  description: 'API error response.',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
};

function dataEnvelopeWithSchema(
  schemaRef: string,
  options: { isArray?: boolean; nullable?: boolean } = {},
) {
  const { isArray = false, nullable = false } = options;
  const dataSchema = isArray
    ? {
        type: 'array',
        items: { $ref: `#/components/schemas/${schemaRef}` },
      }
    : { $ref: `#/components/schemas/${schemaRef}` };

  return {
    description: 'Stable MVP response envelope.',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['data'],
          properties: {
            data: {
              ...dataSchema,
              ...(nullable ? { nullable: true } : {}),
            },
          },
          additionalProperties: true,
        },
      },
    },
  };
}

function requestBodyFromSchema(schemaRef: string, required = true) {
  return {
    required,
    content: {
      'application/json': {
        schema: {
          $ref: `#/components/schemas/${schemaRef}`,
        },
      },
    },
  };
}

export function createOpenApiDocument() {
  return {
    openapi: '3.1.0',
    security: [{ bearerAuth: [] }],
    info: {
      title: 'PhysioCoach AI API',
      version: '0.4.0',
    },
    paths: {
      '/api/v1/auth/register': {
        post: {
          summary: 'Register with email and password',
          tags: ['Auth'],
          security: [],
          requestBody: requestBodyFromSchema('AuthRegisterInput'),
          responses: {
            '201': authTokenEnvelopeResponse,
            '400': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/v1/auth/login': {
        post: {
          summary: 'Sign in with email and password',
          tags: ['Auth'],
          security: [],
          requestBody: requestBodyFromSchema('AuthLoginInput'),
          responses: {
            '200': authTokenEnvelopeResponse,
            '401': errorResponse,
          },
        },
      },
      '/api/v1/auth/refresh': {
        post: {
          summary: 'Rotate a refresh token',
          tags: ['Auth'],
          security: [],
          requestBody: requestBodyFromSchema('AuthRefreshInput'),
          responses: {
            '200': authTokenEnvelopeResponse,
            '401': errorResponse,
          },
        },
      },
      '/api/v1/auth/logout': {
        post: {
          summary: 'Revoke the active session',
          tags: ['Auth'],
          responses: {
            '200': {
              description: 'Logout status.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthLogoutResponse' },
                },
              },
            },
            '401': errorResponse,
          },
        },
      },
      '/api/v1/auth/me': {
        get: {
          summary: 'Get the authenticated auth user',
          tags: ['Auth'],
          responses: {
            '200': {
              description: 'Authenticated user.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthMeResponse' },
                },
              },
            },
            '401': errorResponse,
          },
        },
      },
      '/api/v1/auth/oauth/exchange': {
        post: {
          summary: 'Exchange an OAuth authorization code',
          tags: ['Auth'],
          security: [],
          requestBody: requestBodyFromSchema('AuthOAuthExchangeInput'),
          responses: {
            '200': authTokenEnvelopeResponse,
            '400': errorResponse,
            '401': errorResponse,
          },
        },
      },
      '/api/v1/auth/google/start': {
        get: {
          summary: 'Start Google OAuth sign-in',
          tags: ['Auth'],
          security: [],
          parameters: [
            {
              name: 'returnTo',
              in: 'query',
              required: false,
              schema: { type: 'string', format: 'uri' },
            },
          ],
          responses: {
            '200': {
              description: 'Google authorization URL.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthOAuthStartResponse' },
                },
              },
            },
            '400': errorResponse,
          },
        },
      },
      '/api/v1/auth/google/callback': {
        get: {
          summary: 'Handle Google OAuth callback',
          tags: ['Auth'],
          security: [],
          parameters: [
            {
              name: 'code',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'state',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '302': {
              description: 'Redirects to the frontend OAuth callback.',
            },
            '400': errorResponse,
          },
        },
      },
      '/api/v1/health': {
        get: {
          summary: 'Get API health status',
          tags: ['Health'],
          security: [],
          responses: {
            '200': {
              description: 'API health status.',
            },
          },
        },
      },
      '/api/v1/me': {
        get: {
          summary: 'Get the active user',
          tags: ['Profile'],
          responses: {
            '200': dataEnvelopeWithSchema('ApiUser'),
          },
        },
      },
      '/api/v1/profile': {
        get: {
          summary: 'Get latest active profile',
          tags: ['Profile'],
          responses: {
            '200': dataEnvelopeWithSchema('Profile'),
          },
        },
        patch: {
          summary: 'Update the active user profile',
          tags: ['Profile'],
          requestBody: requestBodyFromSchema('ProfileInput'),
          responses: {
            '200': dataEnvelopeWithSchema('Profile'),
          },
        },
      },
      '/api/v1/measurement': {
        get: {
          summary: 'List body measurements (alias)',
          tags: ['Body Measurements'],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
        post: {
          summary: 'Create a body measurement (alias)',
          tags: ['Body Measurements'],
          requestBody: requestBodyFromSchema('BodyMeasurementInput'),
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/assessments': {
        get: {
          summary: 'List assessments',
          tags: ['Assessment'],
          responses: {
            '200': dataEnvelopeWithSchema('Assessment', { isArray: true }),
          },
        },
        post: {
          summary: 'Create an assessment',
          tags: ['Assessment'],
          requestBody: requestBodyFromSchema('AssessmentInput'),
          responses: {
            '200': dataEnvelopeWithSchema('AssessmentInput'),
          },
        },
      },
      '/api/v1/assessments/latest': {
        get: {
          summary: 'Get the latest assessment',
          tags: ['Assessment'],
          responses: {
            '200': dataEnvelopeWithSchema('Assessment', { nullable: true }),
          },
        },
      },
      '/api/v1/considerations': {
        get: {
          summary: 'List active body considerations',
          tags: ['Assessment'],
          responses: {
            '200': dataEnvelopeWithSchema('BodyConsideration', { isArray: true }),
            '401': errorResponse,
          },
        },
      },
      '/api/v1/posture-assessment/analysis': {
        get: {
          summary: 'Get posture assessment with analysis metadata',
          tags: ['Assessment'],
          responses: {
            '200': dataEnvelopeWithSchema('Assessment', { nullable: true }),
          },
        },
      },
      '/api/v1/posture-assessment': {
        get: {
          summary: 'Get latest posture assessment snapshot',
          tags: ['Assessment'],
          responses: {
            '200': dataEnvelopeWithSchema('Assessment', { nullable: true }),
          },
        },
      },
      '/api/v1/workout-plans/generate': {
        post: {
          summary: 'Generate a workout plan',
          tags: ['Workout Plans'],
          requestBody: requestBodyFromSchema('GeneratePlanInput'),
          responses: {
            '200': dataEnvelopeWithSchema('WorkoutPlanResult'),
            '409': dataEnvelopeConflictError,
          },
        },
      },
      '/api/v1/workout-plans/current': {
        get: {
          summary: 'Get the current workout plan',
          tags: ['Workout Plans'],
          responses: {
            '200': dataEnvelopeWithSchema('WorkoutPlanResult', { nullable: true }),
          },
        },
        delete: {
          summary: 'Delete the current workout plan',
          tags: ['Workout Plans'],
          responses: {
            '200': dataEnvelopeWithSchema('DeleteWorkoutPlanResult'),
          },
        },
      },
      '/api/v1/workout-plans/{id}': {
        get: {
          summary: 'Get a workout plan',
          tags: ['Workout Plans'],
          parameters: [idPathParameter],
          responses: {
            '200': dataEnvelopeWithSchema('WorkoutPlanResult'),
          },
        },
      },
      '/api/v1/workout-sessions': {
        get: {
          summary: 'List workout sessions',
          tags: ['Workout Sessions'],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
        post: {
          summary: 'Create a workout session',
          tags: ['Workout Sessions'],
          requestBody: requestBodyFromSchema('WorkoutSessionCreateInput'),
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/workout-sessions/{id}': {
        get: {
          summary: 'Get a workout session',
          tags: ['Workout Sessions'],
          parameters: [idPathParameter],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
        patch: {
          summary: 'Update a workout session',
          tags: ['Workout Sessions'],
          parameters: [idPathParameter],
          requestBody: requestBodyFromSchema('WorkoutSessionPatchInput'),
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/workout-sessions/{id}/complete': {
        post: {
          summary: 'Complete a workout session',
          tags: ['Workout Sessions'],
          parameters: [idPathParameter],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/workout-sessions/{id}/swap-exercise': {
        post: {
          summary: 'Swap an exercise in a workout session',
          tags: ['Workout Sessions'],
          parameters: [idPathParameter],
          requestBody: requestBodyFromSchema('SwapExerciseInput'),
          responses: {
            '200': dataEnvelopeResponse,
            '404': errorResponse,
          },
        },
      },
      '/api/v1/exercise-logs': {
        post: {
          summary: 'Create an exercise log',
          tags: ['Exercise Logs'],
          requestBody: requestBodyFromSchema('ExerciseLogInput'),
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/exercise-logs/{id}': {
        patch: {
          summary: 'Update an exercise log',
          tags: ['Exercise Logs'],
          parameters: [idPathParameter],
          requestBody: requestBodyFromSchema('ExerciseLogPatchInput'),
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
        delete: {
          summary: 'Delete an exercise log',
          tags: ['Exercise Logs'],
          parameters: [idPathParameter],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/exercise-catalog/media': {
        get: {
          summary: 'Get exercise catalog media',
          tags: ['Exercise Catalog'],
          parameters: [
            {
              name: 'exerciseId',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'name',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'movementPattern',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'muscleGroup',
              in: 'query',
              required: false,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/exercise-catalog/media/batch': {
        post: {
          summary: 'Get exercise catalog media in batch',
          tags: ['Exercise Catalog'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    items: {
                      type: 'array',
                      maxItems: 60,
                      items: {
                        type: 'object',
                        required: ['key'],
                        properties: {
                          key: { type: 'string' },
                          exerciseId: { type: 'string' },
                          name: { type: 'string' },
                          movementPattern: { type: 'string' },
                          muscleGroup: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/body-measurements': {
        get: {
          summary: 'List body measurements',
          tags: ['Body Measurements'],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
        post: {
          summary: 'Create a body measurement',
          tags: ['Body Measurements'],
          requestBody: requestBodyFromSchema('BodyMeasurementInput'),
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/progress/summary': {
        get: {
          summary: 'Get progress summary',
          tags: ['Progress'],
          responses: {
            '200': dataEnvelopeWithSchema('ProgressSummary'),
          },
        },
      },
      '/api/v1/progress/prs': {
        get: {
          summary: 'Get personal records grouped by exercise',
          tags: ['Progress'],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/progress/muscle-volume': {
        get: {
          summary: 'Get total training volume by muscle group over the last 30 days',
          tags: ['Progress'],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/admin': {
        get: {
          summary: 'Get admin dashboard summary',
          tags: ['Admin'],
          responses: {
            '200': dataEnvelopeWithSchema('AdminSummary'),
          },
        },
      },
      '/api/v1/admin/health': {
        get: {
          summary: 'Get admin health metrics',
          tags: ['Admin'],
          responses: {
            '200': dataEnvelopeWithSchema('AdminHealth'),
          },
        },
      },
      '/api/v1/admin/catalogs/{id}/coverage': {
        get: {
          summary: 'Evaluate substantive catalog safety coverage',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          parameters: [idPathParameter],
          responses: {
            '200': dataEnvelopeResponse,
            '401': errorResponse,
            '403': errorResponse,
          },
        },
      },
      '/api/v1/admin/catalogs/{id}/red-exercises': {
        get: {
          summary: 'List approved avoid exercises for a catalog safety condition',
          tags: ['Admin'],
          parameters: [
            idPathParameter,
            { name: 'consideration', in: 'query', required: true, schema: { type: 'string' } },
            {
              name: 'severity',
              in: 'query',
              required: true,
              schema: { type: 'string', enum: ['mild', 'moderate', 'severe'] },
            },
          ],
          responses: {
            '200': dataEnvelopeResponse,
            '400': errorResponse,
            '401': errorResponse,
            '403': errorResponse,
            '404': errorResponse,
          },
        },
      },
      '/api/v1/admin/catalogs/{id}/ready': {
        post: {
          summary: 'Mark a fully reviewed catalog ready for activation',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          parameters: [idPathParameter],
          responses: {
            '200': dataEnvelopeResponse,
            '401': errorResponse,
            '403': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/v1/admin/catalogs/{id}/duplicate-reviews': {
        get: {
          summary: 'List persisted duplicate-name review groups',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          parameters: [idPathParameter],
          responses: { '200': dataEnvelopeResponse, '401': errorResponse, '403': errorResponse },
        },
      },
      '/api/v1/admin/catalogs/{id}/duplicate-reviews/{name}/resolve': {
        post: {
          summary: 'Resolve a duplicate-name group without merging source exercise IDs',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          parameters: [
            idPathParameter,
            { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reason'],
                  additionalProperties: false,
                  properties: {
                    reason: { type: 'string' },
                    reviewedBy: {
                      type: 'string',
                      deprecated: true,
                      description: 'Ignored. The response records the authenticated actor.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': dataEnvelopeResponse,
            '400': errorResponse,
            '401': errorResponse,
            '403': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/v1/admin/exercises/{id}/safety': {
        patch: {
          summary: 'Apply a reviewed manual exercise safety override',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          parameters: [idPathParameter],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['rating', 'reason', 'analysisVersion'],
                  properties: {
                    rating: { type: 'string', enum: ['recommended', 'caution', 'avoid'] },
                    reason: { type: 'string' },
                    reviewedBy: {
                      type: 'string',
                      deprecated: true,
                      description: 'Ignored. The response records the authenticated actor.',
                    },
                    analysisVersion: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': dataEnvelopeResponse,
            '400': errorResponse,
            '401': errorResponse,
            '403': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/v1/admin/exercises/{id}/catalog-metadata': {
        patch: {
          summary: 'Apply an audited manual catalog metadata override',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          parameters: [idPathParameter],
          requestBody: requestBodyFromSchema('CatalogMetadataOverrideInput'),
          responses: {
            '200': dataEnvelopeResponse,
            '400': errorResponse,
            '401': errorResponse,
            '403': errorResponse,
            '404': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/v1/admin/catalogs/{id}/activate': {
        post: {
          summary: 'Activate a reviewed catalog version',
          tags: ['Admin'],
          security: [{ bearerAuth: [] }],
          parameters: [idPathParameter],
          responses: {
            '200': dataEnvelopeResponse,
            '401': errorResponse,
            '403': errorResponse,
            '409': errorResponse,
          },
        },
      },
      '/api/v1/settings': {
        get: {
          summary: 'Get user settings',
          tags: ['Settings'],
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
        patch: {
          summary: 'Update user settings',
          tags: ['Settings'],
          requestBody: requestBodyFromSchema('UserSettingsPatchInput'),
          responses: {
            '200': dataEnvelopeResponse,
          },
        },
      },
      '/api/v1/docs': {
        get: {
          summary: 'Open Swagger UI docs',
          tags: ['Health'],
          security: [],
          responses: {
            '200': {
              description: 'Swagger UI HTML page.',
            },
          },
        },
      },
      '/api/v1/openapi.json': {
        get: {
          summary: 'Get OpenAPI specification',
          tags: ['Health'],
          security: [],
          responses: {
            '200': {
              description: 'OpenAPI JSON contract.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        DataEnvelope: {
          type: 'object',
          required: ['data'],
          properties: {
            data: {},
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                },
                message: {
                  type: 'string',
                },
                details: {
                  nullable: true,
                },
                requestId: {
                  type: 'string',
                },
              },
            },
          },
        },
        ExerciseCatalogAttributes: {
          type: 'object',
          required: [
            'movementPattern',
            'loadedRegions',
            'impactLevel',
            'spinalLoad',
            'balanceDemand',
            'technicalComplexity',
            'overhead',
            'behindNeck',
            'deepFlexion',
            'explosive',
            'unilateral',
            'rotational',
            'inverted',
          ],
          properties: {
            movementPattern: {
              type: 'string',
              enum: ['squat', 'hinge', 'push', 'pull', 'lunge', 'carry', 'core', 'mobility'],
            },
            loadedRegions: { type: 'array', items: { type: 'string' } },
            impactLevel: { type: 'string', enum: ['low', 'moderate', 'high'] },
            spinalLoad: { type: 'string', enum: ['low', 'moderate', 'high'] },
            balanceDemand: { type: 'string', enum: ['low', 'moderate', 'high'] },
            technicalComplexity: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
            },
            overhead: { type: 'boolean' },
            behindNeck: { type: 'boolean' },
            deepFlexion: { type: 'boolean' },
            explosive: { type: 'boolean' },
            unilateral: { type: 'boolean' },
            rotational: { type: 'boolean' },
            inverted: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        CatalogMetadataOverrideInput: {
          type: 'object',
          required: ['catalogVersionId', 'movementPattern', 'attributes', 'reason'],
          properties: {
            catalogVersionId: { type: 'string', minLength: 1 },
            movementPattern: {
              type: 'string',
              enum: ['squat', 'hinge', 'push', 'pull', 'lunge', 'carry', 'core', 'mobility'],
            },
            attributes: { $ref: '#/components/schemas/ExerciseCatalogAttributes' },
            reason: { type: 'string', minLength: 1 },
            reviewedBy: {
              type: 'string',
              minLength: 1,
              deprecated: true,
              description: 'Ignored. The response records the authenticated actor.',
            },
          },
          additionalProperties: false,
        },
        ApiUser: {
          type: 'object',
          required: ['id', 'email'],
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            displayName: { type: 'string' },
            role: { type: 'string' },
            roles: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        AuthRegisterInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            displayName: { type: 'string', minLength: 1, maxLength: 120 },
          },
          additionalProperties: false,
        },
        AuthLoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
        AuthRefreshInput: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
        AuthOAuthExchangeInput: {
          type: 'object',
          required: ['code', 'state'],
          properties: {
            code: { type: 'string', minLength: 1 },
            state: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
        AuthOAuthStartResponse: {
          type: 'object',
          required: ['authorizationUrl', 'state'],
          properties: {
            authorizationUrl: { type: 'string', format: 'uri' },
            state: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
        AuthTokenEnvelope: {
          type: 'object',
          required: ['accessToken', 'refreshToken', 'sessionId', 'accessExpiresAt', 'user'],
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            sessionId: { type: 'string' },
            accessExpiresAt: { type: 'string', format: 'date-time' },
            user: { $ref: '#/components/schemas/ApiUser' },
          },
          additionalProperties: false,
        },
        AuthLogoutResponse: {
          type: 'object',
          required: ['success'],
          properties: {
            success: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        AuthMeResponse: {
          type: 'object',
          required: ['user'],
          properties: {
            user: { $ref: '#/components/schemas/ApiUser' },
          },
          additionalProperties: false,
        },
        ProfileInput: {
          type: 'object',
          required: ['age', 'sex', 'heightCm', 'weightKg', 'lifestyle', 'experienceLevel'],
          properties: {
            age: { type: 'number', minimum: 13, maximum: 100 },
            sex: {
              type: 'string',
              enum: ['male', 'female', 'other', 'prefer_not_to_say'],
            },
            heightCm: { type: 'number', minimum: 100, maximum: 250 },
            weightKg: { type: 'number', minimum: 30, maximum: 300 },
            bodyFatEstimate: { type: 'number', minimum: 3, maximum: 70 },
            lifestyle: {
              type: 'string',
              enum: ['desk_job', 'standing_job', 'active'],
            },
            experienceLevel: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
            },
          },
          additionalProperties: false,
        },
        Profile: {
          allOf: [
            { $ref: '#/components/schemas/ProfileInput' },
            {
              type: 'object',
              additionalProperties: true,
            },
          ],
        },
        AssessmentInput: {
          type: 'object',
          required: ['goals', 'frequencyDays', 'equipment'],
          properties: {
            goals: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'string',
                enum: [
                  'muscle_gain',
                  'fat_loss',
                  'posture_improvement',
                  'mobility',
                  'strength',
                  'aesthetics',
                  'recomposition',
                ],
              },
            },
            frequencyDays: {
              type: 'number',
              minimum: 2,
              maximum: 5,
            },
            equipment: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'string',
                enum: ['full_gym', 'dumbbells_only', 'home_gym', 'resistance_bands'],
              },
            },
            considerations: {
              type: 'array',
              items: { $ref: '#/components/schemas/AssessmentConsideration' },
            },
            limitations: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['shoulder_pain', 'knee_pain', 'lower_back_pain', 'neck_pain'],
              },
            },
            postureFlags: {
              type: 'array',
              items: {
                type: 'string',
                enum: [
                  'rounded_shoulders',
                  'forward_head',
                  'anterior_pelvic_tilt',
                  'tight_hips',
                  'lower_back_discomfort',
                ],
              },
            },
          },
          additionalProperties: false,
        },
        Assessment: {
          type: 'object',
          required: [
            'goals',
            'frequencyDays',
            'equipment',
            'considerations',
            'limitations',
            'postureFlags',
          ],
          properties: {
            goals: { type: 'array', items: { type: 'string' } },
            frequencyDays: { type: 'number' },
            equipment: { type: 'array', items: { type: 'string' } },
            limitations: { type: 'array', items: { type: 'string' } },
            postureFlags: { type: 'array', items: { type: 'string' } },
            considerations: {
              type: 'array',
              items: { $ref: '#/components/schemas/AssessmentConsideration' },
            },
            completedAt: { type: 'string' },
            inputHash: { type: 'string' },
          },
          additionalProperties: false,
        },
        AssessmentConsideration: {
          type: 'object',
          required: ['code', 'severity', 'side', 'inferred'],
          properties: {
            code: { type: 'string' },
            severity: { type: 'string', enum: ['mild', 'moderate', 'severe'] },
            side: { type: 'string', enum: ['left', 'right', 'bilateral', 'unspecified'] },
            notes: { type: 'string' },
            inferred: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        BodyConsideration: {
          type: 'object',
          required: ['code', 'displayName', 'groupCode', 'bodyRegion', 'kind', 'severityEnabled'],
          properties: {
            code: { type: 'string' },
            displayName: { type: 'string' },
            groupCode: { type: 'string' },
            bodyRegion: { type: 'string' },
            kind: { type: 'string' },
            severityEnabled: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        GeneratePlanInput: {
          type: 'object',
          required: ['assessment'],
          properties: {
            profile: { $ref: '#/components/schemas/ProfileInput' },
            assessment: { $ref: '#/components/schemas/AssessmentInput' },
          },
          additionalProperties: false,
        },
        WorkoutSessionCreateInput: {
          type: 'object',
          required: ['workoutPlanId', 'dayIndex', 'scheduledDate'],
          properties: {
            workoutPlanId: { type: 'string' },
            dayIndex: { type: 'number' },
            scheduledDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
          additionalProperties: false,
        },
        WorkoutSessionPatchInput: {
          type: 'object',
          properties: {
            notes: { type: 'string' },
          },
          additionalProperties: false,
        },
        ExerciseLogInput: {
          type: 'object',
          required: [
            'workoutSessionId',
            'exerciseName',
            'masterExerciseId',
            'movementPattern',
            'muscleGroups',
            'setIndex',
            'reps',
            'weightKg',
          ],
          properties: {
            workoutSessionId: { type: 'string' },
            exerciseName: { type: 'string' },
            masterExerciseId: { type: 'string' },
            movementPattern: {
              type: 'string',
              enum: ['squat', 'hinge', 'push', 'pull', 'lunge', 'carry', 'core', 'mobility'],
            },
            muscleGroups: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            setIndex: { type: 'number', minimum: 1 },
            targetReps: { type: 'string' },
            reps: { type: 'number', minimum: 0 },
            weightKg: { type: 'number', minimum: 0 },
            rpe: { type: 'number', minimum: 1, maximum: 10 },
            completed: { type: 'boolean' },
            notes: { type: 'string' },
            setType: {
              type: 'string',
              enum: ['warmup', 'working', 'drop', 'failure'],
            },
          },
          additionalProperties: false,
        },
        ExerciseLogPatchInput: {
          type: 'object',
          required: ['reps', 'weightKg', 'completed'],
          properties: {
            reps: { type: 'number', minimum: 0 },
            weightKg: { type: 'number', minimum: 0 },
            rpe: { type: 'number', minimum: 1, maximum: 10 },
            completed: { type: 'boolean' },
            notes: { type: 'string' },
            setType: {
              type: 'string',
              enum: ['warmup', 'working', 'drop', 'failure'],
            },
          },
          additionalProperties: false,
        },
        SwapExerciseInput: {
          type: 'object',
          required: [
            'logGroupKey',
            'newMasterExerciseId',
            'newExerciseName',
            'newMovementPattern',
            'newMuscleGroups',
          ],
          properties: {
            logGroupKey: { type: 'string' },
            newMasterExerciseId: { type: 'string' },
            newExerciseName: { type: 'string' },
            newMovementPattern: {
              type: 'string',
              enum: ['squat', 'hinge', 'push', 'pull', 'lunge', 'carry', 'core', 'mobility'],
            },
            newMuscleGroups: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
        BodyMeasurementInput: {
          type: 'object',
          required: ['measuredAt', 'bodyWeightKg'],
          properties: {
            measuredAt: { type: 'string', format: 'date-time' },
            bodyWeightKg: { type: 'number', minimum: 0 },
            bodyFatEstimate: { type: 'number', minimum: 0, maximum: 100 },
            neckCm: { type: 'number', minimum: 0 },
            shouldersCm: { type: 'number', minimum: 0 },
            chestCm: { type: 'number', minimum: 0 },
            waistCm: { type: 'number', minimum: 0 },
            hipsCm: { type: 'number', minimum: 0 },
            upperArmLeftCm: { type: 'number', minimum: 0 },
            upperArmRightCm: { type: 'number', minimum: 0 },
            forearmLeftCm: { type: 'number', minimum: 0 },
            forearmRightCm: { type: 'number', minimum: 0 },
            thighLeftCm: { type: 'number', minimum: 0 },
            thighRightCm: { type: 'number', minimum: 0 },
            calfLeftCm: { type: 'number', minimum: 0 },
            calfRightCm: { type: 'number', minimum: 0 },
            notes: { type: 'string' },
          },
          additionalProperties: false,
        },
        UserSettingsPatchInput: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              enum: ['light', 'dark', 'system'],
            },
            unitSystem: {
              type: 'string',
              enum: ['metric', 'imperial'],
            },
            defaultWorkoutView: {
              type: 'string',
              enum: ['byExercise', 'byDay', 'byPlan'],
            },
            remindersEnabled: {
              type: 'boolean',
            },
            restTimerSeconds: {
              type: 'integer',
              minimum: 1,
              maximum: 3600,
            },
            autoStartRestTimer: {
              type: 'boolean',
            },
            restTimerSoundEnabled: {
              type: 'boolean',
            },
          },
          additionalProperties: false,
        },
        DeleteWorkoutPlanResult: {
          type: 'object',
          required: ['id', 'deleted'],
          properties: {
            id: { type: 'string' },
            deleted: { type: 'boolean' },
          },
        },
        WorkoutExercise: {
          type: 'object',
          required: ['name', 'muscleGroup', 'movementPattern', 'sets', 'reps'],
          properties: {
            name: { type: 'string' },
            muscleGroup: { type: 'string' },
            movementPattern: {
              type: 'string',
              enum: ['squat', 'hinge', 'push', 'pull', 'lunge', 'carry', 'core', 'mobility'],
            },
            sets: { type: 'number', minimum: 1 },
            reps: { type: 'string', minLength: 1 },
            rpe: { type: 'number', minimum: 1, maximum: 10 },
            notes: { type: 'string' },
            exerciseRationale: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
        WorkoutSection: {
          type: 'object',
          required: ['label', 'exercises'],
          properties: {
            label: { type: 'string', minLength: 1 },
            exercises: {
              type: 'array',
              minItems: 1,
              items: {
                $ref: '#/components/schemas/WorkoutExercise',
              },
            },
          },
          additionalProperties: false,
        },
        WorkoutDay: {
          type: 'object',
          required: ['name', 'exercises'],
          properties: {
            name: { type: 'string', minLength: 1 },
            focus: { type: 'string' },
            exercises: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/WorkoutExercise' },
            },
          },
          additionalProperties: false,
        },
        WorkoutPlanSafety: {
          type: 'object',
          required: ['disclaimer', 'redFlags', 'guidance'],
          properties: {
            disclaimer: {
              type: 'string',
              enum: ['Educational fitness recommendations only. Not medical advice.'],
            },
            redFlags: {
              type: 'array',
              items: { type: 'string' },
            },
            guidance: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
        WorkoutPlanProgression: {
          type: 'object',
          required: ['baselineIntensity', 'progressionRule'],
          properties: {
            baselineIntensity: { type: 'string', enum: ['low-moderate'] },
            progressionRule: { type: 'string', minLength: 20 },
            increasePercent: { type: 'number', minimum: 1, maximum: 100 },
            conditions: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
        WorkoutPlanLegacy: {
          type: 'object',
          required: ['split', 'frequencyDays', 'weeklySetTargets', 'days', 'warnings'],
          properties: {
            split: {
              type: 'string',
              enum: ['full_body', 'upper_lower', 'push_pull_legs', 'custom'],
            },
            frequencyDays: { type: 'number', minimum: 2, maximum: 5 },
            weeklySetTargets: {
              type: 'object',
              additionalProperties: {
                type: 'number',
                minimum: 0,
              },
            },
            days: {
              type: 'array',
              minItems: 1,
              items: { $ref: '#/components/schemas/WorkoutDay' },
            },
            warnings: {
              type: 'array',
              items: { type: 'string' },
            },
            summary: { type: 'string' },
            progressionRules: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: false,
        },
        WorkoutPlanStrict: {
          allOf: [
            { $ref: '#/components/schemas/WorkoutPlanLegacy' },
            {
              type: 'object',
              required: ['warmup', 'mainSet', 'cooldown', 'safety', 'progression'],
              properties: {
                warmup: {
                  type: 'array',
                  minItems: 1,
                  items: { $ref: '#/components/schemas/WorkoutSection' },
                },
                mainSet: {
                  type: 'array',
                  minItems: 1,
                  items: { $ref: '#/components/schemas/WorkoutSection' },
                },
                cooldown: {
                  type: 'array',
                  minItems: 1,
                  items: { $ref: '#/components/schemas/WorkoutSection' },
                },
                safety: { $ref: '#/components/schemas/WorkoutPlanSafety' },
                progression: { $ref: '#/components/schemas/WorkoutPlanProgression' },
              },
            },
          ],
        },
        WorkoutPlan: {
          oneOf: [
            { $ref: '#/components/schemas/WorkoutPlanLegacy' },
            { $ref: '#/components/schemas/WorkoutPlanStrict' },
          ],
        },
        WorkoutPlanResult: {
          type: 'object',
          required: [
            'id',
            'source',
            'model',
            'plan',
            'warnings',
            'createdAt',
            'inputHash',
            'cached',
          ],
          properties: {
            id: { type: 'string' },
            source: { type: 'string', enum: ['ai', 'fallback'] },
            model: { type: 'string' },
            plan: { $ref: '#/components/schemas/WorkoutPlan' },
            warnings: {
              type: 'array',
              items: { type: 'string' },
            },
            generation: { $ref: '#/components/schemas/WorkoutPlanGenerationDiagnostics' },
            createdAt: { type: 'string' },
            inputHash: { type: 'string' },
            cached: { type: 'boolean' },
          },
          additionalProperties: false,
        },
        WorkoutPlanGenerationDiagnostics: {
          type: 'object',
          required: ['fallbackUsed'],
          properties: {
            fallbackUsed: { type: 'boolean' },
            errorCode: {
              type: 'string',
              enum: ['rate_limited', 'provider_timeout', 'provider_error', 'fallback_used'],
            },
          },
          additionalProperties: false,
        },
        ProgressSummary: {
          type: 'object',
          required: [
            'workoutsCompletedThisWeek',
            'streakDays',
            'personalRecords',
            'totalVolumeThisWeek',
            'plateauDetected',
            'complianceScore',
            'warnings',
          ],
          properties: {
            workoutsCompletedThisWeek: { type: 'number', minimum: 0 },
            streakDays: { type: 'number', minimum: 0 },
            personalRecords: { type: 'number', minimum: 0 },
            totalVolumeThisWeek: { type: 'number', minimum: 0 },
            plateauDetected: { type: 'boolean' },
            complianceScore: { type: 'number', minimum: 0, maximum: 100 },
            warnings: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          additionalProperties: true,
        },
        AdminSummary: {
          type: 'object',
          required: ['requestedAt', 'userId', 'canAccessInternalOps', 'features', 'dataQuality'],
          properties: {
            requestedAt: { type: 'string' },
            userId: { type: 'string' },
            canAccessInternalOps: { type: 'boolean' },
            features: {
              type: 'array',
              items: { type: 'string' },
            },
            dataQuality: {
              type: 'object',
              required: [
                'plateauDetectionEnabled',
                'trustSignalsTracked',
                'postureAnalysisAvailable',
              ],
              properties: {
                plateauDetectionEnabled: { type: 'boolean' },
                trustSignalsTracked: { type: 'boolean' },
                postureAnalysisAvailable: { type: 'boolean' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: true,
        },
        AdminHealth: {
          type: 'object',
          required: ['ok', 'route', 'requestedAt'],
          properties: {
            ok: { type: 'boolean' },
            route: { type: 'string' },
            requestedAt: { type: 'string' },
          },
          additionalProperties: true,
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  };
}
