import { useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listModels } from "@/lair/api";
import { useLair } from "@/lair/state";
import type { Agent, ModelInfo } from "@/lair/types";

const FALLBACK: Record<"anthropic" | "openai", ModelInfo[]> = {
  anthropic: [
    { id: "claude-opus-4-7", name: "Claude Opus 4.7", provider: "anthropic" },
    { id: "claude-opus-4-5", name: "Claude Opus 4.5", provider: "anthropic" },
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "anthropic" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic" },
  ],
  openai: [
    { id: "gpt-5", name: "OpenAI GPT-5", provider: "openai" },
    { id: "gpt-5-mini", name: "OpenAI GPT-5 mini", provider: "openai" },
    { id: "o3", name: "OpenAI o3", provider: "openai" },
    { id: "o4-mini", name: "OpenAI o4-mini", provider: "openai" },
  ],
};

// Only show IDs that match these patterns; OpenRouter returns many models
// (dated variants, image/audio, deprecated checkpoints) that the local CLIs reject.
const ID_FILTER: Record<"anthropic" | "openai", RegExp> = {
  anthropic: /^claude-(opus|sonnet|haiku)-\d+-\d+$/,
  openai: /^(gpt-\d+(-mini|-turbo|-nano)?|o\d+(-mini|-pro)?)$/,
};

// Models that do NOT support an effort dial.
const EFFORT_UNSUPPORTED = new Set<string>(["claude-haiku-4-5"]);

const EFFORTS = [
  { value: "low", label: "low" },
  { value: "medium", label: "med" },
  { value: "high", label: "high" },
];

const REFETCH_TTL_MS = 24 * 60 * 60 * 1000;

export function ModelDropdown({
  agent,
  variant = "standalone",
}: {
  agent: Agent;
  variant?: "standalone" | "menu";
}) {
  const claudeModel = useLair((s) => s.claudeModel);
  const codexModel = useLair((s) => s.codexModel);
  const claudeEffort = useLair((s) => s.claudeEffort);
  const codexEffort = useLair((s) => s.codexEffort);
  const setClaudeModel = useLair((s) => s.setClaudeModel);
  const setCodexModel = useLair((s) => s.setCodexModel);
  const setClaudeEffort = useLair((s) => s.setClaudeEffort);
  const setCodexEffort = useLair((s) => s.setCodexEffort);
  const cachedModels = useLair((s) => s.models);
  const modelsFetchedAt = useLair((s) => s.modelsFetchedAt);
  const setModels = useLair((s) => s.setModels);
  const isCodex = agent === "codex";

  useEffect(() => {
    const stale = Date.now() - modelsFetchedAt > REFETCH_TTL_MS;
    if (cachedModels.length === 0 || stale) {
      void listModels()
        .then(setModels)
        .catch(() => {
          // silent fallback to FALLBACK constants
        });
    }
  }, [cachedModels.length, modelsFetchedAt, setModels]);

  const provider: "anthropic" | "openai" = isCodex ? "openai" : "anthropic";

  const models = useMemo(() => {
    const re = ID_FILTER[provider];
    const filtered = cachedModels.filter(
      (m) => m.provider === provider && re.test(m.id),
    );
    return filtered.length > 0 ? filtered : FALLBACK[provider];
  }, [cachedModels, provider]);

  const model = agent === "claude" ? claudeModel : codexModel;
  const effort = agent === "claude" ? claudeEffort : codexEffort;
  const setModel = agent === "claude" ? setClaudeModel : setCodexModel;
  const setEffort = agent === "claude" ? setClaudeEffort : setCodexEffort;

  useEffect(() => {
    if (isCodex && model) {
      setCodexModel(null);
    }
  }, [isCodex, model, setCodexModel]);

  const effortDisabled = !isCodex && (!model || EFFORT_UNSUPPORTED.has(model));
  const outerClass =
    variant === "menu"
      ? "flex h-6 items-center justify-end gap-1"
      : "flex h-6 items-center gap-1 rounded-md border border-border/50 bg-background/65 px-1";
  const modelTriggerClass =
    variant === "menu"
      ? "h-5 max-w-[8.75rem] min-w-[5.75rem] justify-end gap-1 rounded-md border-0 bg-transparent px-1 py-0 text-[10.5px] font-medium text-foreground/85 shadow-none hover:bg-accent/60 [&>svg]:size-3"
      : "h-5 max-w-[10rem] min-w-[6.75rem] gap-1 rounded-sm border-0 bg-transparent px-1 py-0 text-[10.5px] font-medium text-foreground/85 shadow-none hover:bg-muted/70 [&>svg]:size-3";
  const effortTriggerClass =
    variant === "menu"
      ? "h-5 min-w-[3.75rem] justify-end gap-1 rounded-md border-0 bg-transparent px-1 py-0 text-[10.5px] font-medium text-foreground/85 shadow-none hover:bg-accent/60 disabled:opacity-40 [&>svg]:size-3"
      : "h-5 min-w-[4.25rem] gap-1 rounded-sm border-0 bg-transparent px-1 py-0 text-[10.5px] font-medium text-foreground/85 shadow-none hover:bg-muted/70 disabled:opacity-40 [&>svg]:size-3";

  return (
    <div className={outerClass}>
      {!isCodex ? (
        <Select
          value={model ?? "__none__"}
          onValueChange={(v) => {
            const next = v === "__none__" ? null : v;
            setModel(next);
            if (!next) setEffort(null);
          }}
        >
          <SelectTrigger
            size="sm"
            className={modelTriggerClass}
            title={`${agent} model`}
          >
            <SelectValue placeholder="model" />
          </SelectTrigger>
          <SelectContent className="min-w-52 rounded-md">
            <SelectItem value="__none__" className="rounded-sm py-1.5 pr-6 pl-2 text-[11px]">
              <span className="flex flex-col items-start gap-0">
                <span>CLI default</span>
                <span className="text-[10px] font-normal text-muted-foreground">Use configured agent default</span>
              </span>
            </SelectItem>
            {models.map((m) => (
              <SelectItem
                key={m.id}
                value={m.id}
                className="rounded-sm py-1.5 pr-6 pl-2 text-[11px]"
                title={m.name}
              >
                <span className="flex flex-col items-start gap-0">
                  <span>{shortLabel(m.id)}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">{m.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select
        value={effort ?? "__none__"}
        onValueChange={(v) => setEffort(v === "__none__" ? null : v)}
        disabled={effortDisabled}
      >
        <SelectTrigger
          size="sm"
          className={effortTriggerClass}
          title={
            effortDisabled
              ? !model
                ? "pick a model first"
                : "selected model has no effort dial"
              : `${agent} effort`
          }
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
    </div>
  );
}

function shortLabel(id: string): string {
  // claude-opus-4-5 -> opus-4.5; o4-mini -> o4-mini; gpt-5 -> gpt-5
  return id.replace(/^claude-/, "").replace(/(\d)-(\d)/g, "$1.$2");
}
