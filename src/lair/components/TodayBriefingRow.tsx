import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface PlanData {
  time?: string;
  date_label?: string;
  weather?: { temp_f: number; condition?: string; description?: string; location: string };
  priorities?: string[];
  now?: { workspace: string; queue_done: number; queue_total: number; last_touched_min: number };
}

export function TodayBriefingRow() {
  const [data, setData] = useState<PlanData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    invoke<PlanData>("lair_dashboard_briefing")
      .then(setData)
      .catch(() => setData({}))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <section className="border-b border-border/40 px-6 py-6">
        <div className="space-y-3">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-2 w-48 animate-pulse rounded bg-muted" />
          <div className="h-2 w-80 animate-pulse rounded bg-muted" />
        </div>
      </section>
    );
  }

  if (!data) return null;

  const condition = data.weather?.condition ?? data.weather?.description;

  return (
    <section className="border-b border-border/40 px-6 py-6">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">Today</p>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <h1 className="text-[16px] font-semibold tracking-tight">
          {data.date_label ?? "No date"} <span className="text-muted-foreground">· {data.time ?? "--:--"}</span>
        </h1>
        {data.weather ? (
          <p className="text-[12px] text-muted-foreground">
            {data.weather.temp_f}°F {condition ?? ""} · {data.weather.location}
          </p>
        ) : null}
      </div>

      {data.priorities && data.priorities.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
            Three priorities
          </p>
          <ol className="mt-1 space-y-0.5 text-[13px]">
            {data.priorities.map((priority, index) => (
              <li
                key={`${priority}-${index}`}
                className="flex cursor-copy items-baseline gap-2 hover:text-primary"
                onClick={() => void navigator.clipboard.writeText(priority)}
                title="Click to copy"
              >
                <span className="text-muted-foreground">{index + 1}.</span>
                <span>{priority}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="mt-4 text-[12px] text-muted-foreground">
          No plan for today. Build with /plan in vault.
        </p>
      )}

      {data.now ? (
        <p className="mt-4 text-[12px] text-muted-foreground">
          Now: <span className="text-foreground/80">{data.now.workspace}</span> · queue {data.now.queue_done}/{data.now.queue_total} · last touched {data.now.last_touched_min}m ago
        </p>
      ) : null}
    </section>
  );
}
