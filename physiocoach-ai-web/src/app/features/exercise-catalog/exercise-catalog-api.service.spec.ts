import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClient } from '../../core/api/api-client';
import { ExerciseCatalogApiService } from './exercise-catalog-api.service';

describe('ExerciseCatalogApiService', () => {
  let api: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let service: ExerciseCatalogApiService;

  beforeEach(() => {
    api = {
      get: vi.fn(() =>
        of({
          data: {
            exerciseId: 'ex-goblet-squat',
            name: 'Goblet squat',
            thumbnailUrl: 'https://media.physiocoach.test/catalog/goblet-squat-thumb.webp',
            animatedGifUrl: 'https://media.physiocoach.test/catalog/goblet-squat.gif',
          },
        }),
      ),
      post: vi.fn(() =>
        of({
          data: {
            'card-1': {
              exerciseId: 'ex-goblet-squat',
              name: 'Goblet squat',
              thumbnailUrl: 'https://media.physiocoach.test/catalog/goblet-squat-thumb.webp',
            },
          },
        }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: ApiClient, useValue: api }],
    });

    service = TestBed.inject(ExerciseCatalogApiService);
  });

  it('loads exercise media from the catalog endpoint with compact query params', () => {
    const received: unknown[] = [];

    service
      .loadExerciseMedia({
        exerciseId: 'ex-goblet-squat',
        name: '  Goblet squat  ',
        movementPattern: '',
        muscleGroup: 'quadriceps',
      })
      .subscribe((value) => received.push(value));

    expect(api.get).toHaveBeenCalledWith('/exercise-catalog/media', {
      params: {
        exerciseId: 'ex-goblet-squat',
        name: 'Goblet squat',
        muscleGroup: 'quadriceps',
      },
    });
    expect(received).toEqual([
      {
        exerciseId: 'ex-goblet-squat',
        name: 'Goblet squat',
        thumbnailUrl: 'https://media.physiocoach.test/catalog/goblet-squat-thumb.webp',
        animatedGifUrl: 'https://media.physiocoach.test/catalog/goblet-squat.gif',
      },
    ]);
  });

  it('loads exercise media in one batch request with compact items', () => {
    const received: unknown[] = [];

    service
      .loadExerciseMediaBatch([
        {
          key: 'card-1',
          exerciseId: 'ex-goblet-squat',
          name: '  Goblet squat  ',
          movementPattern: '',
          muscleGroup: 'quadriceps',
        },
      ])
      .subscribe((value) => received.push(value));

    expect(api.post).toHaveBeenCalledWith('/exercise-catalog/media/batch', {
      items: [
        {
          key: 'card-1',
          exerciseId: 'ex-goblet-squat',
          name: 'Goblet squat',
          muscleGroup: 'quadriceps',
        },
      ],
    });
    expect(received).toEqual([
      {
        'card-1': {
          exerciseId: 'ex-goblet-squat',
          name: 'Goblet squat',
          thumbnailUrl: 'https://media.physiocoach.test/catalog/goblet-squat-thumb.webp',
        },
      },
    ]);
  });
});
