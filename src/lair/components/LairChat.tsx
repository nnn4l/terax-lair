import { useEffect, useMemo, useState } from "react";
import { sendMessage, onCardUpdate, onStreamChunk, onNarration } from "@/lair/api";
import { useLair } from "@/lair/state";
import { AgentDropdown } from "@/lair/components/AgentDropdown";
import { Card } from "@/lair/components/Card";
import { ModelDropdown } from "@/lair/components/ModelDropdown";
import { NarrationLine } from "@/lair/components/NarrationLine";
import { PhaseDropdown } from "@/lair/components/PhaseDropdown";
import {
  Add01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CardData, NarrationLine as NarrationData, Turn } from "@/lair/types";

export function LairChat({ onClose }: { onClose?: () => void }) {
  const cards = useLair((state) => state.cards);
  const narrations = useLair((state) => state.narrations);
  const turns = useLair((state) => state.turns);
  const sessions = useLair((state) => state.sessions);
  const activeSessionId = useLair((state) => state.activeSessionId);
  const upsertCard = useLair((state) => state.upsertCard);
  const appendChunk = useLair((state) => state.appendChunk);
  const addNarration = useLair((state) => state.addNarration);
  const newSession = useLair((state) => state.newSession);
  const switchSession = useLair((state) => state.switchSession);
  const deleteSession = useLair((state) => state.deleteSession);
  const startTurn = useLair((state) => state.startTurn);
  const attachCardIds = useLair((state) => state.attachCardIds);
  const workspace = useLair((state) => state.workspace);
  const phase = useLair((state) => state.phase);
  const agentChoice = useLair((state) => state.agentChoice);
  const claudeModel = useLair((s) => s.claudeModel);
  const codexModel = useLair((s) => s.codexModel);
  const claudeEffort = useLair((s) => s.claudeEffort);
  const codexEffort = useLair((s) => s.codexEffort);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const canSend = text.trim().length > 0 && !sending;

  const shortcut = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl ⏎";
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    return mac ? "⌘ ⏎" : "Ctrl ⏎";
  }, []);

  useEffect(() => {
    const cardUpdate = onCardUpdate((event) =>
      upsertCard(event.card, event.turn_id),
    );
    const streamChunk = onStreamChunk((event) =>
      appendChunk(event.card_id, event.chunk),
    );
    const narrationSub = onNarration((event) => addNarration(event.line));
    return () => {
      void cardUpdate.then((unlisten) => unlisten());
      void streamChunk.then((unlisten) => unlisten());
      void narrationSub.then((unlisten) => unlisten());
    };
  }, [appendChunk, upsertCard, addNarration]);


  // Lookup maps
  const cardById = useMemo(
    () => new Map(cards.map((c) => [c.id, c])),
    [cards],
  );
  const narrationById = useMemo(
    () => new Map(narrations.map((n) => [n.id, n])),
    [narrations],
  );

  const isEmpty = turns.length === 0;
  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const showsClaude =
    agentChoice === "claude" || agentChoice === "auto" || agentChoice === "compare";
  const showsCodex =
    agentChoice === "codex" || agentChoice === "auto" || agentChoice === "compare";
  const showsBoth = showsClaude && showsCodex;

  async function submit() {
    const prompt = text.trim();
    if (!prompt || sending) return;
    if (!workspace) {
      window.alert("Set a workspace first");
      return;
    }
    setSending(true);
    if (!activeSessionId) newSession();
    const turnId = startTurn(prompt);
    setText("");
    try {
      const ids = await sendMessage({
        turn_id: turnId,
        prompt,
        agent_choice: agentChoice,
        phase,
        workspace,
        claude_model: claudeModel,
        codex_model: codexModel,
        claude_effort: claudeEffort,
        codex_effort: codexEffort,
      });
      attachCardIds(turnId, ids);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-card text-[12px]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-foreground/[0.03] to-transparent"
      />
      <div className="relative flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[12px] font-semibold tracking-tight">
            Lair
          </span>
          <SessionPicker
            sessions={sessions}
            activeSessionId={activeSessionId}
            activeTitle={activeSession?.title ?? "New chat"}
            onNew={() => newSession()}
            onSwitch={switchSession}
            onDelete={deleteSession}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
            {sending ? "working" : `${turns.length} turns`}
          </span>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Close Lair"
              title="Close"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onPick={setText} />
        ) : (
          turns.map((turn) => (
            <TurnView
              key={turn.id}
              turn={turn}
              cardById={cardById}
              narrationById={narrationById}
            />
          ))
        )}
      </div>

      {showsClaude || showsCodex ? (
        <div className="flex flex-col gap-1 border-t border-border/40 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-2">
            <PhaseDropdown />
            <AgentDropdown />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {showsClaude ? (
              <ModelRow label={showsBoth ? "claude" : undefined} agent="claude" />
            ) : null}
            {showsCodex ? (
              <ModelRow label={showsBoth ? "codex" : undefined} agent="codex" />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="border-t border-border/60 bg-card/80 px-3 pt-2 pb-3">
        <div className="relative rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
          <textarea
            className="block min-h-32 w-full resize-none rounded-md bg-transparent p-2.5 pb-10 text-[13px] outline-none"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="type message..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
          />
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between">
            <div />
            <button
              type="button"
              className="pointer-events-auto flex h-6 items-center gap-1.5 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
              onClick={() => void submit()}
              disabled={!canSend}
              title={`send (${shortcut})`}
            >
              <span className="text-[10px] opacity-70">{shortcut}</span>
              <span>{sending ? "..." : "send"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SessionPickerProps {
  sessions: ReturnType<typeof useLair.getState>["sessions"];
  activeSessionId: string | null;
  activeTitle: string;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

function SessionPicker({
  sessions,
  activeSessionId,
  activeTitle,
  onNew,
  onSwitch,
  onDelete,
}: SessionPickerProps) {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="relative min-w-0">
        <select
          value={activeSessionId ?? ""}
          onChange={(event) => onSwitch(event.target.value)}
          className="h-6 max-w-[11rem] appearance-none rounded-md bg-transparent py-0 pl-1.5 pr-5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground"
          title="Switch Lair chat"
        >
          {activeSessionId ? null : <option value="">{activeTitle}</option>}
          {sorted.map((session) => (
            <option key={session.id} value={session.id}>
              {session.title || "New chat"}
            </option>
          ))}
        </select>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={10}
          strokeWidth={2}
          className="pointer-events-none absolute right-1.5 top-2 text-muted-foreground/70"
        />
      </div>
      <button
        type="button"
        onClick={onNew}
        className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        title="New chat"
        aria-label="New Lair chat"
      >
        <HugeiconsIcon icon={Add01Icon} size={12} strokeWidth={1.75} />
      </button>
      {activeSessionId ? (
        <button
          type="button"
          onClick={() => onDelete(activeSessionId)}
          className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Delete chat"
          aria-label="Delete Lair chat"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={10} strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  const suggestions = [
    "Plan this feature.",
    "Compare Claude and Codex on this task.",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8 py-10 text-center">
      <img src="/logo.png" alt="Terax" className="size-12 opacity-90" />
      <div className="space-y-1">
        <p className="text-[13px] font-semibold tracking-tight">Start Lair chat</p>
        <p className="text-[11px] text-muted-foreground">Ready when you are.</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onPick(text)}
            className="rounded-lg border border-border bg-card/70 px-2.5 py-2 text-left text-[11.5px] font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TurnViewProps {
  turn: Turn;
  cardById: Map<string, CardData>;
  narrationById: Map<string, NarrationData>;
}

function TurnView({ turn, cardById, narrationById }: TurnViewProps) {
  const turnCards = turn.cardIds
    .map((id) => cardById.get(id))
    .filter((c): c is CardData => Boolean(c));
  const turnNarrations = turn.narrationIds
    .map((id) => narrationById.get(id))
    .filter((n): n is NarrationData => Boolean(n));

  return (
    <div className="px-3 py-2">
      <p className="mb-2 whitespace-pre-wrap text-[13px] font-medium text-foreground/90">
        {turn.prompt}
      </p>
      {turnNarrations.map((n) => (
        <NarrationLine key={n.id} line={n} />
      ))}
      {turnCards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
      {turnCards.length === 0 && turnNarrations.length === 0 ? (
        <p className="text-[11px] italic text-muted-foreground/60">
          waiting...
        </p>
      ) : null}
    </div>
  );
}

function ModelRow({
  label,
  agent,
}: {
  label?: string;
  agent: "claude" | "codex";
}) {
  return (
    <div className="flex items-center gap-2">
      {label ? (
        <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/60">
          {label}
        </span>
      ) : null}
      <ModelDropdown agent={agent} />
    </div>
  );
}
