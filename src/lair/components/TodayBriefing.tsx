import { useEffect, useState } from "react";
import { native } from "@/modules/ai/lib/native";

type PlanWeather = {
  temp: string;
  condition: string;
  location: string;
};

type PlanData = {
  day_name: string;
  full_date: string;
  time_24h: string;
  weather: PlanWeather;
};

function isPlanData(value: unknown): value is PlanData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<PlanData>;
  const weather = data.weather as Partial<PlanWeather> | undefined;
  return (
    typeof data.day_name === "string" &&
    typeof data.full_date === "string" &&
    typeof data.time_24h === "string" &&
    !!weather &&
    typeof weather.temp === "string" &&
    typeof weather.condition === "string" &&
    typeof weather.location === "string"
  );
}

async function loadPlanData(): Promise<PlanData> {
  const result = await native.runCommand("python scripts/plan_data.py", null, 8);
  if (result.exit_code !== 0 || !result.stdout.trim()) {
    throw new Error(result.stderr || "plan data unavailable");
  }
  const parsed: unknown = JSON.parse(result.stdout);
  if (!isPlanData(parsed)) {
    throw new Error("invalid plan data");
  }
  return parsed;
}

export function TodayBriefing() {
  const [data, setData] = useState<PlanData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      try {
        const next = await loadPlanData();
        if (!alive) return;
        setData(next);
        setFailed(false);
      } catch {
        if (!alive) return;
        setFailed(true);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="flex flex-col gap-4 px-4 py-6">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
        TODAY
      </div>
      {data ? (
        <div className="space-y-5">
          <div className="space-y-1">
            <div className="text-[22px] font-semibold leading-none text-foreground">
              {data.day_name}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {data.full_date}
            </div>
          </div>
          <div className="grid grid-cols-[auto_1fr] items-end gap-x-4 gap-y-1">
            <div className="text-[32px] font-semibold leading-none tabular-nums text-foreground">
              {data.time_24h}
            </div>
            <div className="min-w-0 pb-0.5 text-right">
              <div className="truncate text-[13px] font-medium text-foreground/90">
                {data.weather.temp} · {data.weather.condition}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {data.weather.location}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">
          {failed ? "Briefing unavailable" : "Loading"}
        </div>
      )}
    </section>
  );
}
