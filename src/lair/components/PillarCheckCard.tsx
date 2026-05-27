import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { runPillarCheck } from "@/lair/api";
import { SystemCard } from "@/lair/components/SystemCard";
import { useLair } from "@/lair/state";

export function PillarCheckCard() {
  const workspace = useLair((state) => state.workspace);
  const setCritiqueDrafts = useLair((state) => state.setCritiqueDrafts);
  const setCritiqueTrayOpen = useLair((state) => state.setCritiqueTrayOpen);
  const setPillarCheckPending = useLair((state) => state.setPillarCheckPending);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    if (!workspace || busy) return;
    setBusy(true);
    setError(null);
    try {
      const findings = await runPillarCheck(workspace);
      setCritiqueDrafts(
        findings.map((finding) => `[${finding.pillar}] ${finding.violation}`),
      );
      setCritiqueTrayOpen(true);
      setPillarCheckPending(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleSkip() {
    setPillarCheckPending(false);
  }

  return (
    <SystemCard
      tone={error ? "danger" : "info"}
      title={error ? "Pillar check failed" : "Spec complete. Pillar check?"}
      onDismiss={handleSkip}
      actions={
        <>
          <Button
            type="button"
            size="xs"
            onClick={() => void handleRun()}
            disabled={busy || !workspace}
            className="rounded-md text-[11px]"
          >
            <HugeiconsIcon
              icon={error ? RefreshIcon : Search01Icon}
              size={11}
              strokeWidth={1.75}
            />
            {busy ? "checking" : error ? "retry" : "run check"}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="secondary"
            onClick={handleSkip}
            className="rounded-md text-[11px]"
          >
            skip
          </Button>
        </>
      }
    >
      <p className="text-[12px] text-muted-foreground">
        {error
          ? error
          : "Compare shipped work against design pillars. Findings become critique drafts."}
      </p>
    </SystemCard>
  );
}
