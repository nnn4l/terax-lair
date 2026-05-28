import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Folder01Icon, StarIcon } from "@hugeicons/core-free-icons";
import { openRepoTab, switchHubTab } from "@/lair/api";
import { useHub } from "@/lair/hub";
import type { HubTab } from "@/lair/types";
import { rememberWorkspace } from "@/lair/components/WorkspaceLauncher";

const RECENT_KEY = "lair.recentWorkspaces";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

interface Props {
  onOpenDialog: () => void;
}

export function WorkspacesColumn({ onOpenDialog }: Props) {
  const [recent, setRecent] = useState<string[]>([]);
  const tabs = useHub((s) => s.tabs);
  const setHubState = useHub((s) => s.setHubState);

  useEffect(() => {
    setRecent(loadRecent());
  }, [tabs]);

  async function activate(path: string) {
    const existing = tabs.find((tab: HubTab) => tab.kind === "repo" && tab.repo_path === path);
    try {
      const next = existing ? await switchHubTab(existing.id) : await openRepoTab(path);
      setHubState(next);
      rememberWorkspace(path);
      setRecent(loadRecent());
    } catch {
      // Keep stale recent entries visible until user replaces them.
    }
  }

  return (
    <aside className="flex h-full flex-col gap-2 border-r border-border/40 p-4">
      <header>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Workspaces
        </p>
      </header>
      {recent.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/60 p-4 text-center">
          <p className="text-[12px] text-muted-foreground">No workspaces yet.</p>
          <button
            type="button"
            onClick={onOpenDialog}
            className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            + open workspace
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {recent.slice(0, 6).map((path, index) => {
            const name = path.split(/[\\/]/).pop() || path;
            const isStar = index === 0;
            return (
              <li key={path}>
                <button
                  type="button"
                  onClick={() => void activate(path)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-muted/30"
                >
                  {isStar ? (
                    <HugeiconsIcon icon={StarIcon} size={11} strokeWidth={1.75} className="text-amber-400" />
                  ) : (
                    <HugeiconsIcon icon={Folder01Icon} size={11} strokeWidth={1.75} className="text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate" title={path}>{name}</span>
                </button>
              </li>
            );
          })}
          <li className="mt-1">
            <button
              type="button"
              onClick={onOpenDialog}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            >
              + open another
            </button>
          </li>
        </ul>
      )}
    </aside>
  );
}
