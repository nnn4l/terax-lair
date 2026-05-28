import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { useLair } from "@/lair/state";
import { cn } from "@/lib/utils";
import type { LairSession } from "@/lair/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FilterRole = "all" | "implementor" | "reviewer" | "pinned";

export function SessionsHome({ open, onClose }: Props) {
  const sessions = useLair((s) => s.sessions);
  const cards = useLair((s) => s.cards);
  const chatTabs = useLair((s) => s.chatTabs);
  const switchSession = useLair((s) => s.switchSession);
  const switchChatTab = useLair((s) => s.switchChatTab);
  const addChatTab = useLair((s) => s.addChatTab);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterRole>("all");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    return sessions
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((session) => {
        const tab = chatTabs.find((item) => item.sessionId === session.id);
        if (filter === "pinned" && !tab?.pinned) return false;
        if (!query) return true;
        const haystack = `${session.title ?? ""} ${session.workspace ?? ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      });
  }, [sessions, query, filter, chatTabs]);

  function openSession(session: LairSession) {
    const existing = chatTabs.find((t) => t.sessionId === session.id);
    if (existing) {
      switchChatTab(existing.id);
      switchSession(session.id);
    } else {
      addChatTab(session.id);
      switchSession(session.id);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto mt-12 flex h-[80vh] w-[min(960px,90vw)] flex-col gap-3 rounded-xl border border-border bg-background/95 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[14px] font-semibold tracking-tight">Sessions</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={12} strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-card px-2.5">
            <HugeiconsIcon icon={Search01Icon} size={12} strokeWidth={1.75} className="text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="search sessions..."
              className="h-8 w-full bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/70"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["all", "implementor", "reviewer", "pinned"] as FilterRole[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "rounded px-2 py-1 text-[10.5px]",
                  filter === item
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto pb-2 md:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="col-span-full mt-8 text-center text-[12px] text-muted-foreground">
              No sessions match.
            </p>
          ) : null}
          {filtered.map((session) => {
            const sessionCards = session.cards.length > 0
              ? session.cards
              : cards.filter((card) => session.turns.some((turn) => turn.cardIds.includes(card.id)));
            const lastCard = sessionCards.length > 0 ? sessionCards[sessionCards.length - 1] : undefined;
            const preview = lastCard?.summary || lastCard?.outcome || "No agent output yet.";
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => openSession(session)}
                className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-card/80"
              >
                <header className="flex items-start justify-between gap-2">
                  <span className="line-clamp-1 text-[12px] font-semibold">{session.title || "New chat"}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {relativeTime(session.updatedAt)}
                  </span>
                </header>
                <p className="line-clamp-3 text-[11px] text-muted-foreground">{preview}</p>
                <footer className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                  <span>{session.turns.length} turns</span>
                  <span>·</span>
                  <span>{session.workspace.split(/[\\/]/).pop() || "no workspace"}</span>
                </footer>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
