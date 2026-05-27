import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLair } from "@/lair/state";
import type { Phase } from "@/lair/types";

const PHASES: Phase[] = ["plan", "implement", "refactor", "test", "review"];

export function PhaseDropdown() {
  const phase = useLair((state) => state.phase);
  const setPhase = useLair((state) => state.setPhase);

  return (
    <Select value={phase} onValueChange={(value) => setPhase(value as Phase)}>
      <SelectTrigger
        size="sm"
        className="h-5 w-auto gap-1 rounded-md border-0 bg-background/70 px-1.5 py-0 text-[10.5px] font-medium text-foreground/90 shadow-none hover:bg-muted focus:bg-muted [&>svg]:size-3"
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
