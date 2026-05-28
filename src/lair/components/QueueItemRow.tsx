import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { QueueItemMenu } from "@/lair/components/QueueItemMenu";
import type { QueueItem } from "@/lair/types";

interface Props {
  item: QueueItem;
  depth?: number;
  number: string;
  currentId: string | null;
  pinnedId: string | null;
  onSendNow: (id: string) => void;
}

export function QueueItemRow({
  item,
  depth = 0,
  number,
  currentId,
  pinnedId,
  onSendNow,
}: Props) {
  const isCurrent = item.id === currentId;
  const paddingLeft = depth * 16 + 6;

  return (
    <div
      className={cn(
        "group flex min-h-7 items-center gap-1.5 rounded-md py-1 pr-1 text-[11.5px] transition-colors",
        isCurrent ? "bg-primary/10 text-foreground ring-1 ring-primary/15" : "hover:bg-muted/45",
        item.stale && "border-l-2 border-amber-500",
      )}
      style={{ paddingLeft }}
    >
      <span className="w-9 shrink-0 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground/70">
        {number}
      </span>
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full",
          item.checked
            ? "text-emerald-500"
            : "border border-border bg-background/70",
        )}
        aria-hidden
      >
        {item.checked ? (
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} strokeWidth={1.8} />
        ) : null}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          item.checked && "text-muted-foreground/50 line-through",
        )}
        title={item.label}
      >
        {item.label}
      </span>
      {isCurrent ? (
        <span className="shrink-0 rounded bg-primary/12 px-1 text-[10px] font-medium text-primary">
          current
        </span>
      ) : null}
      {item.stale ? (
        <span className="shrink-0 rounded bg-amber-500/15 px-1 text-[10px] text-amber-500">
          stale
        </span>
      ) : null}
      <QueueItemMenu
        item={item}
        isPinned={item.id === pinnedId}
        onSendNow={onSendNow}
      />
    </div>
  );
}
