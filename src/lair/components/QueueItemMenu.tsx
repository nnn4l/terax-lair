import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Delete01Icon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  PinIcon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EditContextDialog } from "@/lair/components/EditContextDialog";
import {
  queueDrop,
  queueEditContext,
  queueMarkDone,
  queuePin,
  queueUnpin,
} from "@/lair/api";
import { useLair } from "@/lair/state";
import type { QueueItem } from "@/lair/types";

interface Props {
  item: QueueItem;
  isPinned: boolean;
  onSendNow: (id: string) => void;
}

export function QueueItemMenu({ item, isPinned, onSendNow }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const setCursor = useLair((s) => s.setCursor);

  async function handlePin() {
    if (isPinned) {
      await queueUnpin();
      setCursor(null, false);
    } else {
      await queuePin(item.id);
      setCursor(item.id, true);
    }
    setOpen(false);
  }

  function handleSend() {
    onSendNow(item.id);
    setOpen(false);
  }

  async function handleMarkDone() {
    await queueMarkDone(item.id);
    setOpen(false);
  }

  async function handleDrop() {
    await queueDrop(item.id);
    setOpen(false);
  }

  async function handleEditSave(context: string) {
    await queueEditContext(item.id, context);
    setEditing(false);
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Item actions"
          >
            <HugeiconsIcon icon={MoreVerticalIcon} size={12} strokeWidth={1.75} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-1">
          <MenuItem icon={SentIcon} label="Run now" onClick={handleSend} />
          <MenuItem
            icon={PinIcon}
            label={isPinned ? "Unpin next" : "Pin next"}
            onClick={() => void handlePin()}
          />
          <MenuItem
            icon={PencilEdit02Icon}
            label="Edit context"
            onClick={() => {
              setOpen(false);
              setEditing(true);
            }}
          />
          <MenuItem
            icon={CheckmarkCircle02Icon}
            label="Mark complete"
            onClick={() => void handleMarkDone()}
          />
          <MenuItem
            icon={Delete01Icon}
            label="Drop"
            onClick={() => void handleDrop()}
            tone="danger"
          />
        </PopoverContent>
      </Popover>
      {editing ? (
        <EditContextDialog
          initialValue={item.context}
          onCancel={() => setEditing(false)}
          onSave={handleEditSave}
        />
      ) : null}
    </>
  );
}

interface MenuItemProps {
  icon: typeof MoreVerticalIcon;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}

function MenuItem({ icon, label, onClick, tone = "default" }: MenuItemProps) {
  const cls =
    tone === "danger"
      ? "text-destructive hover:bg-destructive/10"
      : "text-foreground hover:bg-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${cls}`}
    >
      <HugeiconsIcon icon={icon} size={12} strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}
