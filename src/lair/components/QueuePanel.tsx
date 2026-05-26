import { useEffect } from "react";
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

  const currentItem = cursor.itemId ? findQueueItem(queue, cursor.itemId) : null;

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
        {queue.length === 0 ? (
          <div className="px-4 py-8 text-center text-[11px] text-muted-foreground">
            Import a spec to build the queue.
          </div>
        ) : (
          queue.map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              currentId={cursor.itemId}
              onPin={(id) => {
                void api.queuePin(id);
                setCursor(id, true);
              }}
              onSendNow={(id) => {
                const found = findQueueItem(queue, id);
                if (found) onSendItem(found);
              }}
            />
          ))
        )}
      </div>
      <QueueControls />
    </div>
  );
}

function findQueueItem(items: QueueItem[], id: string): QueueItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findQueueItem(item.children, id);
    if (found) return found;
  }
  return null;
}
