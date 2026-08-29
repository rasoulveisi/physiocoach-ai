export function PageLoadingFallback() {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      className="flex h-full w-full min-h-[50vh] flex-1 items-center justify-center bg-zinc-950 px-4 text-zinc-100"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <div className="size-12 rounded-full border-2 border-lime-400/20 border-t-lime-400 animate-spin" />
          <div className="absolute size-5 rounded-full bg-lime-400/10 animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-lime-400">
            PhysioCoach AI
          </span>
          <span className="text-xs text-zinc-400 animate-pulse">Loading view…</span>
        </div>
      </div>
    </div>
  );
}

export default PageLoadingFallback;
