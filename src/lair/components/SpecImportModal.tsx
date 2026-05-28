import { useEffect, useState } from "react";
import * as api from "@/lair/api";
import { useLair } from "@/lair/state";
import type { QueueItem } from "@/lair/types";

interface Props {
  open: boolean;
  onClose: () => void;
  workspace: string;
}

export function SpecImportModal({ open, onClose, workspace }: Props) {
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [specList, setSpecList] = useState<string[]>([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [selected, setSelected] = useState("");
  const [pasted, setPasted] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setQueue = useLair((state) => state.setQueue);
  const setCursor = useLair((state) => state.setCursor);

  useEffect(() => {
    if (!open || tab !== "file" || !workspace) return;
    setLoadingSpecs(true);
    setError(null);
    void api
      .listSpecs(workspace)
      .then(setSpecList)
      .catch((err) => setError(String(err)))
      .finally(() => setLoadingSpecs(false));
  }, [open, tab, workspace]);

  async function doImport() {
    setLoading(true);
    setError(null);
    try {
      let items: QueueItem[];
      if (tab === "file") {
        if (!selected) {
          setError("Select a file.");
          return;
        }
        items = await api.importSpec(workspace, selected);
      } else {
        if (!pasted.trim()) {
          setError("Paste spec content.");
          return;
        }
        items = await api.pasteSpec(workspace, pasted);
      }
      setQueue(items);
      setCursor(firstLeaf(items));
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const canImport =
    !loading && (tab === "file" ? selected.length > 0 : pasted.trim().length > 0);
  const selectedLabel = selected.replace(/\\/g, "/").split("/").slice(-2).join("/");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4">
      <div className="flex max-h-[80vh] w-[min(34rem,100%)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="flex min-h-11 items-center justify-between border-b border-border px-4">
          <h2 className="text-[13px] font-semibold">Import spec</h2>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            close
          </button>
        </div>
        <div className="grid grid-cols-2 border-b border-border text-[12px]">
          <button
            type="button"
            onClick={() => setTab("file")}
            className={tab === "file" ? "bg-muted py-2 font-medium" : "py-2 text-muted-foreground"}
          >
            from repo
          </button>
          <button
            type="button"
            onClick={() => setTab("paste")}
            className={tab === "paste" ? "bg-muted py-2 font-medium" : "py-2 text-muted-foreground"}
          >
            paste
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "file" ? (
            loadingSpecs ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 animate-pulse rounded-md bg-muted/55" />
                ))}
              </div>
            ) : specList.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                No markdown files found under docs.
              </p>
            ) : (
              <div className="space-y-1">
                {specList.map((file) => (
                  <button
                    key={file}
                    type="button"
                    onClick={() => setSelected(file)}
                    className={
                      "w-full rounded-md px-2 py-1.5 text-left text-[12px] " +
                      (selected === file ? "bg-primary/10 text-foreground ring-1 ring-primary/25" : "text-muted-foreground hover:bg-muted/60")
                    }
                  >
                    {file.replace(/\\/g, "/").split("/").slice(-2).join("/")}
                  </button>
                ))}
              </div>
            )
          ) : (
            <textarea
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder="Paste spec markdown here..."
              className="h-56 w-full resize-none rounded-md border border-border bg-background p-2 text-[12px] outline-none focus:ring-1 focus:ring-ring"
            />
          )}
          {loading ? (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-muted/35 px-3 py-2 text-[12px] text-muted-foreground">
              <span className="size-3 animate-spin rounded-full border border-muted-foreground/30 border-t-foreground" />
              <span>
                {tab === "file" && selectedLabel
                  ? `Building queue from ${selectedLabel}...`
                  : "Building queue from pasted spec..."}
              </span>
            </div>
          ) : tab === "file" && selected ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Selected: <span className="text-foreground">{selectedLabel}</span>
            </p>
          ) : null}
          {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-md px-3 py-1 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={() => void doImport()}
            disabled={!canImport}
            className="flex min-w-20 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1 text-[12px] font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="size-3 animate-spin rounded-full border border-primary-foreground/35 border-t-primary-foreground" />
                importing
              </>
            ) : (
              "import"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function firstLeaf(items: QueueItem[]): string | null {
  for (const item of items) {
    if (item.children.length === 0) return item.id;
    const found = firstLeaf(item.children);
    if (found) return found;
  }
  return null;
}
