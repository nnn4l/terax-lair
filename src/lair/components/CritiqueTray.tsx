import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Cancel01Icon,
  Delete01Icon,
  FlashIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { dispatchCritiques } from "@/lair/api";
import { useLair } from "@/lair/state";

export function CritiqueTray() {
  const open = useLair((state) => state.critiqueTrayOpen);
  const drafts = useLair((state) => state.critiqueDrafts);
  const workspace = useLair((state) => state.workspace);
  const setCritiqueDrafts = useLair((state) => state.setCritiqueDrafts);
  const clearCritiqueDrafts = useLair((state) => state.clearCritiqueDrafts);
  const toggleCritiqueTray = useLair((state) => state.toggleCritiqueTray);
  const setCritiqueTrayOpen = useLair((state) => state.setCritiqueTrayOpen);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function updateDraft(index: number, value: string) {
    const next = [...drafts];
    next[index] = value;
    setCritiqueDrafts(next);
  }

  function removeDraft(index: number) {
    setCritiqueDrafts(drafts.filter((_, i) => i !== index));
  }

  function addDraft() {
    setCritiqueDrafts([...drafts, ""]);
  }

  async function run(mode: "linear" | "parallel") {
    if (!workspace || running) return;
    const items = drafts.map((draft) => draft.trim()).filter(Boolean);
    if (items.length === 0) return;

    setRunning(true);
    setError(null);
    clearCritiqueDrafts();
    try {
      await dispatchCritiques(workspace, items, mode);
      setCritiqueTrayOpen(false);
    } catch (err) {
      setCritiqueDrafts(items);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const canRun = drafts.some((draft) => draft.trim().length > 0) && !running;

  return (
    <div className="absolute right-3 bottom-32 z-30 flex w-80 max-w-[calc(100%-1.5rem)] flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold tracking-tight">Critique tray</p>
          <p className="text-[10.5px] text-muted-foreground">
            Dispatch focused follow-ups
          </p>
        </div>
        <button
          type="button"
          onClick={toggleCritiqueTray}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close critique tray"
          title="Close"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
        {drafts.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-background/40 px-2 py-3 text-center text-[11px] text-muted-foreground">
            No critiques yet.
          </p>
        ) : (
          drafts.map((draft, index) => (
            <div key={index} className="flex items-start gap-1.5">
              <Textarea
                value={draft}
                onChange={(event) => updateDraft(index, event.target.value)}
                rows={2}
                className="min-h-14 rounded-md bg-background/70 px-2 py-1.5 text-[11.5px] leading-relaxed"
                placeholder="describe a correction..."
              />
              <button
                type="button"
                onClick={() => removeDraft(index)}
                className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                aria-label="Remove critique"
                title="Remove"
              >
                <HugeiconsIcon icon={Delete01Icon} size={12} strokeWidth={1.75} />
              </button>
            </div>
          ))
        )}
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={addDraft}
          className="rounded-md text-[11px]"
        >
          <HugeiconsIcon icon={Add01Icon} size={11} strokeWidth={1.75} />
          add
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="xs"
            onClick={() => void run("linear")}
            disabled={!canRun}
            className="rounded-md text-[11px]"
          >
            <HugeiconsIcon icon={PlayIcon} size={11} strokeWidth={1.75} />
            linear
          </Button>
          <Button
            type="button"
            size="xs"
            onClick={() => void run("parallel")}
            disabled={!canRun}
            className="rounded-md text-[11px]"
          >
            <HugeiconsIcon icon={FlashIcon} size={11} strokeWidth={1.75} />
            parallel
          </Button>
        </div>
      </div>
    </div>
  );
}
