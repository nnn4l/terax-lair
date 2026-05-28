import { useMemo, type ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { clearLane } from "@/lair/api";
import { useLair } from "@/lair/state";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: ReactNode;
}

export function LaneExpandedView({ open, onOpenChange, anchor }: Props) {
  const allLanes = useLair((s) => s.lanes);
  const statuses = useLair((s) => s.laneStatuses);
  const lanes = useMemo(() => allLanes.filter((lane) => lane.enabled), [allLanes]);

  const totalCost = Object.values(statuses).reduce(
    (sum, status) => sum + (status.cost_usd ?? 0),
    0,
  );

  async function handleClear(laneId: string) {
    await clearLane(laneId);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{anchor}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="flex flex-col gap-2">
          {lanes.map((lane) => {
            const status = statuses[lane.id];
            const pct = (status?.context_pct ?? 0) * 100;
            const showClear = lane.clear_required || pct > 80;
            return (
              <div key={lane.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="font-medium">{lane.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(pct)}% · {(status?.tokens_in ?? 0).toLocaleString()} in / {(status?.tokens_out ?? 0).toLocaleString()} out
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
                {showClear ? (
                  <button
                    type="button"
                    onClick={() => void handleClear(lane.id)}
                    className="rounded-md border border-border px-2 py-1 text-[10.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    /clear
                  </button>
                ) : null}
              </div>
            );
          })}
          <p className="mt-1 text-right text-[10px] text-muted-foreground/70">
            session total ${totalCost.toFixed(3)}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
