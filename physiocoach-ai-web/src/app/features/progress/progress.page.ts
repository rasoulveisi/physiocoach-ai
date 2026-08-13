import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Chart, ChartConfiguration, ChartData } from 'chart.js';

import { DisclaimerComponent } from '../../shared/ui/disclaimer.component';
import { MetricTileComponent } from '../../shared/ui/metric-tile.component';
import { SkeletonBlockComponent } from '../../shared/ui/skeleton-block.component';
import type { PersonalRecord, PersonalRecordType } from './progress.model';
import { ProgressStore } from './progress.store';

interface WeeklyVolumeBucket {
  day: string;
  volume: number;
}

interface StreakHeatmapCell {
  day: string;
  level: 0 | 1 | 2 | 3 | 4;
}

interface BodyWeightPoint {
  dateLabel: string;
  weight: number;
}

interface PrMetric {
  recordType: PersonalRecordType;
  label: string;
  value: number;
  valueLabel: string;
  detail: string | null;
  achievedLabel: string;
}

interface PrShowcaseEntry {
  exerciseName: string;
  metrics: PrMetric[];
}

interface MuscleVolumeBucket {
  label: string;
  volume: number;
  pct: number;
  barColorClass: string;
}

interface MuscleGroupCategory {
  label: string;
  aliases: string[];
  barColorClass: string;
}

const PR_METRIC_ORDER: PersonalRecordType[] = ['epley_1rm', 'max_weight', 'max_volume'];

const MUSCLE_GROUP_CATEGORIES: MuscleGroupCategory[] = [
  { label: 'Chest', aliases: ['chest', 'pec', 'pectoral'], barColorClass: 'bg-rose-500' },
  {
    label: 'Back',
    aliases: ['back', 'latissimus', 'lats', 'dorsi', 'rhomboid', 'trap', 'teres', 'infraspinatus'],
    barColorClass: 'bg-sky-500',
  },
  {
    label: 'Quads',
    aliases: ['quad', 'vastus', 'rectus femoris', 'sartorius'],
    barColorClass: 'bg-brand-500',
  },
  {
    label: 'Hamstrings',
    aliases: [
      'hamstring',
      'biceps femoris',
      'semitendinosus',
      'semimembranosus',
      'glute',
      'adductor',
    ],
    barColorClass: 'bg-violet-500',
  },
  {
    label: 'Shoulders',
    aliases: ['shoulder', 'delt', 'deltoid', 'rotator cuff'],
    barColorClass: 'bg-amber-500',
  },
  {
    label: 'Arms',
    aliases: ['bicep', 'tricep', 'brachii', 'brachialis', 'forearm', 'brachioradialis'],
    barColorClass: 'bg-emerald-500',
  },
  {
    label: 'Core',
    aliases: ['core', 'abdom', 'abs', 'oblique', 'transversus', 'erector', 'lower back'],
    barColorClass: 'bg-fuchsia-500',
  },
  {
    label: 'Calves',
    aliases: ['calf', 'calv', 'gastrocnemius', 'soleus', 'tibialis'],
    barColorClass: 'bg-cyan-500',
  },
];

