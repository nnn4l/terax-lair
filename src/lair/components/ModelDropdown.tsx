import { useEffect, useMemo } from "react";
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

const EFFORTS = [
  { value: "low", label: "low" },
  { value: "medium", label: "med" },
  { value: "high", label: "high" },
];

const REFETCH_TTL_MS = 24 * 60 * 60 * 1000;

export function ModelDropdown({ agent }: { agent: Agent }) {
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

  return (
    <div className="flex items-center gap-1">
      {!isCodex ? (
        <select
          value={model ?? ""}
          onChange={(e) => {
            const next = e.target.value || null;
            setModel(next);
            if (!next) setEffort(null);
          }}
          className="h-5 min-w-0 max-w-[8rem] rounded-md border-0 bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground outline-none hover:bg-muted focus:bg-muted"
          title={`${agent} model`}
        >
          <option value="">model</option>
          {models.map((m) => (
            <option key={m.id} value={m.id} title={m.name}>
              {shortLabel(m.id)}
            </option>
          ))}
        </select>
      ) : null}
      {model || isCodex ? (
        <select
          value={effort ?? ""}
          onChange={(e) => setEffort(e.target.value || null)}
          className="h-5 rounded-md border-0 bg-muted/60 px-1.5 text-[10px] font-medium text-muted-foreground outline-none hover:bg-muted focus:bg-muted"
          title={`${agent} effort`}
        >
          <option value="">effort</option>
          {EFFORTS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function shortLabel(id: string): string {
  // claude-opus-4-5 -> opus-4.5; o4-mini -> o4-mini; gpt-5 -> gpt-5
  return id
    .replace(/^claude-/, "")
    .replace(/(\d)-(\d)/g, "$1.$2");
}
