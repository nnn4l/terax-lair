import {
  ArrowDown01Icon,
  ClaudeIcon,
  CodeIcon,
  SparklesIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ModelDropdown } from "@/lair/components/ModelDropdown";
import { useLair } from "@/lair/state";
import type { Agent, AgentChoice } from "@/lair/types";

const CHOICES: {
  value: AgentChoice;
  label: string;
  description: string;
  icon: typeof CodeIcon;
}[] = [
  {
    value: "codex",
    label: "Codex",
    description: "Implementation-first CLI runs",
    icon: CodeIcon,
  },
  {
    value: "claude",
    label: "Claude",
    description: "Planning and broad repo reasoning",
    icon: ClaudeIcon,
  },
  {
    value: "compare",
    label: "Compare",
    description: "Ask both agents for one turn",
    icon: SparklesIcon,
  },
  {
    value: "auto",
    label: "Auto",
    description: "Let Lair route the turn",
    icon: SparklesIcon,
  },
];

export function AgentDropdown() {
  const choice = useLair((state) => state.agentChoice);
  const setChoice = useLair((state) => state.setAgentChoice);
  const active = CHOICES.find((item) => item.value === choice) ?? CHOICES[0];
  const ActiveIcon = active.icon;
  const showsClaude =
    choice === "claude" || choice === "auto" || choice === "compare";
  const showsCodex =
    choice === "codex" || choice === "auto" || choice === "compare";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          className="flex h-6 items-center gap-1 rounded-md border border-border/60 bg-card px-1.5 text-[10.5px] text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
          title={`CLI agent: ${active.label}`}
        >
          <HugeiconsIcon icon={ActiveIcon} size={11} strokeWidth={1.75} />
          <span className="max-w-[5.5rem] truncate">{active.label}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={10}
            strokeWidth={2}
            className="opacity-70"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56 rounded-xl">
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          CLI agent
        </div>
        {CHOICES.map((item) => (
          <AgentMenuItem
            key={item.value}
            item={item}
            active={item.value === choice}
            onSelect={() => setChoice(item.value)}
          />
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 pt-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Run settings
        </div>
        {showsClaude ? <ModelSettingsRow agent="claude" /> : null}
        {showsCodex ? <ModelSettingsRow agent="codex" /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModelSettingsRow({ agent }: { agent: Agent }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <span className="w-12 shrink-0 text-[10.5px] font-medium capitalize text-muted-foreground">
        {agent}
      </span>
      <div className="min-w-0 flex-1">
        <ModelDropdown agent={agent} />
      </div>
    </div>
  );
}

function AgentMenuItem({
  item,
  active,
  onSelect,
}: {
  item: (typeof CHOICES)[number];
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn(
        "flex items-start gap-2 pr-2 text-[12px]",
        active && "bg-accent/40",
      )}
    >
      <HugeiconsIcon
        icon={Icon}
        size={13}
        strokeWidth={1.75}
        className={cn("mt-0.5", active ? "text-foreground" : "text-muted-foreground")}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span>{item.label}</span>
        <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
          {item.description}
        </span>
      </span>
      {active ? (
        <HugeiconsIcon
          icon={Tick02Icon}
          size={12}
          strokeWidth={2}
          className="mt-0.5 shrink-0 text-foreground"
        />
      ) : null}
    </DropdownMenuItem>
  );
}
