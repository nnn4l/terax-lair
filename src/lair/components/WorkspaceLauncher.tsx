import { useEffect, useState } from "react";
import { Folder01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { openRepoTab, switchHubTab } from "@/lair/api";
import { useHub } from "@/lair/hub";
import type { HubTab } from "@/lair/types";

const RECENT_KEY = "lair.recentWorkspaces";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(paths: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(paths.slice(0, 10)));
  } catch {
    // Local storage can be unavailable in restricted contexts.
  }
}

export function rememberWorkspace(path: string) {
  const next = [path, ...loadRecent().filter((p) => p !== path)];
  saveRecent(next);
}

export function WorkspaceLauncher() {
  const [recent, setRecent] = useState<string[]>([]);
  const tabs = useHub((s) => s.tabs);
  const setHubState = useHub((s) => s.setHubState);

  useEffect(() => {
    setRecent(loadRecent());
  }, [tabs]);

  async function activate(path: string) {
    const existing = tabs.find(
      (tab: HubTab) => tab.kind === "repo" && tab.repo_path === path,
    );
    try {
      if (existing) {
        const next = await switchHubTab(existing.id);
        setHubState(next);
      } else {
        const next = await openRepoTab(path);
        setHubState(next);
        rememberWorkspace(path);
        setRecent(loadRecent());
      }
    } catch {
      // Invalid or missing recent entries stay visible until user opens a valid one.
    }
  }

  const openPaths = new Set(
    tabs
      .filter((tab: HubTab) => tab.kind === "repo")
      .map((tab) => tab.repo_path ?? ""),
  );

  return (
    <aside className="flex h-full w-full flex-col gap-3 p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Recent workspaces
      </h3>
      {recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No recent workspaces. Use the plus tab to open one.
        </p>
      ) : (
        <ul className="space-y-1">
          {recent.map((path) => (
            <li key={path}>
              <button
                type="button"
                onClick={() => void activate(path)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-card"
              >
                <HugeiconsIcon
                  icon={Folder01Icon}
                  size={14}
                  strokeWidth={1.75}
                />
                <span className="flex-1 truncate" title={path}>
                  {path.split(/[\\/]/).pop() || path}
                </span>
                {openPaths.has(path) ? (
                  <span className="text-[10px] text-muted-foreground">
                    open
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
