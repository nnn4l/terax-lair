import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Delete01Icon,
  FileImportIcon,
  Refresh01Icon,
  Task01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as api from "@/lair/api";
import { useLair } from "@/lair/state";
import type { QueueItem } from "@/lair/types";
import { QueueControls } from "@/lair/components/QueueControls";
import { QueueItemRow } from "@/lair/components/QueueItemRow";
import { numberQueueItems } from "@/lair/components/queueNumbering";

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
      <div className="flex max-h-[44vh] shrink-0 flex-col border-b border-border/60 bg-card/40 px-4 py-6">
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/45 px-3.5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground">
              <HugeiconsIcon icon={Task01Icon} size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold tracking-tight text-foreground/90">
                No implementation plan loaded
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Import a Claude Code plan to turn tasks into a runnable queue.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onImportClick}
            className="flex h-8 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.98]"
          >
            <HugeiconsIcon icon={FileImportIcon} size={13} strokeWidth={1.75} />
            Import plan
          </button>
        </div>
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
          {currentItem ? `Current task: ${currentItem.label}` : "Implementation plan"}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {currentItem ? (
            <button
              type="button"
              onClick={() => onSendItem(currentItem)}
              className="flex h-6 items-center gap-1 rounded-full px-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Run the current task again"
            >
              <HugeiconsIcon icon={Refresh01Icon} size={11} strokeWidth={1.75} />
              Run current again
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
            className="flex h-7 items-center gap-1.5 rounded-full bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:scale-[0.98]"
          >
            <HugeiconsIcon icon={FileImportIcon} size={12} strokeWidth={1.75} />
            Import plan
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {groups.map((group, groupIndex) => {
          const collapsed = collapsedGroups.has(group.key);
          const groupNumber = String(groupIndex + 1);
          const rows = numberQueueItems(group.items);
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
                <span className="w-5 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground/70">
                  {groupNumber}
                </span>
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
                  {rows.map((row) => (
                    <QueueItemRow
                      key={row.id}
                      item={row.item}
                      depth={row.depth}
                      number={`${groupNumber}.${row.number}`}
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
