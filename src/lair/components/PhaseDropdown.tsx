import { useLair } from "@/lair/state";
import type { Phase } from "@/lair/types";

const PHASES: Phase[] = [
  "brainstorm",
  "plan",
  "implement",
  "refactor",
  "test",
  "review",
];

export function PhaseDropdown() {
  const phase = useLair((state) => state.phase);
  const setPhase = useLair((state) => state.setPhase);

  return (
    <select
      value={phase}
      onChange={(event) => setPhase(event.target.value as Phase)}
      className="h-6 rounded-md border-0 bg-muted/60 px-1.5 text-[11px] font-medium text-foreground/90 outline-none hover:bg-muted focus:bg-muted"
      title="phase"
    >
      {PHASES.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
