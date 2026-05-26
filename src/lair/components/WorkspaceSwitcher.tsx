import { useEffect, useMemo, useState } from "react";
import { Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { listWorktrees } from "@/lair/api";
import { useLair } from "@/lair/state";
import type { Worktree } from "@/lair/types";

export function WorkspaceSwitcher() {
  const workspace = useLair((state) => state.workspace);
  const setWorkspace = useLair((state) => state.setWorkspace);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const values: Worktree[] = [];
    if (workspace) {
      seen.add(workspace);
      values.push({ path: workspace, branch: null });
    }
    for (const worktree of worktrees) {
      if (seen.has(worktree.path)) continue;
      seen.add(worktree.path);
      values.push(worktree);
    }
    return values;
  }, [workspace, worktrees]);

  async function refresh() {
    if (!workspace || loading) return;
    setLoading(true);
    setError(null);
    try {
      setWorktrees(await listWorktrees(workspace));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [workspace]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <select
        value={workspace}
        onChange={(event) => setWorkspace(event.target.value)}
        className="h-8 min-w-0 max-w-64 rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
        title={error ?? workspace}
      >
        {!workspace ? <option value="">no workspace</option> : null}
        {options.map((worktree) => (
          <option key={worktree.path} value={worktree.path}>
            {formatWorktreeLabel(worktree, worktree.path === workspace)}
          </option>
        ))}
      </select>
      <button
        type="button"
        title={loading ? "refreshing..." : "refresh worktrees"}
        aria-label="refresh worktrees"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={() => void refresh()}
        disabled={!workspace || loading}
      >
        <HugeiconsIcon
          icon={Refresh01Icon}
          size={14}
          className={loading ? "animate-spin" : ""}
        />
      </button>
    </div>
  );
}

function formatWorktreeLabel(worktree: Worktree, current: boolean): string {
  const suffix = [
    worktree.branch ? worktree.branch : null,
    current ? "current" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return suffix ? `${worktree.path} (${suffix})` : worktree.path;
}
