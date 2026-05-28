import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { openRepoTab } from "@/lair/api";
import { useHub } from "@/lair/hub";
import { rememberWorkspace } from "@/lair/components/WorkspaceLauncher";

interface OpenWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenWorkspaceDialog({
  open: isOpen,
  onOpenChange,
}: OpenWorkspaceDialogProps) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setHubState = useHub((s) => s.setHubState);

  async function browse() {
    const picked = await open({
      directory: true,
      multiple: false,
      title: "Select a repo workspace",
    });
    if (typeof picked === "string") setPath(picked);
  }

  async function submit() {
    const trimmed = path.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const next = await openRepoTab(trimmed);
      setHubState(next);
      rememberWorkspace(trimmed);
      setPath("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open workspace</DialogTitle>
          <DialogDescription>
            Pick a git repository. Lair opens it in a new tab.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="C:\\path\\to\\repo"
            disabled={busy}
            aria-label="Workspace path"
          />
          <Button variant="secondary" onClick={browse} disabled={busy}>
            Browse
          </Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !path.trim()}>
            Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
