import { useEffect, useState } from "react";
import {
  getBackendStatus,
  listLanes,
  onBackendStatusChanged,
  onLanesChanged,
  restartBackend,
  saveLane,
} from "@/lair/api";
import { useLair } from "@/lair/state";
import type { Lane } from "@/lair/types";

export function LanesSettingsPanel() {
  const lanes = useLair((s) => s.lanes);
  const setLanes = useLair((s) => s.setLanes);
  const setBackendStatus = useLair((s) => s.setBackendStatus);
  const [loading, setLoading] = useState(true);
  const [savingLaneId, setSavingLaneId] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backendStatuses = useLair((s) => s.backendStatuses);

  useEffect(() => {
    void listLanes()
      .then(setLanes)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
    void getBackendStatus("uniclaude-proxy")
      .then((status) => setBackendStatus("uniclaude-proxy", status))
      .catch((err) => setError(String(err)));
    const backendEvents = onBackendStatusChanged((event) => {
      setBackendStatus(event.id, event.status);
    });
    const laneEvents = onLanesChanged(setLanes);
    return () => {
      void backendEvents.then((unlisten) => unlisten());
      void laneEvents.then((unlisten) => unlisten());
    };
  }, [setBackendStatus, setLanes]);

  async function toggleEnabled(lane: Lane) {
    setSavingLaneId(lane.id);
    setError(null);
    const updated = { ...lane, enabled: !lane.enabled };
    try {
      await saveLane(updated);
      const fresh = await listLanes();
      setLanes(fresh);
    } catch (err) {
      setError(String(err));
    } finally {
      setSavingLaneId(null);
    }
  }

  async function handleRestartProxy() {
    setRestarting(true);
    setError(null);
    setBackendStatus("uniclaude-proxy", "starting");
    try {
      await restartBackend("uniclaude-proxy");
      const status = await getBackendStatus("uniclaude-proxy");
      setBackendStatus("uniclaude-proxy", status);
    } catch (err) {
      setError(String(err));
      setBackendStatus("uniclaude-proxy", "crashed");
    } finally {
      setRestarting(false);
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col gap-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="space-y-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />
          ))}
        </div>
      </section>
    );
  }

  const proxyStatus = backendStatuses["uniclaude-proxy"] ?? "stopped";

  return (
    <section className="flex flex-col gap-3 p-4">
      <header>
        <h2 className="text-[13px] font-semibold tracking-tight">Lanes</h2>
        <p className="text-[11px] text-muted-foreground">
          Configured agent identities. Edit advanced fields in ~/.lair/lanes.toml.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2">
        <span className="text-[11px] text-muted-foreground">UniClaudeProxy</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
            proxyStatus === "running"
              ? "bg-emerald-500/10 text-emerald-500"
              : proxyStatus === "starting"
                ? "bg-amber-500/10 text-amber-500"
                : proxyStatus === "crashed"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted/50 text-muted-foreground"
          }`}
        >
          {proxyStatus}
        </span>
        <button
          type="button"
          disabled={restarting}
          onClick={() => void handleRestartProxy()}
          className="ml-auto rounded-md border border-border px-2 py-0.5 text-[10.5px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {restarting ? "restarting" : "restart"}
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-1.5">
        {lanes.map((lane) => (
          <li
            key={lane.id}
            className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-[12px]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-medium">{lane.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {lane.role}
              </span>
              <span className="text-[10px] text-muted-foreground">{lane.cost_tier}</span>
              {lane.backend ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  backend: {lane.backend}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              disabled={savingLaneId === lane.id}
              onClick={() => void toggleEnabled(lane)}
              className={`rounded-md border px-2 py-1 text-[11px] ${
                lane.enabled
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              } disabled:pointer-events-none disabled:opacity-50`}
            >
              {savingLaneId === lane.id
                ? "saving"
                : lane.enabled
                  ? "enabled"
                  : "disabled"}
            </button>
          </li>
        ))}
      </ul>

      <p className="text-[10.5px] text-muted-foreground">
        DeepSeek lanes use the bundled UniClaudeProxy sidecar. Enable either to spawn the proxy on next send.
      </p>
    </section>
  );
}
