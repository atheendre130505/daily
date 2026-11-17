/** Monochrome progress bar. `marker` (0–1) draws a line where the requirement sits. */
export function Meter({ value, marker, height = 8, label }: { value: number; marker?: number; height?: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative w-full rounded-sm bg-panel-2 border border-line overflow-hidden" style={{ height }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <div className="h-full bg-text transition-all" style={{ width: `${v * 100}%` }} />
      {marker !== undefined && (
        <div className="absolute top-0 bottom-0 w-[2px] bg-muted" style={{ left: `calc(${Math.max(0, Math.min(1, marker)) * 100}% - 1px)` }} title={`Required: ${Math.round(marker * 100)}%`} />
      )}
    </div>
  );
}
