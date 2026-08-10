import { TestBed } from '@angular/core/testing';

import { ExerciseVisualComponent } from './exercise-visual.component';

describe('ExerciseVisualComponent', () => {
  function render(compact: boolean): { host: HTMLElement; stage: HTMLElement } {
    const fixture = TestBed.createComponent(ExerciseVisualComponent);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const stage = host.querySelector('figure[data-exercise-visual] > div');
    expect(stage).not.toBeNull();

    return { host, stage: stage as HTMLElement };
  }

  it('renders an adaptive padded safe frame when expanded', () => {
    const { host, stage } = render(false);

    expect(host.classList).toContain('block');
    expect(host.classList).toContain('min-w-0');
    expect(stage.classList).toContain('aspect-[4/3]');
    expect(stage.classList).toContain('sm:aspect-[3/2]');
    expect(stage.classList).toContain('lg:aspect-[16/9]');
    expect(stage.classList).toContain('p-2');
    expect(stage.classList).toContain('sm:p-3');
  });

  it('keeps the compact stage at 56 pixels without expanded safe-frame classes', () => {
    const { stage } = render(true);

    expect(stage.classList).toContain('h-14');
    expect(stage.classList).toContain('w-14');
    expect(stage.classList).not.toContain('aspect-[4/3]');
    expect(stage.classList).not.toContain('p-2');
  });
});
