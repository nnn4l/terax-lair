import { useEffect, useMemo, useRef, useState } from "react";
import {
  sendMessage,
  onCardUpdate,
  onStreamChunk,
  onNarration,
  onQueueEvent,
  onSpecComplete,
  onSpecChanged,
  queueCheckStale,
  queueGet,
  queueUnpin,
} from "@/lair/api";
import { useLair } from "@/lair/state";
import { AgentDropdown } from "@/lair/components/AgentDropdown";
import { Card } from "@/lair/components/Card";
import { CritiqueTray } from "@/lair/components/CritiqueTray";
import { NarrationLine } from "@/lair/components/NarrationLine";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApprovalGateCard } from "@/lair/components/ApprovalGateCard";
import { PillarCheckCard } from "@/lair/components/PillarCheckCard";
import { StaleSpecCard } from "@/lair/components/StaleSpecCard";
import {
  Add01Icon,
  Cancel01Icon,
  CopyIcon,
  PencilEdit02Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type {
  CardData,
  NarrationLine as NarrationData,
  QueueItem,
  Turn,
} from "@/lair/types";

export function LairChat({ onClose }: { onClose?: () => void }) {
  const cards = useLair((state) => state.cards);
  const narrations = useLair((state) => state.narrations);
  const turns = useLair((state) => state.turns);
  const sessions = useLair((state) => state.sessions);
  const activeSessionId = useLair((state) => state.activeSessionId);
  const upsertCard = useLair((state) => state.upsertCard);
  const appendChunk = useLair((state) => state.appendChunk);
  const addNarration = useLair((state) => state.addNarration);
  const setQueue = useLair((state) => state.setQueue);
  const setCursor = useLair((state) => state.setCursor);
  const setAutopilotPaused = useLair((state) => state.setAutopilotPaused);
  const setStaleReports = useLair((state) => state.setStaleReports);
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
  const queue = useLair((s) => s.queue);
  const cursor = useLair((s) => s.cursor);
  const staleReports = useLair((s) => s.staleReports);
  const staleSpecFile = useLair((s) => s.staleSpecFile);
  const pendingGate = useLair((s) => s.pendingGate);
  const pillarCheckPending = useLair((s) => s.pillarCheckPending);
  const critiqueDraftCount = useLair((s) => s.critiqueDrafts.length);
  const critiqueTrayOpen = useLair((s) => s.critiqueTrayOpen);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ message: string; prompt: string } | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const stickToBottomRef = useRef(true);
  const canSend = text.trim().length > 0 && !sending;
  const currentItem = useMemo(
    () => (cursor.itemId ? findQueueItem(queue, cursor.itemId) : null),
    [cursor.itemId, queue],
  );
  const autopilotDispatchingRef = useRef(false);

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

  useEffect(() => {
    const sub = onSpecComplete(() => {
      useLair.getState().setPhase("critique");
      useLair.getState().setPillarCheckPending(true);
    });
    return () => {
      void sub.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    const queueEvents = onQueueEvent((event) => {
      if (event.type === "cursor_advanced") {
        setCursor(event.to ?? null);
        if (event.to) {
          const state = useLair.getState();
          if (state.autopilot.mode !== "off" && !state.autopilot.paused) {
            const nextItem = findQueueItem(state.queue, event.to);
            if (nextItem && !autopilotDispatchingRef.current) {
              autopilotDispatchingRef.current = true;
              void dispatchQueueItem(nextItem).finally(() => {
                autopilotDispatchingRef.current = false;
              });
            }
          }
        }
      } else if (event.type === "item_completed") {
        void queueGet().then((items) => {
          if (items) setQueue(items);
        });
      } else if (event.type === "blocked_awaiting_approval") {
        setAutopilotPaused(true);
        useLair.getState().setPendingGate({
          item_id: event.id,
          reason: event.reason,
          raised_at: Date.now(),
        });
      } else if (event.type === "paused") {
        setAutopilotPaused(true);
      } else if (event.type === "resumed") {
        setAutopilotPaused(false);
        useLair.getState().setPendingGate(null);
      }
    });
    const specChanges = onSpecChanged((file) => {
      void queueCheckStale()
        .then((reports) => {
          setStaleReports(reports, file);
          return queueGet();
        })
        .then((items) => {
          if (items) setQueue(items);
        });
    });
    return () => {
      void queueEvents.then((unlisten) => unlisten());
      void specChanges.then((unlisten) => unlisten());
    };
  }, [setAutopilotPaused, setCursor, setQueue, setStaleReports]);


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
  const activityKey = useMemo(
    () =>
      [
        turns.length,
        cards.map((card) => `${card.id}:${card.status}:${card.raw_output.length}`).join("|"),
        narrations.length,
        error?.message ?? "",
      ].join(":"),
    [turns.length, cards, narrations.length, error],
  );
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activityKey]);

  function handleThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function submitPrompt(prompt: string) {
    if (!prompt || sending) return;
    if (!workspace) {
      setError({ message: "Set a workspace first.", prompt });
      return;
    }
    setSending(true);
    setError(null);
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
        task_context: currentItem
          ? {
              item_id: currentItem.id,
              label: currentItem.label,
              context: currentItem.context,
            }
          : undefined,
        claude_model: claudeModel,
        codex_model: codexModel,
        claude_effort: claudeEffort,
        codex_effort: codexEffort,
      });
      attachCardIds(turnId, ids);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : String(err),
        prompt,
      });
    } finally {
      setSending(false);
    }
  }

  function submit() {
    void submitPrompt(text.trim());
  }

  async function dispatchQueueItem(item: QueueItem) {
    const state = useLair.getState();
    if (!state.workspace) {
      setError({ message: "Set a workspace first.", prompt: "Execute this task." });
      return;
    }
    if (!state.activeSessionId) state.newSession();
    const prompt = "Execute this task.";
    const turnId = state.startTurn(prompt);
    try {
      const ids = await sendMessage({
        turn_id: turnId,
        prompt,
        agent_choice: item.agent_hint ?? state.agentChoice,
        phase: state.phase,
        workspace: state.workspace,
        task_context: {
          item_id: item.id,
          label: item.label,
          context: item.context,
        },
        claude_model: state.claudeModel,
        codex_model: state.codexModel,
        claude_effort: state.claudeEffort,
        codex_effort: state.codexEffort,
      });
      state.attachCardIds(turnId, ids);
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : String(err),
        prompt,
      });
    }
  }

  function editPrompt(prompt: string) {
    setText(prompt);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(prompt.length, prompt.length);
    });
  }

  return (
    <div
      data-lair-surface="graphite-console"
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-card text-[12px] text-card-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_50%_-18%,var(--accent),transparent_46%)] opacity-70"
      />
      <div className="relative flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-card/85 px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/60 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--foreground)_8%,transparent)]">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_14px_color-mix(in_oklch,var(--primary)_45%,transparent)]" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="shrink-0 text-[12px] font-semibold leading-none tracking-tight">
              Lair
            </span>
            <span className="mt-0.5 truncate text-[10px] leading-none text-muted-foreground">
              agent console
            </span>
          </div>
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
          <span className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10.5px] text-muted-foreground tabular-nums">
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

      {currentItem ? (
        <div className="relative flex min-h-9 shrink-0 items-center gap-2 border-b border-border/60 bg-muted/25 px-3 text-[11px]">
          <span className="shrink-0 rounded bg-background/70 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">
            now
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-foreground/90">{currentItem.label}</span>
          {cursor.pinned ? (
            <button
              type="button"
              onClick={() => {
                void queueUnpin();
                setCursor(cursor.itemId, false);
              }}
              className="shrink-0 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              unpin
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        ref={threadRef}
        onScroll={handleThreadScroll}
        data-lair-thread="true"
        className="relative min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5"
      >
        {isEmpty ? (
          <div className="flex min-h-full flex-col">
            {staleReports.length > 0 && staleSpecFile ? (
              <StaleSpecCard reports={staleReports} specFile={staleSpecFile} />
            ) : null}
            {pendingGate ? <ApprovalGateCard gate={pendingGate} /> : null}
            {pillarCheckPending ? <PillarCheckCard /> : null}
            <div className="min-h-0 flex-1">
              <EmptyState onPick={setText} />
            </div>
            {error ? (
              <ErrorState
                message={error.message}
                onRetry={() => void submitPrompt(error.prompt)}
              />
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {staleReports.length > 0 && staleSpecFile ? (
              <StaleSpecCard reports={staleReports} specFile={staleSpecFile} />
            ) : null}
            {pendingGate ? <ApprovalGateCard gate={pendingGate} /> : null}
            {pillarCheckPending ? <PillarCheckCard /> : null}
            {turns.map((turn) => (
              <TurnView
                key={turn.id}
                turn={turn}
                cardById={cardById}
                narrationById={narrationById}
                onRetry={(prompt) => void submitPrompt(prompt)}
                onEdit={editPrompt}
              />
            ))}
            {error ? (
              <ErrorState
                message={error.message}
                onRetry={() => void submitPrompt(error.prompt)}
              />
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-border/70 bg-card/90 px-3 pt-2.5 pb-3">
        <div
          data-lair-composer="command-surface"
          className="relative rounded-lg border border-border/80 bg-background/80 shadow-[0_1px_0_color-mix(in_oklch,var(--foreground)_7%,transparent)_inset] transition-[border-color,box-shadow] duration-200 focus-within:border-ring/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_18%,transparent)]"
        >
          <div className="flex h-7 items-center gap-1.5 border-b border-border/45 px-3 text-[10.5px] text-muted-foreground">
            <span className="font-mono uppercase tracking-wide">command</span>
            <span className="text-muted-foreground/45">/</span>
            <span className="min-w-0 truncate">
              {currentItem ? currentItem.label : workspace ? "workspace ready" : "set workspace first"}
            </span>
          </div>
          <textarea
            ref={composerRef}
            aria-label="Message Lair"
            className="block min-h-28 w-full resize-none rounded-lg bg-transparent px-3 py-2.5 pb-11 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Message Lair..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
          />
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between">
            <div className="pointer-events-auto">
              <AgentDropdown />
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => useLair.getState().toggleCritiqueTray()}
                className="flex h-6 items-center gap-1.5 rounded-md border border-border/60 bg-muted/70 px-2 text-[11px] font-medium text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-muted hover:text-foreground active:translate-y-px"
                title="Critique tray"
                aria-label="Toggle critique tray"
              >
                <span>{critiqueTrayOpen ? "hide" : "critique"}</span>
                {critiqueDraftCount > 0 ? (
                  <span className="rounded bg-background/70 px-1 text-[10px]">
                    {critiqueDraftCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="flex h-6 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground transition-[opacity,transform] duration-200 active:translate-y-px disabled:opacity-40"
                onClick={submit}
                disabled={!canSend}
                title="Send"
                aria-label="Send message"
              >
                <span>{sending ? "sending" : "send"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <CritiqueTray />
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
      <Select
        value={activeSessionId ?? ""}
        onValueChange={(value) => onSwitch(value)}
      >
        <SelectTrigger
          size="sm"
          className="h-6 w-auto max-w-[10rem] gap-1 rounded-md border border-transparent bg-transparent px-1.5 py-0 text-[10.5px] text-muted-foreground hover:border-border/60 hover:bg-background/50 hover:text-foreground [&>svg]:size-3"
          title="Switch Lair chat"
        >
          <SelectValue placeholder={activeTitle} />
        </SelectTrigger>
        <SelectContent className="rounded-md">
          {sorted.map((session) => (
            <SelectItem key={session.id} value={session.id} className="rounded-sm py-1 pr-6 pl-2 text-[11px]">
              {session.title || "New chat"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
  const workspace = useLair((s) => s.workspace);
  const queue = useLair((s) => s.queue);
  const cursor = useLair((s) => s.cursor);
  const workspaceLabel = workspace ? workspace.split(/[\\/]/).pop() || workspace : "no workspace";
  const currentItem = cursor.itemId ? findQueueItem(queue, cursor.itemId) : null;

  const suggestions: { label: string; prompt: string }[] = currentItem
    ? [
        { label: "Execute current task", prompt: "Execute this task." },
        { label: "Review the spec first", prompt: "Review the spec context before any edits." },
        { label: "Ask for a plan", prompt: "Outline how you'd approach this task before doing it." },
      ]
    : [
        { label: "Plan this feature", prompt: "Plan this feature." },
        { label: "Compare Claude and Codex", prompt: "Compare Claude and Codex on this task." },
        { label: "Inspect repo", prompt: "Inspect this repo and tell me what it does in 5 lines." },
      ];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-7 py-10 text-center">
      <div className="rounded-2xl border border-border/70 bg-background/65 p-2 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--foreground)_7%,transparent)]">
        <img src="/logo.png" alt="Lair" className="size-11 opacity-90" />
      </div>
      <div className="space-y-1.5">
        <p className="text-[14px] font-semibold tracking-tight">Lair / {workspaceLabel}</p>
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          {currentItem ? `Current: ${currentItem.label}` : "Pick a starter or type a message."}
        </p>
      </div>
      <div className="flex w-full flex-col gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-left text-[12px] font-medium text-foreground transition-[background-color,border-color,transform] duration-200 hover:border-border hover:bg-muted/55 active:translate-y-px"
          >
            <span className="block">{s.label}</span>
            <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
              {s.prompt}
            </span>
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
  onRetry: (prompt: string) => void;
  onEdit: (prompt: string) => void;
}

export function TurnView({
  turn,
  cardById,
  narrationById,
  onRetry,
  onEdit,
}: TurnViewProps) {
  const turnCards = turn.cardIds
    .map((id) => cardById.get(id))
    .filter((c): c is CardData => Boolean(c));
  const turnNarrations = turn.narrationIds
    .map((id) => narrationById.get(id))
    .filter((n): n is NarrationData => Boolean(n));

  return (
    <div data-lair-turn="timeline" className="group/turn relative flex flex-col gap-2.5 pl-3">
      <div
        aria-hidden
        className="absolute bottom-1.5 left-0 top-1.5 w-px bg-gradient-to-b from-primary/35 via-border/60 to-border/20"
      />
      <div data-lair-role="user" className="flex flex-col items-end gap-1">
        <PhaseLabel phase="prompt" align="right">
          prompt
        </PhaseLabel>
        <div className="max-w-[88%] rounded-xl rounded-br-md border border-border/70 bg-background/65 px-3 py-2 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--foreground)_6%,transparent)]">
          <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-foreground/90">
            {turn.prompt}
          </p>
        </div>
        <div className="pr-0.5 opacity-0 transition-opacity group-hover/turn:opacity-100 focus-within:opacity-100">
          <IconButton
            label="Edit prompt"
            title="Edit prompt"
            onClick={() => onEdit(turn.prompt)}
            icon={PencilEdit02Icon}
          />
        </div>
      </div>
      <div data-lair-role="assistant" className="flex flex-col gap-1.5">
        <PhaseLabel phase="agent-work">agent work</PhaseLabel>
        {turnNarrations.map((n) => (
          <NarrationLine key={n.id} line={n} />
        ))}
        {turnCards.map((card) => (
          <Card key={card.id} card={card} />
        ))}
        {turnCards.length === 0 && turnNarrations.length === 0 ? (
          <ThinkingState />
        ) : null}
        <div className="flex items-center gap-1 px-0.5 opacity-0 transition-opacity group-hover/turn:opacity-100 focus-within:opacity-100">
          <IconButton
            label="Copy assistant response"
            title="Copy response"
            onClick={() => void copyTurnResponse(turnCards)}
            icon={CopyIcon}
            disabled={turnCards.length === 0}
          />
          <IconButton
            label="Retry prompt"
            title="Retry"
            onClick={() => onRetry(turn.prompt)}
            icon={Refresh01Icon}
          />
        </div>
      </div>
    </div>
  );
}

function PhaseLabel({
  phase,
  align = "left",
  children,
}: {
  phase: string;
  align?: "left" | "right";
  children: string;
}) {
  return (
    <div
      data-lair-phase={phase}
      className={`font-mono text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground/70 ${align === "right" ? "pr-0.5 text-right" : "pl-0.5"}`}
    >
      {children}
    </div>
  );
}

function ThinkingState() {
  return (
    <div className="rounded-xl border border-border/70 bg-background/55 px-3 py-2.5 text-[12px] text-muted-foreground">
      <span className="mr-2 inline-block size-1.5 animate-pulse rounded-full bg-primary/70 align-middle" />
      <span>Thinking</span>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/35 bg-destructive/5 px-2.5 py-2 text-[12px] text-destructive">
      <div className="flex items-start justify-between gap-3">
        <p className="leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-medium transition-colors hover:bg-destructive/15"
        >
          retry
        </button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  title,
  onClick,
  icon,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  icon: typeof CopyIcon;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-accent hover:text-foreground active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
    >
      <HugeiconsIcon icon={icon} size={12} strokeWidth={1.75} />
    </button>
  );
}

async function copyTurnResponse(cards: CardData[]) {
  const text = cards
    .map((card) => [card.summary, card.outcome, card.raw_output].filter(Boolean).join("\n\n"))
    .filter(Boolean)
    .join("\n\n---\n\n");
  if (!text || !navigator?.clipboard?.writeText) return;
  await navigator.clipboard.writeText(text);
}

function findQueueItem(items: QueueItem[], id: string): QueueItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findQueueItem(item.children, id);
    if (found) return found;
  }
  return null;
}

