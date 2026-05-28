import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLair } from "@/lair/state";
import type { Lane, LaneRole } from "@/lair/types";

const ROLE_ORDER: LaneRole[] = ["implementor", "reviewer", "consultant"];
const ROLE_LABEL: Record<LaneRole, string> = {
  implementor: "Implementor",
  reviewer: "Reviewer",
  consultant: "Consultant",
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

  const enabledLanes = lanes.filter((l) => l.enabled);
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

  const grouped = ROLE_ORDER
    .map((role) => ({
      role,
      items: enabledLanes.filter((l) => l.role === role),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Select value={activeLaneId} onValueChange={setActiveLaneId}>
      <SelectTrigger className="h-7 w-auto gap-1.5 border border-border bg-card px-2 text-[11.5px]">
        <SelectValue placeholder="lane" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={autoLane.id} className="text-[12px]">
            <span className="font-medium">Auto</span>
            <span className="ml-2 text-[10px] text-muted-foreground">
              routes implementors
            </span>
          </SelectItem>
        </SelectGroup>
        {grouped.map((g) => (
          <SelectGroup key={g.role}>
            <SelectLabel className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {ROLE_LABEL[g.role]}
            </SelectLabel>
            {g.items.map((lane) => {
              const backendOk =
                !lane.backend || backendStatuses[lane.backend] === "running";
              return (
                <SelectItem
                  key={lane.id}
                  value={lane.id}
                  className="text-[12px]"
                  disabled={!backendOk}
                >
                  <span className="font-medium">{lane.label}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {COST_LABEL[lane.cost_tier] ?? lane.cost_tier}
                  </span>
                  {lane.default_model ? (
                    <span className="ml-1 text-[10px] text-muted-foreground/70">
                      · {lane.default_model.replace(/^claude-/, "")}
                    </span>
                  ) : null}
                  {!backendOk ? (
                    <span className="ml-2 text-[10px] text-amber-500">
                      backend down
                    </span>
                  ) : null}
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
