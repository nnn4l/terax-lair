import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Delete01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as api from "@/lair/api";
import { useLair } from "@/lair/state";
import type { QueueItem } from "@/lair/types";
import { QueueControls } from "@/lair/components/QueueControls";
import { QueueItemRow } from "@/lair/components/QueueItemRow";

interface Props {
  onImportClick: () => void;
  onSendItem: (item: QueueItem) => void;
}

export function QueuePanel({ onImportClick, onSendItem }: Props) {
  const queue = useLair((state) => state.queue);
  const cursor = useLair((state) => state.cursor);
  const setQueue = useLair((state) => state.setQueue);
  const setCursor = useLair((state) => state.setCursor);
  const setAutopilotPaused = useLair((state) => state.setAutopilotPaused);
  const setStaleReports = useLair((state) => state.setStaleReports);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const groups = useMemo(() => buildQueueGroups(queue), [queue]);

  useEffect(() => {
    void api.queueGet().then((items) => {
      if (items) setQueue(items);
    });
  }, [setQueue]);

  useEffect(() => {
    const queueEvents = api.onQueueEvent((event) => {
      if (event.type === "cursor_advanced") {
        setCursor(event.to ?? null);
      } else if (event.type === "item_completed") {
        void api.queueGet().then((items) => {
          if (items) setQueue(items);
        });
      } else if (event.type === "paused" || event.type === "blocked_awaiting_approval") {
        setAutopilotPaused(true);
      } else if (event.type === "resumed") {
        setAutopilotPaused(false);
      }
    });
    const specChanges = api.onSpecChanged((file) => {
      void api.queueCheckStale().then((reports) => {
        setStaleReports(reports, file);
        return api.queueGet();
      }).then((items) => {
        if (items) setQueue(items);
      });
    });
    return () => {
      void queueEvents.then((unlisten) => unlisten());
      void specChanges.then((unlisten) => unlisten());
    };
  }, [setAutopilotPaused, setCursor, setQueue, setStaleReports]);

  if (queue.length === 0) {
    return (
      <div className="flex max-h-[44vh] shrink-0 flex-col items-center justify-center gap-3 border-b border-border/60 bg-card/40 px-4 py-10 text-center">
        <p className="text-[12px] font-medium text-foreground/90">No queue yet</p>
        <p className="text-[11px] text-muted-foreground">
          Import a spec to build the queue.
        </p>
        <button
          type="button"
          onClick={onImportClick}
          className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          import spec
        </button>
      </div>
    );
  }

  const currentItem = cursor.itemId ? findQueueItem(queue, cursor.itemId) : null;

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function deleteGroup(group: QueueGroup) {
    const ok = window.confirm(`Drop ${group.label} from queue?`);
    if (!ok) return;
    for (const item of group.items) {
      await api.queueDrop(item.id);
    }
    const items = await api.queueGet();
    if (items) setQueue(items);
  }

  return (
    <div className="flex max-h-[44vh] shrink-0 flex-col border-b border-border/60 bg-card/40 text-[12px]">
      <div className="flex min-h-9 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-2">
        <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
          {currentItem ? `Now: ${currentItem.label}` : "Queue"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {currentItem ? (
            <button
              type="button"
              onClick={() => onSendItem(currentItem)}
              className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              restart
            </button>
          ) : null}
          {cursor.pinned ? (
            <button
              type="button"
              onClick={() => {
                void api.queueUnpin();
                setCursor(cursor.itemId, false);
              }}
              className="rounded px-1.5 py-0.5 text-[10px] text-amber-500 hover:bg-muted"
            >
              unpin
            </button>
          ) : null}
          <button
            type="button"
            onClick={onImportClick}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
          >
            import
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {groups.map((group) => {
          const collapsed = collapsedGroups.has(group.key);
          return (
            <section key={group.key} className="mb-1">
              <div className="group flex h-7 items-center gap-1 rounded-md px-1.5 text-[11px] text-muted-foreground hover:bg-muted/45">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-muted hover:text-foreground"
                  aria-label={collapsed ? "Expand spec group" : "Collapse spec group"}
                  title={collapsed ? "Expand" : "Collapse"}
                >
                  <HugeiconsIcon
                    icon={collapsed ? ArrowRight01Icon : ArrowDown01Icon}
                    size={11}
                    strokeWidth={1.75}
                  />
                </button>
                <span className="min-w-0 flex-1 truncate font-medium" title={group.title}>
                  {group.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground/70">
                  {group.done}/{group.total}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteGroup(group)}
                  className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/60 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label="Drop spec group"
                  title="Drop group"
                >
                  <HugeiconsIcon icon={Delete01Icon} size={11} strokeWidth={1.75} />
                </button>
              </div>
              {collapsed ? null : (
                <div>
                  {group.items.map((item) => (
                    <QueueItemRow
                      key={item.id}
                      item={item}
                      currentId={cursor.itemId}
                      pinnedId={cursor.pinned ? cursor.itemId : null}
                      onSendNow={(id) => {
                        const found = findQueueItem(queue, id);
                        if (found) onSendItem(found);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <QueueControls />
    </div>
  );
}

interface QueueGroup {
  key: string;
  label: string;
  title: string;
  items: QueueItem[];
  done: number;
  total: number;
}

function buildQueueGroups(items: QueueItem[]): QueueGroup[] {
  const groups = new Map<string, QueueGroup>();
  for (const item of items) {
    const source = firstSourceFile(item);
    const key = source ?? "__unfiled__";
    const existing = groups.get(key);
    const group =
      existing ??
      {
        key,
        label: source ? basename(source) : "Unfiled",
        title: source ?? "Items without a source spec",
        items: [],
        done: 0,
        total: 0,
      };
    group.items.push(item);
    group.done += countLeaves(item, true);
    group.total += countLeaves(item, false);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function firstSourceFile(item: QueueItem): string | null {
  if (item.source?.file) return item.source.file;
  for (const child of item.children) {
    const found = firstSourceFile(child);
    if (found) return found;
  }
  return null;
}

function countLeaves(item: QueueItem, checkedOnly: boolean): number {
  if (item.children.length === 0) {
    return checkedOnly ? (item.checked ? 1 : 0) : 1;
  }
  return item.children.reduce((sum, child) => sum + countLeaves(child, checkedOnly), 0);
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function findQueueItem(items: QueueItem[], id: string): QueueItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findQueueItem(item.children, id);
    if (found) return found;
  }
  return null;
}
