import { useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Cancel01Icon, Home03Icon } from "@hugeicons/core-free-icons";
import { useLair } from "@/lair/state";
import { cn } from "@/lib/utils";

interface Props {
  onHome: () => void;
}

export function ChatTabStrip({ onHome }: Props) {
  const chatTabs = useLair((s) => s.chatTabs);
  const activeTabId = useLair((s) => s.activeTabId);
  const sessions = useLair((s) => s.sessions);
  const activeSessionId = useLair((s) => s.activeSessionId);
  const switchChatTab = useLair((s) => s.switchChatTab);
  const closeChatTab = useLair((s) => s.closeChatTab);
  const addChatTab = useLair((s) => s.addChatTab);
  const newSession = useLair((s) => s.newSession);
  const markTabSeen = useLair((s) => s.markTabSeen);
  const switchSession = useLair((s) => s.switchSession);

  useEffect(() => {
    if (activeTabId) markTabSeen(activeTabId);
  }, [activeTabId, activeSessionId, markTabSeen]);

  useEffect(() => {
    if (!activeSessionId) return;
    if (chatTabs.some((tab) => tab.sessionId === activeSessionId)) return;
    addChatTab(activeSessionId);
  }, [activeSessionId, addChatTab, chatTabs]);

  function newTab() {
    const sessionId = newSession();
    addChatTab(sessionId);
  }

  function activate(tabId: string, sessionId: string) {
    switchChatTab(tabId);
    switchSession(sessionId);
  }

  function close(tabId: string) {
    const wasActive = tabId === activeTabId;
    const nextTabs = chatTabs.filter((tab) => tab.id !== tabId);
    closeChatTab(tabId);
    if (wasActive) {
      const next = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1] : null;
      if (next) switchSession(next.sessionId);
    }
  }

  return (
    <div className="relative flex h-8 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border/60 bg-card/40 px-2">
      {chatTabs.map((tab) => {
        const session = sessions.find((s) => s.id === tab.sessionId);
        const title = session?.title ?? "New chat";
        const isActive = tab.id === activeTabId;
        const latestCardId = session?.cards.length ? session.cards[session.cards.length - 1].id : null;
        const hasUnread =
          !isActive && tab.lastSeenCardId !== latestCardId && Boolean(latestCardId);
        return (
          <div
            key={tab.id}
            className={cn(
              "group flex h-6 max-w-[10rem] shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors",
              isActive
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <button
              type="button"
              onClick={() => activate(tab.id, tab.sessionId)}
              className="flex min-w-0 flex-1 items-center gap-1 focus:outline-none"
            >
              {hasUnread ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
              <span className="truncate">{title}</span>
            </button>
            <button
              type="button"
              onClick={() => close(tab.id)}
              className="flex size-3.5 shrink-0 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
              aria-label="Close tab"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={9} strokeWidth={1.75} />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={newTab}
        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="New chat"
        title="New chat"
      >
        <HugeiconsIcon icon={Add01Icon} size={11} strokeWidth={1.75} />
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onHome}
        className="flex h-5 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Sessions home"
      >
        <HugeiconsIcon icon={Home03Icon} size={11} strokeWidth={1.75} />
        home
      </button>
    </div>
  );
}
