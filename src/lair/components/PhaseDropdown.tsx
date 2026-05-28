import {
  ArrowDown01Icon,
  CodeIcon,
  Refresh01Icon,
  Search01Icon,
  TestTube01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLair } from "@/lair/state";
import type { Phase } from "@/lair/types";

const PHASES: Phase[] = ["implement", "refactor", "test", "critique", "review"];
const PHASE_LABEL: Record<Phase, string> = {
  implement: "Implement",
  refactor: "Refactor",
  test: "Test",
  critique: "Critique",
  review: "Review",
};
const PHASE_DESCRIPTION: Record<Phase, string> = {
  implement: "Build the requested change",
  refactor: "Improve structure without changing behavior",
  test: "Add or run verification",
  critique: "Find issues and tradeoffs",
  review: "Check correctness before handoff",
};
const PHASE_ICON: Record<Phase, typeof CodeIcon> = {
  implement: CodeIcon,
  refactor: Refresh01Icon,
  test: TestTube01Icon,
  critique: Search01Icon,
  review: Tick02Icon,
};

export function PhaseDropdown() {
  const phase = useLair((state) => state.phase);
  const setPhase = useLair((state) => state.setPhase);
  const ActiveIcon = PHASE_ICON[phase];

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          className="flex h-6 items-center gap-1 rounded-full border border-border/60 bg-card px-1.5 text-[10.5px] text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
          title={`Mode: ${PHASE_LABEL[phase]}`}
        >
          <HugeiconsIcon icon={ActiveIcon} size={11} strokeWidth={1.75} />
          <span>{PHASE_LABEL[phase]}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={10} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56 rounded-xl">
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Work mode
        </div>
        {PHASES.map((p) => {
          const Icon = PHASE_ICON[p];
          return (
            <DropdownMenuItem
              key={p}
              onSelect={() => setPhase(p)}
              className={cn(
                "flex items-start gap-2 pr-2 text-[12px]",
                phase === p && "bg-accent/40",
              )}
            >
              <HugeiconsIcon
                icon={Icon}
                size={13}
                strokeWidth={1.75}
                className="mt-0.5 text-muted-foreground"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-foreground/90">{PHASE_LABEL[p]}</span>
                <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
                  {PHASE_DESCRIPTION[p]}
                </span>
              </span>
              {phase === p ? (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  size={12}
                  strokeWidth={2}
                  className="mt-0.5 shrink-0 text-foreground"
                />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
