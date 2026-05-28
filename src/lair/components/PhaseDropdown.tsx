import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLair } from "@/lair/state";
import type { Phase } from "@/lair/types";

const PHASES: Phase[] = ["implement", "refactor", "test", "critique", "review"];

export function PhaseDropdown() {
  const phase = useLair((state) => state.phase);
  const setPhase = useLair((state) => state.setPhase);

  return (
    <Select value={phase} onValueChange={(value) => setPhase(value as Phase)}>
      <SelectTrigger
        size="sm"
        className="h-6 w-auto gap-1 rounded-md border border-border/60 bg-card px-1.5 py-0 text-[10.5px] text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground [&>svg]:size-3"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-28 rounded-md">
        {PHASES.map((p) => (
          <SelectItem key={p} value={p} className="rounded-sm py-1 pr-6 pl-2 text-[11px]">
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
