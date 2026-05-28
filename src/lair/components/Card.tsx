import { useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { appendChecklistItem } from "@/lair/api";
import { useLair } from "@/lair/state";
import type { CardData, ChecklistSection } from "@/lair/types";
import { UsageBadge } from "@/lair/components/UsageBadge";

const SECTIONS: ChecklistSection[] = ["queue", "done"];

export function Card({ card }: { card: CardData }) {
  const [expanded, setExpanded] = useState(false);
  const [addingToChecklist, setAddingToChecklist] = useState(false);
  const workspace = useLair((s) => s.workspace);
  const label = card.agent === "claude" ? "Claude" : "Codex";

  async function handleChecklistAdd(section: ChecklistSection) {
    const text = card.summary ?? card.outcome ?? card.raw_output.slice(0, 120);
    if (!text.trim() || !workspace) return;
    await appendChecklistItem(workspace, section, text.trim());
    setAddingToChecklist(false);
  }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm">
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="px-3 py-2.5">
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
        <StreamingState raw={card.raw_output} />
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
          <div className="flex items-center gap-3 border-t border-white/5 pt-2">
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
              {addingToChecklist ? "cancel" : "to checklist"}
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

function inferCurrentStep(raw: string): string {
  if (!raw) return "starting...";
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "starting...";
  const last = lines[lines.length - 1];
  return last.replace(/^\[stderr\]\s*/, "").slice(0, 120);
}

function StreamingState({ raw }: { raw: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const current = inferCurrentStep(raw);
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2 text-[12px]">
        <span className="mt-1.5 inline-block size-1.5 shrink-0 animate-pulse rounded-full bg-primary/70" />
        <span className="min-w-0 flex-1 truncate text-foreground/85">{current}</span>
      </div>
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="text-[11px] font-medium text-muted-foreground hover:text-primary"
      >
        {showRaw ? "hide raw" : "show raw"}
      </button>
      {showRaw ? (
        <pre className="max-h-32 overflow-y-auto rounded-md bg-background/60 px-2 py-1.5 whitespace-pre-wrap text-[11px] text-muted-foreground">
          {raw || "..."}
        </pre>
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
