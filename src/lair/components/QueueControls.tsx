import * as api from "@/lair/api";
import { useLair } from "@/lair/state";
import type { AutopilotMode } from "@/lair/types";

export function QueueControls() {
  const autopilot = useLair((state) => state.autopilot);
  const setMode = useLair((state) => state.setAutopilotMode);
  const setPaused = useLair((state) => state.setAutopilotPaused);
  const setStopOnFailure = useLair((state) => state.setStopOnFailure);

  async function changeMode(mode: AutopilotMode) {
    setMode(mode);
    await api.queueSetAutopilot(mode);
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border/60 px-2 py-2 text-[11px]">
      <button
        type="button"
        onClick={() => {
          if (autopilot.paused) {
            void api.queueResume();
            setPaused(false);
          } else {
            void api.queuePause();
            setPaused(true);
          }
        }}
        className="rounded-md bg-muted px-2 py-1 font-medium hover:bg-muted/80"
      >
        {autopilot.paused ? "resume" : "pause"}
      </button>
      <button
        type="button"
        onClick={() => void api.queueSkip()}
        className="rounded-md bg-muted px-2 py-1 font-medium hover:bg-muted/80"
      >
        skip
      </button>
      <select
        value={autopilot.mode}
        onChange={(event) => void changeMode(event.target.value as AutopilotMode)}
        className="h-7 rounded-md border-0 bg-muted px-1.5 text-[11px] outline-none"
      >
        <option value="off">manual</option>
        <option value="subtask">per subtask</option>
        <option value="task">per task</option>
        <option value="full">full</option>
      </select>
      <label className="ml-auto flex items-center gap-1 text-muted-foreground">
        <input
          type="checkbox"
          checked={autopilot.stopOnFailure}
          onChange={(event) => setStopOnFailure(event.target.checked)}
          className="size-3"
        />
        stop on fail
      </label>
    </div>
  );
}
