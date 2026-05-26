import { cn } from "@/lib/utils";
import type { QueueItem } from "@/lair/types";

interface Props {
  item: QueueItem;
  depth?: number;
  currentId: string | null;
  onPin: (id: string) => void;
  onSendNow: (id: string) => void;
}

export function QueueItemRow({
  item,
  depth = 0,
  currentId,
  onPin,
  onSendNow,
}: Props) {
  const isCurrent = item.id === currentId;
  const paddingLeft = depth * 14 + 6;

  return (
    <>
      <div
        className={cn(
          "group flex min-h-7 items-center gap-1.5 rounded-md py-1 pr-1 text-[11.5px] transition-colors",
          isCurrent ? "bg-primary/10 text-foreground" : "hover:bg-muted/45",
          item.stale && "border-l-2 border-amber-500",
        )}
        style={{ paddingLeft }}
      >
        <input
          type="checkbox"
          checked={item.checked}
          readOnly
          className="size-3 shrink-0"
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            item.checked && "text-muted-foreground/50 line-through",
          )}
          title={item.label}
        >
          {item.label}
        </span>
        {item.stale ? (
          <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] text-amber-500">
            stale
          </span>
        ) : null}
        {item.agent_hint ? (
          <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
            {item.agent_hint}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onPin(item.id)}
          className="shrink-0 rounded px-1 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          pin
        </button>
        <button
          type="button"
          onClick={() => onSendNow(item.id)}
          className="shrink-0 rounded px-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          send
        </button>
      </div>
      {item.children.map((child) => (
        <QueueItemRow
          key={child.id}
          item={child}
          depth={depth + 1}
          currentId={currentId}
          onPin={onPin}
          onSendNow={onSendNow}
        />
      ))}
    </>
  );
}
