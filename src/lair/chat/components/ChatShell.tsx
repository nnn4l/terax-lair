import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Cancel01Icon,
  Copy01Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { useLairChat } from "@/lair/chat/store";
import type {
  ChatEmptySuggestion,
  ChatMessage,
  ChatRunCard,
  ChatScope,
  ChatType,
  LairChatSession,
} from "@/lair/chat/types";

interface ChatShellProps {
  chatId: string;
  title: string;
  type: ChatType;
  scope: ChatScope;
  emptyText: string;
  suggestions?: ChatEmptySuggestion[];
  className?: string;
  renderActions?: (text: string) => ReactNode;
}

export function ChatShell({
  chatId,
  title,
  type,
  scope,
  emptyText,
  suggestions = [],
  className,
  renderActions,
}: ChatShellProps) {
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const ensureChat = useLairChat((state) => state.ensureChat);
  const sendMessage = useLairChat((state) => state.sendMessage);
  const stopChat = useLairChat((state) => state.stopChat);
  const chat = useLairChat((state) =>
    state.chats.find((item) => item.id === chatId),
  );

  useEffect(() => {
    ensureChat({ id: chatId, title, type, scope });
  }, [chatId, ensureChat, scope, title, type]);

  const running = chat?.messages.some((message) => message.status === "streaming") ?? false;
  const canSend = draft.trim().length > 0 && !running;
  const lastMessage = chat?.messages[chat.messages.length - 1];
  const activityKey = `${chat?.messages.length ?? 0}:${lastMessage?.content.length ?? 0}:${chat?.runCards.length ?? 0}`;

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activityKey]);

  function onThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function submit() {
    const next = draft.trim();
    if (!next || !chat) return;
    setDraft("");
    void sendMessage(chat.id, next);
  }

  return (
    <section className={cn("flex h-full min-h-0 flex-col bg-card", className)}>
      <ChatHeader chat={chat} title={title} />
      <div
        ref={threadRef}
        onScroll={onThreadScroll}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        {!chat || chat.messages.length === 0 ? (
          <ChatEmpty
            text={emptyText}
            suggestions={suggestions}
            onPick={setDraft}
          />
        ) : (
          <Thread chat={chat} onRetry={setDraft} renderActions={renderActions} />
        )}
      </div>
      <footer className="border-t border-border/60 bg-card/90 px-4 pb-4 pt-3">
        <div className="rounded-lg border border-border/70 bg-background focus-within:ring-1 focus-within:ring-ring">
          <textarea
            aria-label={`Message ${title}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Message Lair"
            className="block min-h-20 w-full resize-none rounded-lg bg-transparent px-3 py-2.5 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-2.5 pb-2">
            <span className="text-[10px] text-muted-foreground">
              Enter sends, Shift+Enter adds line
            </span>
            {running ? (
              <button
                type="button"
                onClick={() => stopChat(chatId)}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={1.75} />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="inline-flex h-7 items-center rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground transition-opacity disabled:opacity-40"
              >
                Send
              </button>
            )}
          </div>
        </div>
      </footer>
    </section>
  );
}

function ChatHeader({
  chat,
  title,
}: {
  chat: LairChatSession | undefined;
  title: string;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4">
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-semibold tracking-tight">
          {title}
        </h2>
        <p className="truncate text-[10px] text-muted-foreground">
          {chat ? scopeLabel(chat.scope) : "Preparing chat"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <StateChip chat={chat} />
        <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {chat?.messages.filter((message) => message.role === "user").length ?? 0} turns
        </span>
      </div>
    </header>
  );
}

function StateChip({ chat }: { chat: LairChatSession | undefined }) {
  const label = useMemo(() => {
    if (!chat) return "Idle";
    switch (chat.agentState.kind) {
      case "orchestrating":
        return "Orchestrating";
      case "locked":
        return chat.agentState.agent === "codex" ? "Codex" : "Claude";
      case "handoff_pending":
        return "Handoff";
      case "error":
        return "Error";
      default:
        return chat.type === "brainstorm" ? "Brainstorm" : "Idle";
    }
  }, [chat]);

  return (
    <span className="inline-flex h-6 items-center rounded-full border border-border/60 bg-background px-2 text-[10.5px] font-medium text-muted-foreground">
      {label}
    </span>
  );
}

function Thread({
  chat,
  onRetry,
  renderActions,
}: {
  chat: LairChatSession;
  onRetry: (content: string) => void;
  renderActions?: (text: string) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-3">
      {chat.messages.map((message) => (
        <ChatBubble
          key={message.id}
          message={message}
          cards={chat.runCards.filter((card) => card.messageId === message.id)}
          onRetry={onRetry}
          renderActions={renderActions}
        />
      ))}
    </div>
  );
}

function ChatBubble({
  message,
  cards,
  onRetry,
  renderActions,
}: {
  message: ChatMessage;
  cards: ChatRunCard[];
  onRetry: (content: string) => void;
  renderActions?: (text: string) => ReactNode;
}) {
  const isAssistant = message.role === "assistant";
  const isUser = message.role === "user";
  return (
    <Message
      from={message.role}
      className={cn(isUser && "ml-auto max-w-[78%] items-end")}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1.5",
          isUser ? "items-end" : "w-full items-start",
        )}
      >
        <MessageContent
          className={cn(
            isUser && "max-w-full",
            isAssistant && "w-full max-w-full",
          )}
        >
          {isAssistant ? (
            message.content ? (
              <MessageResponse streaming={message.status === "streaming"}>
                {message.content}
              </MessageResponse>
            ) : (
              <span className="text-muted-foreground">Thinking</span>
            )
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </MessageContent>
        {isAssistant && renderActions && message.content.trim() ? (
          <div className="mt-1.5">{renderActions(message.content)}</div>
        ) : null}
      </div>
      {cards.length > 0 ? (
        <div
          className={cn(
            "flex flex-col gap-1.5",
            isUser ? "items-end" : "w-full items-start",
          )}
        >
          {cards.map((card) => (
            <RunCard key={card.id} card={card} />
          ))}
        </div>
      ) : null}
      <MessageActions
        className={cn(
          "h-5 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100",
          isUser ? "justify-end" : "justify-start",
        )}
      >
        {isAssistant ? (
          <MessageAction
            tooltip="Copy"
            size="icon-xs"
            onClick={() => void copyText(message.content)}
          >
            <HugeiconsIcon icon={Copy01Icon} size={11} strokeWidth={1.75} />
          </MessageAction>
        ) : (
          <MessageAction
            tooltip="Edit"
            size="icon-xs"
            onClick={() => onRetry(message.content)}
          >
            <HugeiconsIcon
              icon={PencilEdit02Icon}
              size={11}
              strokeWidth={1.75}
            />
          </MessageAction>
        )}
      </MessageActions>
    </Message>
  );
}

function RunCard({ card }: { card: ChatRunCard }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/70 px-2.5 py-2 text-[11px] shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground/90">{card.title}</span>
        <span className="text-[10px] text-muted-foreground">{card.status}</span>
      </div>
      {card.detail ? (
        <p className="mt-1 text-muted-foreground">{card.detail}</p>
      ) : null}
    </div>
  );
}

function ChatEmpty({
  text,
  suggestions,
  onPick,
}: {
  text: string;
  suggestions: ChatEmptySuggestion[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="space-y-1">
        <p className="text-[13px] font-semibold tracking-tight">Start chat</p>
        <p className="max-w-md text-[12px] leading-relaxed text-muted-foreground">
          {text}
        </p>
      </div>
      {suggestions.length > 0 ? (
        <div className="flex max-w-xl flex-wrap justify-center gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => onPick(suggestion.prompt)}
              className="inline-flex h-7 items-center rounded-full border border-border/60 bg-background px-2.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function scopeLabel(scope: ChatScope): string {
  if (scope.kind === "dashboard") return "Dashboard / vault";
  if (scope.kind === "spec") return "Spec chat";
  return scope.repoPath.split(/[\\/]/).pop() || scope.repoPath;
}

async function copyText(text: string) {
  if (!text || !navigator?.clipboard?.writeText) return;
  await navigator.clipboard.writeText(text);
}
