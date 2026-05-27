import { useEffect, useMemo, useRef, useState } from "react";
import {
  sendMessage,
  onCardUpdate,
  onStreamChunk,
  onNarration,
  onQueueEvent,
  onSpecChanged,
  queueCheckStale,
  queueGet,
  queueUnpin,
} from "@/lair/api";
import { useLair } from "@/lair/state";
import { AgentDropdown } from "@/lair/components/AgentDropdown";
import { Card } from "@/lair/components/Card";
import { NarrationLine } from "@/lair/components/NarrationLine";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApprovalGateCard } from "@/lair/components/ApprovalGateCard";
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

      {currentItem ? (
        <div className="relative flex min-h-8 shrink-0 items-center gap-2 border-b border-border/50 bg-muted/20 px-3 text-[11px]">
          <span className="shrink-0 text-muted-foreground">Now:</span>
          <span className="min-w-0 flex-1 truncate font-medium">{currentItem.label}</span>
          {cursor.pinned ? (
            <button
              type="button"
              onClick={() => {
                void queueUnpin();
                setCursor(cursor.itemId, false);
              }}
              className="shrink-0 rounded px-1.5 py-0.5 text-amber-500 hover:bg-muted"
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
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
      >
        {isEmpty ? (
          <div className="flex min-h-full flex-col">
            {staleReports.length > 0 && staleSpecFile ? (
              <StaleSpecCard reports={staleReports} specFile={staleSpecFile} />
            ) : null}
            {pendingGate ? <ApprovalGateCard gate={pendingGate} /> : null}
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
          <div className="flex flex-col gap-3 pb-4">
            {staleReports.length > 0 && staleSpecFile ? (
              <StaleSpecCard reports={staleReports} specFile={staleSpecFile} />
            ) : null}
            {pendingGate ? <ApprovalGateCard gate={pendingGate} /> : null}
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

      <div className="border-t border-border/60 bg-card/80 px-3 pt-2 pb-3">
        <div className="relative rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-ring">
          <textarea
            ref={composerRef}
            aria-label="Message Lair"
            className="block min-h-28 w-full resize-none rounded-md bg-transparent p-2.5 pb-10 text-[13px] leading-relaxed outline-none"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="type message..."
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
            <button
              type="button"
              className="pointer-events-auto flex h-6 items-center gap-1.5 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
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
          className="h-5 w-auto max-w-[11rem] gap-1 rounded-md border-0 bg-transparent px-1.5 py-0 text-[10.5px] text-muted-foreground hover:bg-accent hover:text-foreground [&>svg]:size-3"
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
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 py-10 text-center">
      <img src="/logo.png" alt="Lair" className="size-14 opacity-90" />
      <div className="space-y-1">
        <p className="text-[14px] font-semibold tracking-tight">Lair / {workspaceLabel}</p>
        <p className="text-[11px] text-muted-foreground">
          {currentItem ? `Current: ${currentItem.label}` : "Pick a starter or type a message."}
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s.prompt)}
            className="rounded-lg border border-border bg-card/70 px-3 py-2 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-muted/50"
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
    <div className="group/turn flex flex-col gap-2">
      <div data-lair-role="user" className="flex justify-end">
        <div className="max-w-[88%] rounded-lg rounded-br-sm border border-border/50 bg-muted/60 px-2.5 py-2 shadow-sm">
          <p className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-foreground/90">
            {turn.prompt}
          </p>
          <div className="mt-1 flex justify-end opacity-0 transition-opacity group-hover/turn:opacity-100 focus-within:opacity-100">
            <IconButton
              label="Edit prompt"
              title="Edit prompt"
              onClick={() => onEdit(turn.prompt)}
              icon={PencilEdit02Icon}
            />
          </div>
        </div>
      </div>
      <div data-lair-role="assistant" className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
            Response
          </span>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/turn:opacity-100 focus-within:opacity-100">
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
        {turnNarrations.map((n) => (
          <NarrationLine key={n.id} line={n} />
        ))}
        {turnCards.map((card) => (
          <Card key={card.id} card={card} />
        ))}
        {turnCards.length === 0 && turnNarrations.length === 0 ? (
          <ThinkingState />
        ) : null}
      </div>
    </div>
  );
}

function ThinkingState() {
  return (
    <div className="rounded-lg border border-border/50 bg-card/70 px-2.5 py-2 text-[12px] text-muted-foreground shadow-sm">
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
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-2 text-[12px] text-destructive">
      <div className="flex items-start justify-between gap-3">
        <p className="leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md bg-destructive/10 px-2 py-1 text-[11px] font-medium hover:bg-destructive/15"
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
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
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

