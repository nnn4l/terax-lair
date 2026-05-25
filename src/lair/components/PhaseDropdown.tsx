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
      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
    >
      {PHASES.map((item) => (
        <option key={item} value={item}>
          Phase: {item}
        </option>
      ))}
    </select>
  );
}
