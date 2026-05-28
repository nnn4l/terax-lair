import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { WindowControls } from "@/components/WindowControls";
import {
  Add01Icon,
  Cancel01Icon,
  Home03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { closeHubTab, listHubTabs, switchHubTab } from "@/lair/api";
import { useHub } from "@/lair/hub";
import type { HubState } from "@/lair/types";

interface TabStripProps {
  onOpenWorkspace: () => void;
}

export function TabStrip({ onOpenWorkspace }: TabStripProps) {
  const tabs = useHub((s) => s.tabs);
  const activeTabId = useHub((s) => s.activeTabId);
  const setHubState = useHub((s) => s.setHubState);

  useEffect(() => {
    listHubTabs().then(setHubState).catch(() => {});
    const unlistenP = listen<HubState>("lair-hub-tabs-changed", (event) =>
      setHubState(event.payload),
    );
    return () => {
      unlistenP.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [setHubState]);

  async function handleSwitch(id: string) {
    if (id === activeTabId) return;
    try {
      const next = await switchHubTab(id);
      setHubState(next);
    } catch {
      // Keep stale local UI until next backend snapshot.
    }
  }

  async function handleClose(event: React.MouseEvent, id: string) {
    event.stopPropagation();
    try {
      const next = await closeHubTab(id);
      setHubState(next);
    } catch {
      // Keep stale local UI until next backend snapshot.
    }
  }

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 bg-background/95 pl-2"
      data-lair-tab-strip
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const isDashboard = tab.kind === "dashboard";
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => void handleSwitch(tab.id)}
            className={cn(
              "group flex h-7 min-w-0 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
              active
                ? "border-border bg-card text-foreground"
                : "border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {isDashboard ? (
              <HugeiconsIcon icon={Home03Icon} size={12} strokeWidth={1.75} />
            ) : null}
            <span className="max-w-[10rem] truncate">{tab.label}</span>
            {!isDashboard ? (
              <span
                role="button"
                tabIndex={-1}
                onClick={(event) => void handleClose(event, tab.id)}
                className="ml-1 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                aria-label={`Close ${tab.label}`}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={10}
                  strokeWidth={1.75}
                />
              </span>
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOpenWorkspace}
        className="ml-1 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
        aria-label="Open workspace"
      >
        <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.75} />
      </button>
      <div data-tauri-drag-region className="flex-1 self-stretch" />
      {USE_CUSTOM_WINDOW_CONTROLS ? <WindowControls /> : null}
    </div>
  );
}
