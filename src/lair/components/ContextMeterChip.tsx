import { useEffect, useMemo, useState } from "react";
import { useLair } from "@/lair/state";

interface Props {
  onExpand: () => void;
  cycleMs?: number;
}

export function ContextMeterChip({ onExpand, cycleMs = 4000 }: Props) {
  const allLanes = useLair((s) => s.lanes);
  const statuses = useLair((s) => s.laneStatuses);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const lanes = useMemo(() => allLanes.filter((lane) => lane.enabled), [allLanes]);
  const visibleLanes = useMemo(
    () => lanes.filter((lane) => statuses[lane.id]?.context_pct != null),
    [lanes, statuses],
  );

  useEffect(() => {
    if (paused || visibleLanes.length === 0) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % visibleLanes.length);
    }, cycleMs);
    return () => window.clearInterval(timer);
  }, [paused, visibleLanes.length, cycleMs]);

  if (visibleLanes.length === 0) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="flex h-6 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[10.5px] text-muted-foreground"
      >
        ctx —
      </button>
    );
  }

  const active = visibleLanes[index % visibleLanes.length];
  const status = statuses[active.id];
  const pct = (status?.context_pct ?? 0) * 100;
  const colorClass = pct >= 95
    ? "text-red-500"
    : pct >= 80
      ? "text-amber-400"
      : pct >= 60
        ? "text-yellow-300"
        : "text-emerald-400";

  return (
    <button
      type="button"
      onClick={onExpand}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[10.5px] hover:bg-muted"
      title={`${active.label} · ${Math.round(pct)}%`}
    >
      <Ring pct={pct / 100} colorClass={colorClass} />
      <span className="font-medium text-foreground/90">{active.label}</span>
      <span className={colorClass}>{Math.round(pct)}%</span>
    </button>
  );
}

function Ring({ pct, colorClass }: { pct: number; colorClass: string }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, pct)));
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" className="text-border" stroke="currentColor" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r={r}
        fill="none"
        className={colorClass}
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}
