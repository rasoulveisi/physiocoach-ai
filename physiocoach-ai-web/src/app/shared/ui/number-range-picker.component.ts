import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';

interface NumberPickerOption {
  label: string;
  value: number | undefined;
}

interface NumberPickerSlot {
  option: NumberPickerOption | null;
  offset: number;
}

@Component({
  selector: 'pc-number-range-picker',
  standalone: true,
  imports: [ButtonModule, FormsModule, SelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './number-range-picker.component.html',
  styleUrls: ['./number-range-picker.component.css'],
})
export class NumberRangePickerComponent implements OnDestroy {
  private static idCounter = 1;
  private static readonly dragThresholdPx = 28;
  private static readonly dragClickSuppressionMs = 0;
  private dragStartY: number | null = null;
  private dragChanged = false;
  private ignoreNextWheelClick = false;
  private ignoreNextWheelClickTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly label = input.required<string>();
  readonly value = input<number | null | undefined>(null);
  readonly min = input<number>(13);
  readonly max = input<number>(100);
  readonly step = input<number>(1);
  readonly unit = input<string>('');
  readonly error = input<string | null>(null);
  readonly hint = input<string | null>(null);
  readonly confirmHint = input<string | null>(null);
  readonly mode = input<'sheet' | 'inline'>('inline');
  readonly allowEmpty = input<boolean>(false);
  readonly emptyLabel = input<string>('Not sure');

  readonly valueChange = output<number | undefined>();
  readonly done = output<number | undefined>();

  protected readonly selectedValue = signal<number | undefined>(13);
  protected readonly sheetOpen = signal(false);
  protected readonly panelId = `number-range-picker-panel-${NumberRangePickerComponent.idCounter++}`;
  protected readonly wheelId = `number-range-picker-wheel-${NumberRangePickerComponent.idCounter++}`;

  private readonly safeMin = computed(() => {
    const min = this.min();
    return Number.isFinite(min) ? min : 13;
  });

  private readonly safeMax = computed(() => {
    const max = this.max();
    const min = this.safeMin();
    if (!Number.isFinite(max) || max < min) {
      return min;
    }
    return max;
  });

  protected readonly safeStep = computed(() => {
    const step = this.step();
    return Number.isFinite(step) && step > 0 ? Math.max(1, Math.floor(step)) : 1;
  });

  protected readonly options = computed<NumberPickerOption[]>(() => {
    const values: NumberPickerOption[] = [];
    const min = this.safeMin();
    const max = this.safeMax();
    const step = this.safeStep();

    if (this.allowEmpty()) {
      values.push({ label: this.emptyLabel(), value: undefined });
    }

    for (let current = min; current <= max; current += step) {
      values.push({ label: this.formatValue(current), value: current });
    }
    return values;
  });

  protected readonly panelOpen = computed(() => this.mode() === 'inline' || this.sheetOpen());

  protected readonly selectedIndex = computed(() => {
    const selected = this.selectedValue();
    const index = this.options().findIndex((option) => option.value === selected);

    return index >= 0 ? index : 0;
  });

  protected readonly visibleSlots = computed<NumberPickerSlot[]>(() => {
    const options = this.options();
    const selectedIndex = this.selectedIndex();
    const slots: NumberPickerSlot[] = [];

    for (let offset = -2; offset <= 2; offset += 1) {
      slots.push({
        option: options[selectedIndex + offset] ?? null,
        offset,
      });
    }

    return slots;
  });

  protected readonly selectedLabel = computed(() => {
    const value = this.selectedValue();

    if (value === undefined) {
      return this.emptyLabel();
    }

    return this.formatValue(value);
  });

  constructor() {
    effect(() => {
      const value = this.value();
      const normalized = this.clampValue(value);
      this.selectedValue.set(normalized);
    });
  }

  ngOnDestroy(): void {
    this.clearWheelClickSuppression();
  }

  protected onRowClick(): void {
    if (this.mode() === 'sheet') {
      this.sheetOpen.set(true);
    }
  }

  protected onValueSelect(optionValue: number | undefined): void {
    const next = this.clampValue(optionValue);
    this.selectedValue.set(next);
    this.valueChange.emit(next);
  }

  protected onDesktopValueSelect(optionValue: number | undefined): void {
    this.onValueSelect(optionValue);
  }

  protected onWheelOptionClick(slot: NumberPickerSlot): void {
    if (this.ignoreNextWheelClick) {
      this.clearWheelClickSuppression();
      return;
    }

    if (slot.option === null) {
      return;
    }

    if (slot.offset === 0) {
      this.onDone();
      return;
    }

    this.onValueSelect(slot.option.value);
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();

    if (event.deltaY > 0) {
      this.moveSelection(1, 'immediate');
    } else if (event.deltaY < 0) {
      this.moveSelection(-1, 'immediate');
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.moveSelection(1, 'immediate');
      return;
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.moveSelection(-1, 'immediate');
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.selectIndex(0, 'immediate');
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.selectIndex(this.options().length - 1, 'immediate');
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    this.dragStartY = event.clientY;
    this.dragChanged = false;
    this.clearWheelClickSuppression();
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.dragStartY === null) {
      return;
    }

    const deltaY = event.clientY - this.dragStartY;
    if (Math.abs(deltaY) < NumberRangePickerComponent.dragThresholdPx) {
      return;
    }

    event.preventDefault();
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    this.moveSelection(deltaY > 0 ? -1 : 1, 'silent');
    this.dragChanged = true;
    this.dragStartY = event.clientY;
  }

  protected onPointerEnd(): void {
    if (this.dragChanged) {
      this.suppressNextWheelClickBriefly();
      this.valueChange.emit(this.selectedValue());
    }

    this.dragStartY = null;
    this.dragChanged = false;
  }

  protected onDone(): void {
    this.done.emit(this.selectedValue());
    this.sheetOpen.set(false);
  }

  protected clampValue(value: number | null | undefined): number | undefined {
    const min = this.safeMin();
    const max = this.safeMax();
    const step = this.safeStep();
    const span = max - min;

    if ((value === null || value === undefined) && this.allowEmpty()) {
      return undefined;
    }

    if (!Number.isFinite(value as number) || value === null || value === undefined) {
      return min;
    }

    if (span <= 0) {
      return min;
    }

    const normalizedValue = Math.min(max, Math.max(min, value));
    const normalizedOffset = normalizedValue - min;
    const stepIndex = Math.round(normalizedOffset / step);
    const snapped = min + stepIndex * step;

    if (snapped < min) {
      return min;
    }
    if (snapped > max) {
      return max;
    }
    return snapped;
  }

  private formatValue(value: number): string {
    const unit = this.unit();
    return unit ? `${value} ${unit}` : `${value}`;
  }

  private suppressNextWheelClickBriefly(): void {
    this.clearWheelClickSuppression();
    this.ignoreNextWheelClick = true;
    this.ignoreNextWheelClickTimeout = setTimeout(() => {
      this.clearWheelClickSuppression();
    }, NumberRangePickerComponent.dragClickSuppressionMs);
  }

  private clearWheelClickSuppression(): void {
    this.ignoreNextWheelClick = false;

    if (this.ignoreNextWheelClickTimeout === null) {
      return;
    }

    clearTimeout(this.ignoreNextWheelClickTimeout);
    this.ignoreNextWheelClickTimeout = null;
  }

  private moveSelection(direction: -1 | 1, commit: 'immediate' | 'silent'): void {
    this.selectIndex(this.selectedIndex() + direction, commit);
  }

  private selectIndex(index: number, commit: 'immediate' | 'silent' = 'immediate'): void {
    const options = this.options();
    if (options.length === 0) {
      return;
    }

    const boundedIndex = Math.min(options.length - 1, Math.max(0, index));
    const next = options[boundedIndex]?.value;

    if (next === this.selectedValue()) {
      return;
    }

    this.selectedValue.set(next);
    if (commit === 'silent') {
      return;
    }

    this.valueChange.emit(next);
  }
}
