import { useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { appendChecklistItem, stopCard } from "@/lair/api";
import { HugeiconsIcon } from "@hugeicons/react";
import { StopCircleIcon } from "@hugeicons/core-free-icons";
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
    <div
      data-lair-agent-card="true"
      data-lair-agent={card.agent}
      className="my-1.5 overflow-hidden rounded-xl border border-border/75 bg-background/70 shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_7%,transparent)_inset] transition-colors duration-200 hover:border-border"
    >
      <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border/55 bg-card/35 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
          <span className="shrink-0 text-[12px] font-semibold tracking-tight">
            {label}
          </span>
          {card.model ? (
            <span
              className="truncate rounded-md border border-border/60 bg-muted/45 px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-muted-foreground"
              title={`${card.model}${card.effort ? ` / ${card.effort}` : ""}`}
            >
              {shortModelLabel(card.model)}
              {card.effort ? `/${card.effort[0]}` : ""}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {(card.status === "streaming" || card.status === "summarizing") ? (
            <button
              type="button"
              onClick={() => void stopCard(card.id)}
              className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Stop"
              title="Stop (Cmd+.)"
            >
              <HugeiconsIcon icon={StopCircleIcon} size={12} strokeWidth={1.75} />
            </button>
          ) : null}
          {card.usage ? <UsageBadge usage={card.usage} /> : null}
          <StatusBadge status={card.status} />
        </div>
      </div>

      {card.status === "streaming" ? (
        <div data-lair-card-section="progress" className="px-3 py-2.5">
          <StreamingState raw={card.raw_output} />
        </div>
      ) : null}

      {card.status === "summarizing" ? (
        <div data-lair-card-section="progress" className="px-3 py-2.5">
          <SectionLabel>progress</SectionLabel>
          <p className="mt-1 text-[12px] text-muted-foreground italic">
            summarizing...
          </p>
        </div>
      ) : null}

      {card.status === "done" && card.summary ? (
        <>
          <div data-lair-card-section="result" className="px-3 py-2.5">
            <SectionLabel>result</SectionLabel>
            <MessageResponse className="text-[13px] leading-relaxed text-foreground/90">
              {card.summary}
            </MessageResponse>
            {card.outcome ? (
              <MessageResponse className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                {card.outcome}
              </MessageResponse>
            ) : null}
          </div>
          <div className="flex items-center gap-2 border-t border-border/55 px-3 py-2">
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "collapse" : "expand"}
            </button>
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setAddingToChecklist((v) => !v)}
            >
              {addingToChecklist ? "cancel" : "to checklist"}
            </button>
          </div>
          {addingToChecklist ? (
            <div className="flex items-center gap-1.5 border-t border-border/55 px-3 py-2">
              {SECTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void handleChecklistAdd(s)}
                  className="rounded-md border border-border/60 bg-muted/55 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          {expanded ? (
            <div className="border-t border-border/55 px-3 py-2.5">
              <RawOutput rawOutput={card.raw_output} />
            </div>
          ) : null}
        </>
      ) : null}

      {card.status === "done" && !card.summary && card.error ? (
        <div data-lair-card-section="issue" className="px-3 py-2.5">
          <SectionLabel>issue</SectionLabel>
          <p className="text-[12px] leading-relaxed text-amber-500">{card.error}</p>
          <RawOutput rawOutput={card.raw_output} />
        </div>
      ) : null}

      {card.status === "failed" ? (
        <div data-lair-card-section="issue" className="px-3 py-2.5">
          <SectionLabel>issue</SectionLabel>
          <p className="text-[12px] leading-relaxed text-destructive">
            {card.error || "failed"}
          </p>
          {card.raw_output ? <RawOutput rawOutput={card.raw_output} /> : null}
        </div>
      ) : null}

      {card.status === "stopped" ? (
        <div data-lair-card-section="issue" className="px-3 py-2.5">
          <SectionLabel>stopped</SectionLabel>
          <p className="text-[12px] text-muted-foreground">stopped by user</p>
          {card.raw_output ? <RawOutput rawOutput={card.raw_output} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-1.5 font-mono text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground/75">
      {children}
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
        <pre className="max-h-32 overflow-y-auto rounded-md border border-border/60 bg-card/70 px-2 py-1.5 whitespace-pre-wrap text-[11px] text-muted-foreground">
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
    <pre className="mt-2 max-h-96 overflow-y-auto rounded-md border border-border/60 bg-card/70 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
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
    stopped: "stopped",
  };
  const tone: Record<CardData["status"], string> = {
    streaming: "border-primary/25 bg-primary/10 text-primary",
    summarizing: "border-border/60 bg-muted/50 text-muted-foreground",
    done: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
    failed: "border-destructive/30 bg-destructive/10 text-destructive",
    stopped: "border-border/60 bg-muted/50 text-muted-foreground",
  };
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[10.5px] ${tone[status]}`}>
      {map[status]}
    </span>
  );
}