@Component({
  standalone: true,
  imports: [RouterLink, MetricTileComponent, DisclaimerComponent, SkeletonBlockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress.page.html',
})
export class ProgressPage implements OnInit, AfterViewInit, OnDestroy {
  protected readonly progress = inject(ProgressStore);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('weeklyVolumeCanvas')
  private readonly weeklyVolumeCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly chartLibraryReady = signal<Promise<typeof import('chart.js/auto')> | null>(null);
  private readonly chartsReady = signal(false);
  private readonly maxStreakHeatmapDays = 7;

  private weeklyVolumeChart: Chart | null = null;

  protected readonly canRenderCharts = computed(() => isPlatformBrowser(this.platformId));
  protected readonly weeklyVolumeBuckets = computed(() =>
    this.buildConservativeWeeklyVolumeBuckets(this.progress.summary()),
  );
  protected readonly streakHeatmapCells = computed(() =>
    this.buildGitHubStyleStreakHeatmap(this.progress.summary().streakDays),
  );
  protected readonly bodyWeightPointForDisplay = computed(() => {
    const latest = this.progress.latestBodyMeasurement();
    if (!latest || !Number.isFinite(latest.bodyWeightKg)) {
      return null;
    }

    return {
      dateLabel: this.toReadableDate(latest.measuredAt),
      weight: Number(latest.bodyWeightKg.toFixed(1)),
    } satisfies BodyWeightPoint;
  });

  protected readonly prShowcase = computed<PrShowcaseEntry[]>(() =>
    this.progress
      .personalRecords()
      .map((group) => ({
        exerciseName: group.exerciseName,
        metrics: this.buildPrMetrics(group.records),
      }))
      .filter((entry) => entry.metrics.length > 0)
      .sort((a, b) => {
        const aOneRm = a.metrics.find((metric) => metric.recordType === 'epley_1rm')?.value ?? -1;
        const bOneRm = b.metrics.find((metric) => metric.recordType === 'epley_1rm')?.value ?? -1;
        return bOneRm - aOneRm || a.exerciseName.localeCompare(b.exerciseName);
      }),
  );

  protected readonly muscleVolumeBuckets = computed<MuscleVolumeBucket[]>(() =>
    this.buildMuscleVolumeBuckets(this.progress.muscleVolume()),
  );

  protected readonly muscleVolumeTotal = computed(() =>
    this.muscleVolumeBuckets().reduce((sum, bucket) => sum + bucket.volume, 0),
  );

  protected readonly hasMuscleVolumeData = computed(() => this.muscleVolumeTotal() > 0);

  protected readonly muscleVolumeInsights = computed<string[]>(() =>
    this.buildMuscleBalanceInsights(this.muscleVolumeBuckets()),
  );

  constructor() {
    effect(() => {
      const weeklyVolumeBuckets = this.weeklyVolumeBuckets();

      if (!this.canRenderCharts() || !this.chartsReady()) {
        return;
      }

      void this.renderCharts(weeklyVolumeBuckets);
    });
  }

  ngOnInit(): void {
    this.progress.ensureProgressData();
  }

  ngAfterViewInit(): void {
    this.chartsReady.set(true);
    void this.renderCharts(this.weeklyVolumeBuckets());
  }

  ngOnDestroy(): void {
    this.destroyChart(this.weeklyVolumeChart);
  }

  protected streakCellClasses(level: 0 | 1 | 2 | 3 | 4): string {
    if (!level) {
      return 'bg-surface-muted border-surface-border text-muted';
    }

    if (level === 1) {
      return 'bg-brand-100 border-brand-200 text-brand-700 dark:bg-brand-950/80 dark:border-brand-900 dark:text-brand-300';
    }

    if (level === 2) {
      return 'bg-brand-200 border-brand-300 text-brand-800 dark:bg-brand-900/60 dark:border-brand-800 dark:text-brand-200';
    }

    if (level === 3) {
      return 'bg-brand-300 border-brand-400 text-brand-900 dark:bg-brand-800/55 dark:border-brand-700 dark:text-brand-100';
    }

    return 'bg-brand-600 border-brand-700 text-white dark:bg-brand-700 dark:border-brand-500';
  }

  protected streakCellAriaLabel(streak: StreakHeatmapCell, totalStreak: number): string {
    if (!streak.level) {
      return `${streak.day}: no activity`;
    }

    if (totalStreak <= 0) {
      return `${streak.day}: no streak`;
    }

    return `${streak.day}: active, current streak ${totalStreak} days`;
  }

  protected maxStreakValue(): number {
    return Math.max(0, this.progress.summary().streakDays);
  }

  protected readonly weeklyVolumeBucketCount = computed(() => this.weeklyVolumeBuckets().length);

  private buildPrMetrics(records: PersonalRecord[]): PrMetric[] {
    const bestByType = new Map<string, PersonalRecord>();
    for (const record of records) {
      const existing = bestByType.get(record.recordType);
      if (!existing || Number(record.value) > Number(existing.value)) {
        bestByType.set(record.recordType, record);
      }
    }

    return PR_METRIC_ORDER.flatMap((type) => {
      const record = bestByType.get(type);
      if (!record || !Number.isFinite(Number(record.value))) {
        return [];
      }

      return [
        {
          recordType: type,
          label: this.prMetricLabel(type),
          value: Number(record.value),
          valueLabel: this.prMetricValueLabel(record),
          detail: this.prMetricDetail(type, record),
          achievedLabel: this.toAchievementDate(record.achievedAt),
        } satisfies PrMetric,
      ];
    });
  }

  private prMetricLabel(type: PersonalRecordType): string {
    switch (type) {
      case 'epley_1rm':
        return 'Est. 1RM (Epley)';
      case 'max_weight':
        return 'Max weight';
      case 'max_volume':
        return 'Max volume';
      default:
        return 'Record';
    }
  }

  private prMetricValueLabel(record: PersonalRecord): string {
    return `${this.formatNumber(Number(record.value))} kg`;
  }

  private prMetricDetail(type: PersonalRecordType, record: PersonalRecord): string | null {
    const weight = record.weightKg;
    const reps = record.reps;
    const hasWeight = weight !== null && weight !== undefined && Number.isFinite(Number(weight));
    const hasReps = reps !== null && reps !== undefined && Number.isFinite(Number(reps));

    if (type === 'max_weight') {
      return hasReps ? `${reps} reps` : null;
    }

    if (type === 'epley_1rm' || type === 'max_volume') {
      if (hasWeight && hasReps) {
        return `${this.formatNumber(Number(weight))} kg × ${reps} reps`;
      }
    }

    return null;
  }

  private buildMuscleVolumeBuckets(
    entries: { muscleGroup: string; volume: number }[],
  ): MuscleVolumeBucket[] {
    const totals = new Map<string, number>();
    let otherVolume = 0;

    for (const entry of entries) {
      const volume = Number(entry.volume);
      if (!Number.isFinite(volume) || volume <= 0) {
        continue;
      }

      const label = this.normalizeMuscleGroup(entry.muscleGroup);
      if (label) {
        totals.set(label, (totals.get(label) ?? 0) + volume);
      } else {
        otherVolume += volume;
      }
    }

    const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0) + otherVolume;

    const buckets = MUSCLE_GROUP_CATEGORIES.map((category) => {
      const volume = totals.get(category.label) ?? 0;
      return {
        label: category.label,
        volume,
        pct: total > 0 ? (volume / total) * 100 : 0,
        barColorClass: category.barColorClass,
      };
    });

    if (otherVolume > 0) {
      buckets.push({
        label: 'Other',
        volume: otherVolume,
        pct: total > 0 ? (otherVolume / total) * 100 : 0,
        barColorClass: 'bg-slate-400',
      });
    }

    return buckets;
  }

  private normalizeMuscleGroup(raw: string): string | null {
    const normalized = raw.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    for (const category of MUSCLE_GROUP_CATEGORIES) {
      if (category.aliases.some((alias) => normalized.includes(alias))) {
        return category.label;
      }
    }

    return null;
  }

  private buildMuscleBalanceInsights(buckets: MuscleVolumeBucket[]): string[] {
    const trained = buckets.filter((bucket) => bucket.volume > 0);
    if (trained.length === 0) {
      return [];
    }

    const insights: string[] = [];
    const dominant = trained.reduce((top, bucket) => (bucket.volume > top.volume ? bucket : top));

    insights.push(
      `${dominant.label} leads your training at ${dominant.pct.toFixed(0)}% of total volume.`,
    );

    const weakest = trained.reduce((bottom, bucket) =>
      bucket.volume < bottom.volume ? bucket : bottom,
    );

    if (weakest.label !== dominant.label && dominant.pct >= weakest.pct * 2) {
      insights.push(
        `${weakest.label} trails at ${weakest.pct.toFixed(0)}% — consider adding more volume there.`,
      );
    }

    const pushVolume =
      this.sumMuscleVolume(buckets, ['Chest', 'Shoulders', 'Quads']);
    const pullVolume =
      this.sumMuscleVolume(buckets, ['Back', 'Hamstrings']);
    if (pushVolume > 0 && pullVolume > 0 && pushVolume >= pullVolume * 1.5) {
      insights.push('Pushing volume noticeably outpaces pulling — add rows, pulls, or hinge work.');
    } else if (pullVolume > 0 && pushVolume > 0 && pullVolume >= pushVolume * 1.5) {
      insights.push('Pulling volume noticeably outpaces pushing — balance with presses and squats.');
    }

    return insights;
  }

  private sumMuscleVolume(buckets: MuscleVolumeBucket[], labels: string[]): number {
    return buckets
      .filter((bucket) => labels.includes(bucket.label))
      .reduce((sum, bucket) => sum + bucket.volume, 0);
  }

  protected formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
      return '0';
    }

    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  private toAchievementDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Recorded';
    }

    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private async renderCharts(weeklyVolumeBuckets: WeeklyVolumeBucket[]): Promise<void> {
    const module = await this.getChartLibrary();
    if (!module) {
      return;
    }

    const Chart = module.Chart;
    this.renderWeeklyVolumeChart(Chart, weeklyVolumeBuckets);
  }

  private async getChartLibrary(): Promise<typeof import('chart.js/auto') | null> {
    if (!this.canRenderCharts()) {
      return null;
    }

    if (!this.chartLibraryReady()) {
      this.chartLibraryReady.set(import('chart.js/auto'));
    }

    try {
      return await this.chartLibraryReady();
    } catch {
      return null;
    }
  }

  private renderWeeklyVolumeChart(
    Chart: typeof import('chart.js/auto').Chart,
    weeklyVolumeBuckets: WeeklyVolumeBucket[],
  ): void {
    const canvas = this.weeklyVolumeCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const labels = weeklyVolumeBuckets.map((bucket) => bucket.day);
    const data = weeklyVolumeBuckets.map((bucket) => bucket.volume);

    const chartData: ChartData<'bar'> = {
      labels,
      datasets: [
        {
          data,
          label: 'Weekly volume (kg)',
          backgroundColor: 'rgb(79 70 229 / 0.75)',
          borderColor: 'rgb(79 70 229)',
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 'flex',
        },
      ],
    };

    const chartConfig: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: chartData,
      options: {
        animation: false,
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context): string => `${Number(context.parsed.y).toFixed(1)} kg`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.22)' },
            ticks: { color: 'rgb(71, 85, 105)' },
            title: {
              display: true,
              text: 'kg',
              color: 'rgb(71, 85, 105)',
            },
          },
          x: {
            ticks: { color: 'rgb(71, 85, 105)' },
            grid: { display: false },
          },
        },
      },
    };

    if (this.weeklyVolumeChart) {
      this.weeklyVolumeChart.data = chartData;
      this.weeklyVolumeChart.update();
      return;
    }

    this.weeklyVolumeChart = new Chart(context, chartConfig);
  }

  private destroyChart(chart: Chart | null): void {
    if (!chart) {
      return;
    }

    chart.destroy();
  }

  private buildConservativeWeeklyVolumeBuckets(summary: {
    totalVolumeThisWeek: number;
    workoutsCompletedThisWeek: number;
  }): WeeklyVolumeBucket[] {
    const labels = this.lastWeekDayLabels();
    const totalVolumeThisWeek = Number(summary.totalVolumeThisWeek ?? 0);
    const completedWorkoutsThisWeek = Number(summary.workoutsCompletedThisWeek ?? 0);
    const safeTotalVolume = Number.isFinite(totalVolumeThisWeek)
      ? Math.max(totalVolumeThisWeek, 0)
      : 0;
    const safeCompletedWorkouts = Number.isFinite(completedWorkoutsThisWeek)
      ? Math.max(Math.floor(completedWorkoutsThisWeek), 0)
      : 0;
    const activeWorkoutDays = Math.min(this.maxStreakHeatmapDays, safeCompletedWorkouts);

    const values = new Array<number>(this.maxStreakHeatmapDays).fill(0);
    if (!activeWorkoutDays || !safeTotalVolume) {
      return labels.map((day) => ({ day, volume: 0 }));
    }

    const averageVolumePerActiveDay = safeTotalVolume / activeWorkoutDays;
    const startActiveIndex = labels.length - activeWorkoutDays;
    for (let i = 0; i < activeWorkoutDays; i += 1) {
      const labelIndex = startActiveIndex + i;
      values[labelIndex] = Number(averageVolumePerActiveDay.toFixed(2));
    }

    return labels.map((day, index) => ({
      day,
      volume: values[index] || 0,
    }));
  }

  private buildGitHubStyleStreakHeatmap(streakDays: number): StreakHeatmapCell[] {
    const safeStreakDays = Number.isFinite(streakDays) ? Math.max(Math.floor(streakDays), 0) : 0;
    const activeDays = Math.min(this.maxStreakHeatmapDays, safeStreakDays);
    const activeStart = this.maxStreakHeatmapDays - activeDays;
    const days = this.lastWeekDayLabels();

    return days.map((day, index) => {
      if (index < activeStart) {
        return { day, level: 0 };
      }

      const activeOffset = index - activeStart;
      const progressRatio = activeDays <= 1 ? 0 : activeOffset / Math.max(activeDays - 1, 1);
      const intensity = (Math.floor(progressRatio * 3) + 1) as 1 | 2 | 3 | 4;

      return { day, level: intensity };
    });
  }

  private lastWeekDayLabels(): string[] {
    const today = new Date();
    const labels = new Array(this.maxStreakHeatmapDays).fill('');
    for (let index = this.maxStreakHeatmapDays - 1; index >= 0; index -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - index);
      labels[this.maxStreakHeatmapDays - 1 - index] = day.toLocaleDateString(undefined, {
        weekday: 'short',
      });
    }

    return labels;
  }

  private toReadableDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Recorded';
    }

    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  }
}
