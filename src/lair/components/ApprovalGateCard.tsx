import { useState } from "react";
import { SystemCard } from "@/lair/components/SystemCard";
import { EditContextDialog } from "@/lair/components/EditContextDialog";
import {
  queueApprove,
  queueDrop,
  queueEditContext,
  queueMarkDone,
} from "@/lair/api";
import { useLair } from "@/lair/state";
import type { ApprovalGate, QueueItem } from "@/lair/types";

interface Props {
  gate: ApprovalGate;
}

function findItem(items: QueueItem[], id: string): QueueItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findItem(item.children, id);
    if (found) return found;
  }
  return null;
}

export function ApprovalGateCard({ gate }: Props) {
  const queue = useLair((s) => s.queue);
  const setPendingGate = useLair((s) => s.setPendingGate);
  const [editing, setEditing] = useState(false);
  const item = findItem(queue, gate.item_id);

  async function handleApprove() {
    await queueApprove();
    setPendingGate(null);
  }

  async function handleSkip() {
    await queueMarkDone(gate.item_id);
    await queueApprove();
    setPendingGate(null);
  }

  async function handleDrop() {
    await queueDrop(gate.item_id);
    setPendingGate(null);
  }

  async function handleEditSave(context: string) {
    await queueEditContext(gate.item_id, context);
    setEditing(false);
  }

  return (
    <>
      <SystemCard
        tone="warning"
        title="Autopilot paused"
        onDismiss={() => setPendingGate(null)}
        actions={
          <>
            <button
              type="button"
              onClick={() => void handleApprove()}
              className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              approve
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={!item}
              className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/70 disabled:opacity-40"
            >
              edit context
            </button>
            <button
              type="button"
              onClick={() => void handleSkip()}
              className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/70"
            >
              skip
            </button>
            <button
              type="button"
              onClick={() => void handleDrop()}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10"
            >
              drop
            </button>
          </>
        }
      >
        <p className="text-[12px] text-muted-foreground">{gate.reason}</p>
        {item ? (
          <p className="mt-1 text-[12px]">
            Next: <span className="font-medium">{item.label}</span>
          </p>
        ) : null}
      </SystemCard>
      {editing && item ? (
        <EditContextDialog
          initialValue={item.context}
          onCancel={() => setEditing(false)}
          onSave={handleEditSave}
        />
      ) : null}
    </>
  );
}
