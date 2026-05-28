import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export type SystemCardTone = "info" | "warning" | "success" | "danger";

interface Props {
  tone: SystemCardTone;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  onDismiss?: () => void;
}

const TONE_STYLES: Record<SystemCardTone, { border: string; text: string; bg: string }> = {
  info: { border: "border-sky-500/40", text: "text-sky-300", bg: "bg-sky-500/5" },
  warning: { border: "border-amber-500/40", text: "text-amber-400", bg: "bg-amber-500/5" },
  success: { border: "border-emerald-500/40", text: "text-emerald-400", bg: "bg-emerald-500/5" },
  danger: { border: "border-destructive/50", text: "text-destructive", bg: "bg-destructive/5" },
};

const TONE_ICONS: Record<SystemCardTone, typeof Alert02Icon> = {
  info: InformationCircleIcon,
  warning: Alert02Icon,
  success: CheckmarkCircle02Icon,
  danger: Alert02Icon,
};

export function SystemCard({ tone, title, children, actions, onDismiss }: Props) {
  const style = TONE_STYLES[tone];
  const Icon = TONE_ICONS[tone];
  return (
    <div className={cn("my-2 rounded-lg border px-3 py-2.5 shadow-sm", style.border, style.bg)}>
      <div className="mb-1.5 flex items-center gap-2">
        <HugeiconsIcon icon={Icon} size={14} strokeWidth={1.75} className={style.text} />
        <span className={cn("text-[12px] font-semibold tracking-tight", style.text)}>
          {title}
        </span>
        <span className="flex-1" />
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
      <div className="text-[12.5px] leading-relaxed text-foreground/90">{children}</div>
      {actions ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}
