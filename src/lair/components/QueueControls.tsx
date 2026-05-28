import {
  ArrowDown01Icon,
  PauseIcon,
  PlayIcon,
  Route01Icon,
  StopCircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import * as api from "@/lair/api";
import { useLair } from "@/lair/state";
import type { AutopilotMode } from "@/lair/types";

const MODE_LABEL: Record<AutopilotMode, string> = {
  off: "Manual",
  subtask: "After subtask",
  task: "After task",
  full: "Full plan",
};

const MODE_DESCRIPTION: Record<AutopilotMode, string> = {
  off: "Wait for you before running another item",
  subtask: "Continue when the current subtask finishes",
  task: "Continue when the current task finishes",
  full: "Run until blocked, failed, or complete",
};

const MODES: AutopilotMode[] = ["off", "task", "subtask", "full"];

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
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-medium transition-colors active:scale-[0.98]",
          autopilot.paused
            ? "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
            : "border-primary/35 bg-primary/10 text-primary hover:bg-primary/15",
        )}
        title={
          autopilot.paused
            ? "Resume automatic queue execution"
            : "Pause automatic queue execution"
        }
      >
        <HugeiconsIcon
          icon={autopilot.paused ? PlayIcon : PauseIcon}
          size={12}
          strokeWidth={1.75}
        />
        {autopilot.paused ? "Resume auto-run" : "Pause auto-run"}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground active:scale-[0.98]"
            title="Choose how the queue advances"
          >
            <HugeiconsIcon icon={Route01Icon} size={12} strokeWidth={1.75} />
            <span>Advance: {MODE_LABEL[autopilot.mode]}</span>
            <HugeiconsIcon icon={ArrowDown01Icon} size={10} strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-64 rounded-xl">
          <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Advance mode
          </div>
          {MODES.map((mode) => (
            <DropdownMenuItem
              key={mode}
              onSelect={() => void changeMode(mode)}
              className={cn(
                "flex items-start gap-2 pr-2 text-[12px]",
                autopilot.mode === mode && "bg-accent/40",
              )}
            >
              <HugeiconsIcon
                icon={Route01Icon}
                size={13}
                strokeWidth={1.75}
                className="mt-0.5 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-foreground/90">{MODE_LABEL[mode]}</span>
                <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
                  {MODE_DESCRIPTION[mode]}
                </span>
              </span>
              {autopilot.mode === mode ? (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  size={12}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-foreground"
                />
              ) : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        onClick={() => void api.queueSkip()}
        className="flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground active:scale-[0.98]"
        title="Skip the current task and advance the queue"
      >
        <HugeiconsIcon icon={StopCircleIcon} size={12} strokeWidth={1.75} />
        Skip task
      </button>

      <label className="ml-auto flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground">
        <input
          type="checkbox"
          checked={autopilot.stopOnFailure}
          onChange={(event) => setStopOnFailure(event.target.checked)}
          className="size-3 accent-primary"
        />
        Stop on failure
      </label>
    </div>
  );
}
