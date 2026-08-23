import type { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'card' | 'circle' | 'text' | 'button';
}

export function Skeleton({ className, variant = 'default', ...props }: SkeletonProps) {
  const variantStyles = {
    default: 'rounded-xl bg-zinc-800/60',
    card: 'rounded-3xl border border-zinc-800/80 bg-zinc-900/60',
    circle: 'rounded-full bg-zinc-800/60',
    text: 'h-4 rounded-md bg-zinc-800/60',
    button: 'h-12 rounded-full bg-zinc-800/60',
  }[variant];

  return (
    <div
      className={clsx('animate-pulse', variantStyles, className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="h-full w-full max-w-2xl mx-auto flex-1 overflow-y-auto min-h-0 space-y-7 p-4 pb-8 sm:p-6">
      {/* Profile Header Skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton variant="circle" className="size-10" />
          <div className="space-y-1.5">
            <Skeleton variant="text" className="h-5 w-40 sm:w-48" />
            <Skeleton variant="text" className="h-3 w-28" />
          </div>
        </div>
        <Skeleton variant="circle" className="size-10" />
      </div>

      {/* Calendar Strip Skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" className="h-5 w-32" />
          <Skeleton variant="text" className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Hero Workout Plan Card Skeleton */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" className="h-4 w-28 rounded-full" />
          <Skeleton variant="text" className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          <Skeleton variant="text" className="h-7 w-3/4" />
          <Skeleton variant="text" className="h-4 w-1/2" />
        </div>
        <div className="flex items-center gap-4 pt-2">
          <Skeleton variant="button" className="h-11 w-36" />
          <Skeleton variant="text" className="h-4 w-24" />
        </div>
      </div>

      {/* Telemetry / Joint Rings Skeleton */}
      <div className="space-y-3">
        <Skeleton variant="text" className="h-5 w-44" />
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton variant="circle" className="size-14" />
              <Skeleton variant="text" className="h-2 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity Skeleton */}
      <div className="space-y-3">
        <Skeleton variant="text" className="h-5 w-36" />
        <div className="space-y-2.5">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="h-full w-full max-w-2xl mx-auto flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 sm:px-6 sm:py-6 space-y-6">
        {/* Schedule Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton variant="text" className="h-6 w-32" />
            <Skeleton variant="text" className="h-3 w-28" />
          </div>
          <Skeleton variant="circle" className="size-9" />
        </div>

        {/* Schedule Days Strip Skeleton */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>

        {/* Day Overview Card Skeleton */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton variant="text" className="h-5 w-40" />
            <Skeleton variant="text" className="h-4 w-20" />
          </div>
          <div className="flex gap-2">
            <Skeleton variant="text" className="h-6 w-20 rounded-full" />
            <Skeleton variant="text" className="h-6 w-24 rounded-full" />
          </div>
        </div>

        {/* Exercise List Skeleton */}
        <div className="space-y-3">
          <Skeleton variant="text" className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-zinc-800 bg-zinc-900 p-3.5">
              <Skeleton className="h-16 w-24 sm:w-32 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="h-4 w-3/4" />
                <Skeleton variant="text" className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="h-full w-full max-w-2xl mx-auto flex flex-col overflow-hidden">
      <div className="shrink-0 p-4 sm:p-6 pb-2">
        <div className="flex items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <Skeleton variant="circle" className="size-14 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="h-5 w-36" />
            <Skeleton variant="text" className="h-3 w-48" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 sm:px-6 py-2 space-y-6 pb-6">
        {/* Section 1 skeleton */}
        <div className="space-y-2">
          <Skeleton variant="text" className="h-3 w-36" />
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800/60">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circle" className="size-8" />
                  <Skeleton variant="text" className="h-4 w-28" />
                </div>
                <Skeleton variant="text" className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>

        {/* Section 2 skeleton */}
        <div className="space-y-2">
          <Skeleton variant="text" className="h-3 w-40" />
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800/60">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circle" className="size-8" />
                  <Skeleton variant="text" className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionSkeleton() {
  return (
    <div className="h-full w-full max-w-2xl mx-auto flex-1 overflow-y-auto min-h-0 space-y-6 px-4 py-4 sm:px-6 sm:py-6 pb-8">
      {/* Top Active Workout Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton variant="circle" className="size-2.5" />
            <Skeleton variant="text" className="h-3 w-28" />
          </div>
          <Skeleton variant="text" className="h-9 w-28" />
          <Skeleton variant="text" className="h-3 w-32" />
        </div>
        <Skeleton variant="button" className="h-12 w-36" />
      </div>

      {/* Exercise Cards Skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 space-y-4 shadow-lg">
            {/* Header: Thumbnail + Name */}
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-16 w-24 sm:w-28 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="h-5 w-40" />
                <Skeleton variant="text" className="h-3 w-24 rounded-full" />
              </div>
            </div>

            {/* Set Table Rows Skeleton */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between px-2">
                <Skeleton variant="text" className="h-3 w-12" />
                <Skeleton variant="text" className="h-3 w-16" />
                <Skeleton variant="text" className="h-3 w-12" />
                <Skeleton variant="text" className="h-3 w-12" />
                <Skeleton variant="circle" className="size-5" />
              </div>
              {Array.from({ length: 3 }).map((_, setIdx) => (
                <Skeleton key={setIdx} className="h-11 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
