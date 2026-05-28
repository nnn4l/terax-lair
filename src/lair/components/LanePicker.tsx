import {
  ArrowDown01Icon,
  ClaudeIcon,
  CodeIcon,
  Route01Icon,
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
import { useLair } from "@/lair/state";
import type { Lane, LaneRole } from "@/lair/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@/lair/types";

const ROLE_ORDER: LaneRole[] = ["implementor", "reviewer", "consultant"];
const ROLE_LABEL: Record<LaneRole, string> = {
  implementor: "Implementor",
  reviewer: "Reviewer",
  consultant: "Consultant",
};
const ROLE_ICON: Record<LaneRole, typeof CodeIcon> = {
  implementor: CodeIcon,
  reviewer: SparklesIcon,
  consultant: ClaudeIcon,
};

const COST_LABEL: Record<string, string> = {
  free: "free",
  cheap: "cheap",
  standard: "standard",
  expensive: "$$$",
};

export function LanePicker() {
  const lanes = useLair((s) => s.lanes);
  const activeLaneId = useLair((s) => s.activeLaneId);
  const setActiveLaneId = useLair((s) => s.setActiveLaneId);
  const backendStatuses = useLair((s) => s.backendStatuses);
  const claudeModel = useLair((s) => s.claudeModel);
  const codexModel = useLair((s) => s.codexModel);
  const claudeEffort = useLair((s) => s.claudeEffort);
  const codexEffort = useLair((s) => s.codexEffort);

  const allLanes = lanes; // show all lanes including disabled
  const autoLane: Lane = {
    id: "auto",
    label: "Auto",
    cli: "",
    env: {},
    default_model: null,
    default_effort: null,
    role: "implementor",
    cost_tier: "cheap",
    clear_required: false,
    backend: null,
    auto_bias: [],
    enabled: true,
    context_window: null,
  };

  const active =
    allLanes.find((l) => l.id === activeLaneId && l.enabled) ??
    allLanes.find((l) => l.id === activeLaneId) ??
    (activeLaneId === "auto" ? autoLane : null) ??
    allLanes.find((l) => l.enabled) ??
    allLanes[0];
  const isAuto = active?.id === "auto";
  const ActiveIcon = isAuto ? Route01Icon : active ? ROLE_ICON[active.role] : CodeIcon;

  // Resolve display model/effort. Skip model for backend lanes (DeepSeek) —
  // they use Claude CLI internally with lane config, not the user's claude model override.
  const isBackendLane = active?.backend != null;
  const userModel = active?.cli === "codex" ? codexModel : claudeModel;
  const userEffort = active?.cli === "codex" ? codexEffort : claudeEffort;
  const displayModel = (isAuto || isBackendLane) ? null : userModel ?? active?.default_model ?? null;
  const displayEffort = isAuto ? null : userEffort ?? active?.default_effort ?? null;
  const effortAbbr: Record<string, string> = { low: "Low", medium: "Med", high: "Hi", xhigh: "X-Hi", max: "Max" };

  const grouped = ROLE_ORDER
    .map((role) => ({
      role,
      items: allLanes.filter((l) => l.role === role),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          className="flex h-6 items-center gap-1 rounded-full border border-border/60 bg-card px-1.5 text-[10.5px] text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
          title={`Lane: ${active?.label ?? "-"}`}
        >
          <HugeiconsIcon icon={ActiveIcon} size={11} strokeWidth={1.75} />
          <span className="max-w-[5.5rem] truncate">
            {isAuto ? "Auto route" : active?.label ?? "-"}
          </span>
          {displayModel ? (
            <span className="rounded-md border border-border/60 bg-muted/45 px-1 font-mono text-[9.5px] text-muted-foreground">
              {displayModel.replace(/^claude-/, "").replace(/(\d)-(\d)/g, "$1.$2")}
            </span>
          ) : null}
          {displayEffort ? (
            <span className="rounded-md border border-border/60 bg-muted/45 px-0.5 font-mono text-[9px] text-muted-foreground">
              {effortAbbr[displayEffort] ?? displayEffort?.[0]}
            </span>
          ) : null}
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={10}
            strokeWidth={2}
            className="opacity-70"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-64 rounded-xl">
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Routing
        </div>
        <LaneMenuItem
          lane={autoLane}
          active={activeLaneId === "auto"}
          onSelect={() => setActiveLaneId("auto")}
          description="Best implementor for the task"
        />
        <DropdownMenuSeparator />
        {grouped.map((g) => (
          <div key={g.role}>
            <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {ROLE_LABEL[g.role]}
            </div>
            {g.items.map((lane) => {
              const disabled = !lane.enabled;
              const backendDown =
                !disabled &&
                lane.backend != null &&
                backendStatuses[lane.backend] !== "running";
              const selectable = !disabled && !backendDown;
              return (
                <LaneMenuItem
                  key={lane.id}
                  lane={lane}
                  active={activeLaneId === lane.id}
                  onSelect={() => setActiveLaneId(lane.id)}
                  disabled={!selectable}
                  disabledHint={
                    disabled
                      ? "enable in settings"
                      : backendDown
                        ? "backend unavailable"
                        : undefined
                  }
                  description={
                    disabled
                      ? "disabled"
                      : backendDown
                        ? "backend unavailable"
                        : lane.backend
                          ? "CLI default"
                          : lane.default_model
                            ? lane.default_model.replace(/^claude-/, "").replace(/(\d)-(\d)/g, "$1.$2")
                            : COST_LABEL[lane.cost_tier] ?? lane.cost_tier
                  }
                />
              );
            })}
          </div>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 pt-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Run settings
        </div>
        <LaneModelRow agent="claude" />
        <LaneModelRow agent="codex" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LaneMenuItem({
  lane,
  active,
  onSelect,
  disabled,
  disabledHint,
  description,
}: {
  lane: Lane;
  active: boolean;
  onSelect: () => void;
  disabled?: boolean;
  disabledHint?: string;
  description?: string;
}) {
  const Icon = lane.id === "auto" ? Route01Icon : ROLE_ICON[lane.role] ?? CodeIcon;
  const greyedOut = disabled && !active;
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex items-start gap-2 pr-2 text-[12px]",
        active && "bg-accent/40",
        greyedOut && "opacity-50",
      )}
    >
      <HugeiconsIcon
        icon={Icon}
        size={13}
        strokeWidth={1.75}
        className={cn(
          "mt-0.5",
          active ? "text-foreground" : greyedOut ? "text-muted-foreground/50" : "text-muted-foreground",
          disabledHint && !active && "text-amber-500",
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn(greyedOut && "text-muted-foreground")}>
          {lane.label}
          {disabledHint ? (
            <span className="ml-2 text-[10px] text-muted-foreground">
              {disabledHint}
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
            {description}
          </span>
        ) : null}
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

function LaneModelRow({ agent }: { agent: Agent }) {
  const Icon = agent === "claude" ? ClaudeIcon : CodeIcon;
  const label = agent === "claude" ? "Claude" : "Codex";
  const description =
    agent === "claude"
      ? "Effort for Claude lanes"
      : "Effort for Codex lanes";
  return (
    <div className="mx-1 my-0.5 flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-accent/35">
      <HugeiconsIcon
        icon={Icon}
        size={13}
        strokeWidth={1.75}
        className="shrink-0 text-muted-foreground"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="capitalize text-foreground/90">{label}</span>
        <span className="line-clamp-1 text-[10.5px] text-muted-foreground">
          {description}
        </span>
      </span>
      <div className="min-w-0 shrink-0">
        <EffortOnlyDropdown agent={agent} />
      </div>
    </div>
  );
}

const EFFORTS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Med" },
  { value: "high", label: "Hi" },
  { value: "xhigh", label: "X-Hi" },
  { value: "max", label: "Max" },
];

function EffortOnlyDropdown({ agent }: { agent: Agent }) {
  const claudeEffort = useLair((s) => s.claudeEffort);
  const codexEffort = useLair((s) => s.codexEffort);
  const setClaudeEffort = useLair((s) => s.setClaudeEffort);
  const setCodexEffort = useLair((s) => s.setCodexEffort);
  const effort = agent === "claude" ? claudeEffort : codexEffort;
  const setEffort = agent === "claude" ? setClaudeEffort : setCodexEffort;

  return (
    <Select
      value={effort ?? "__none__"}
      onValueChange={(v) => setEffort(v === "__none__" ? null : v)}
    >
      <SelectTrigger
        size="sm"
        className="h-5 min-w-[3.75rem] justify-end gap-1 rounded-md border-0 bg-transparent px-1 py-0 text-[10.5px] font-medium text-foreground/85 shadow-none hover:bg-accent/60 disabled:opacity-40 [&>svg]:size-3"
      >
        <SelectValue placeholder="effort" />
      </SelectTrigger>
      <SelectContent className="min-w-24 rounded-md">
        <SelectItem value="__none__" className="rounded-sm py-1 pr-6 pl-2 text-[11px]">
          default
        </SelectItem>
        {EFFORTS.map((e) => (
          <SelectItem key={e.value} value={e.value} className="rounded-sm py-1 pr-6 pl-2 text-[11px]">
            {e.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
