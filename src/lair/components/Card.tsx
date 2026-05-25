import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CardData } from "@/lair/types";

export function Card({ card }: { card: CardData }) {
  const [expanded, setExpanded] = useState(false);
  const accent =
    card.agent === "claude" ? "border-sky-500/70" : "border-emerald-500/70";
  const label = card.agent === "claude" ? "Claude" : "Codex";

  return (
    <div className={cn("my-2 rounded-md border bg-card/70 p-3", accent)}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-medium">{label}</span>
        <StatusBadge status={card.status} />
      </div>

      {card.status === "streaming" ? (
        <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
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
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {card.summary}
          </p>
          {card.outcome ? (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {card.outcome}
            </p>
          ) : null}
          <button
            type="button"
            className="mt-2 text-[11px] font-medium text-primary hover:underline"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "collapse" : "expand"}
          </button>
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
        <p className="text-[12px] text-destructive">
          {card.error || "failed"}
        </p>
      ) : null}
    </div>
  );
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
  return <span className="text-[11px] text-muted-foreground">{map[status]}</span>;
}
