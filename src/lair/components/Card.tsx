import { useState } from "react";
import { cn } from "@/lib/utils";
import { MessageResponse } from "@/components/ai-elements/message";
import { appendChecklistItem } from "@/lair/api";
import { useLair } from "@/lair/state";
import type { CardData, ChecklistSection } from "@/lair/types";
import { UsageBadge } from "@/lair/components/UsageBadge";

const SECTIONS: ChecklistSection[] = ["now", "next", "later"];

export function Card({ card }: { card: CardData }) {
  const [expanded, setExpanded] = useState(false);
  const [addingToChecklist, setAddingToChecklist] = useState(false);
  const workspace = useLair((s) => s.workspace);
  const accent =
    card.agent === "claude" ? "border-orange-500/70" : "border-violet-500/70";
  const label = card.agent === "claude" ? "Claude" : "Codex";

  async function handleChecklistAdd(section: ChecklistSection) {
    const text = card.summary ?? card.outcome ?? card.raw_output.slice(0, 120);
    if (!text.trim() || !workspace) return;
    await appendChecklistItem(workspace, section, text.trim());
    setAddingToChecklist(false);
  }

  return (
    <div className={cn("my-2 rounded-lg border bg-card/70 px-2.5 py-2 shadow-sm", accent)}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[12px] font-semibold tracking-tight">
            {label}
          </span>
          {card.model ? (
            <span
              className="truncate rounded bg-muted px-1.5 py-0.5 text-[10px] whitespace-nowrap text-muted-foreground"
              title={`${card.model}${card.effort ? ` · ${card.effort}` : ""}`}
            >
              {shortModelLabel(card.model)}
              {card.effort ? `·${card.effort[0]}` : ""}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {card.usage ? <UsageBadge usage={card.usage} /> : null}
          <StatusBadge status={card.status} />
        </div>
      </div>

      {card.status === "streaming" ? (
        <pre className="max-h-32 overflow-y-auto rounded-md bg-background/60 px-2 py-1.5 whitespace-pre-wrap text-[11px] text-muted-foreground">
          {card.raw_output || "..."}
        </pre>
      ) : null}

      {card.status === "summarizing" ? (
        <p className="text-[12px] text-muted-foreground italic">
          summarizing...
        </p>
      ) : null}

      {card.status === "done" && card.summary ? (
        <>
          <MessageResponse className="text-[13px] leading-relaxed">
            {card.summary}
          </MessageResponse>
          {card.outcome ? (
            <MessageResponse className="mt-1 text-[12px] text-muted-foreground">
              {card.outcome}
            </MessageResponse>
          ) : null}
          <div className="mt-2 flex items-center gap-3 border-t border-border/40 pt-1.5">
            <button
              type="button"
              className="text-[11px] font-medium text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "collapse" : "expand"}
            </button>
            <button
              type="button"
              className="text-[11px] font-medium text-muted-foreground hover:text-primary"
              onClick={() => setAddingToChecklist((v) => !v)}
            >
              {addingToChecklist ? "cancel" : "→ checklist"}
            </button>
          </div>
          {addingToChecklist ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              {SECTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void handleChecklistAdd(s)}
                  className="rounded bg-muted px-2 py-0.5 text-[11px] hover:bg-muted/80"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          {expanded ? <RawOutput rawOutput={card.raw_output} /> : null}
        </>
      ) : null}

      {card.status === "done" && !card.summary && card.error ? (
        <>
          <p className="text-[12px] text-amber-400">{card.error}</p>
          <RawOutput rawOutput={card.raw_output} />
        </>
      ) : null}

      {card.status === "failed" ? (
        <>
          <p className="text-[12px] text-destructive">
            {card.error || "failed"}
          </p>
          {card.raw_output ? <RawOutput rawOutput={card.raw_output} /> : null}
        </>
      ) : null}
    </div>
  );
}

function shortModelLabel(id: string): string {
  // claude-opus-4-5 -> opus-4.5; gpt-5 -> gpt-5; o4-mini -> o4-mini
  return id.replace(/^claude-/, "").replace(/(\d)-(\d)/g, "$1.$2");
}

function RawOutput({ rawOutput }: { rawOutput: string }) {
  return (
    <pre className="mt-2 max-h-96 overflow-y-auto rounded bg-background/80 p-2 text-[11px] whitespace-pre-wrap text-muted-foreground">
      {rawOutput}
    </pre>
  );
}

function StatusBadge({ status }: { status: CardData["status"] }) {
  const map: Record<CardData["status"], string> = {
    streaming: "streaming",
    summarizing: "summarizing",
    done: "done",
    failed: "failed",
  };
  return (
    <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
      {map[status]}
    </span>
  );
}
