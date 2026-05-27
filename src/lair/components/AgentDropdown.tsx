import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <Select value={choice} onValueChange={(v) => setChoice(v as AgentChoice)}>
      <SelectTrigger
        size="sm"
        className="h-5 w-auto gap-1 rounded-md border-0 bg-background/70 px-1.5 py-0 text-[10.5px] font-medium text-foreground/90 shadow-none hover:bg-muted focus:bg-muted [&>svg]:size-3"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="min-w-28 rounded-md">
        {CHOICES.map((item) => (
          <SelectItem key={item.value} value={item.value} className="rounded-sm py-1 pr-6 pl-2 text-[11px]">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
