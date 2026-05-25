import { useLair } from "@/lair/state";
import type { AgentChoice } from "@/lair/types";

const CHOICES: { value: AgentChoice; label: string }[] = [
  { value: "codex", label: "Codex" },
  { value: "claude", label: "Claude" },
  { value: "compare", label: "Compare" },
  { value: "auto", label: "Auto" },
];

export function AgentDropdown() {
  const choice = useLair((state) => state.agentChoice);
  const setChoice = useLair((state) => state.setAgentChoice);

  return (
    <select
      value={choice}
      onChange={(event) => setChoice(event.target.value as AgentChoice)}
      className="h-8 rounded-md border border-border bg-background px-2 text-[12px]"
    >
      {CHOICES.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}
