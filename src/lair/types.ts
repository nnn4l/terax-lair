export type Agent = "claude" | "codex";
export type AgentChoice = "claude" | "codex" | "compare" | "auto";
export type Phase = "plan" | "implement" | "refactor" | "test" | "review";
export type CardStatus = "streaming" | "summarizing" | "done" | "failed";
export type ChecklistSection = "queue" | "done";

export interface Usage {
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

export interface CardData {
  id: string;
  agent: Agent;
  status: CardStatus;
  raw_output: string;
  summary: string | null;
  outcome: string | null;
  error: string | null;
  usage: Usage | null;
  model: string | null;
  effort: string | null;
}

export interface SendMessageRequest {
  turn_id: string;
  prompt: string;
  agent_choice: AgentChoice;
  phase: Phase;
  workspace: string;
  task_context?: QueueContext;
  claude_model: string | null;
  codex_model: string | null;
  claude_effort: string | null;
  codex_effort: string | null;
}

export interface StreamChunkEvent {
  card_id: string;
  chunk: string;
}

export interface CardUpdateEvent {
  turn_id: string;
  card: CardData;
}

export interface NarrationLine {
  id: string;
  text: string;
  timestamp_ms: number;
}

export interface NarrationEvent {
  line: NarrationLine;
}

export interface ChecklistItem {
  text: string;
  checked: boolean;
  line: number;
}

export interface ChecklistData {
  queue: ChecklistItem[];
  done: ChecklistItem[];
}

export interface SpecRef {
  file: string;
  anchor: string;
  hash: string;
}

export interface QueueItem {
  id: string;
  label: string;
  context: string;
  source: SpecRef | null;
  agent_hint: Agent | null;
  children: QueueItem[];
  checked: boolean;
  stale: boolean;
}

export type CompletionOutcome = "done" | "needs_review" | "failed";
export type AutopilotMode = "off" | "subtask" | "task" | "full";

export type QueueEvent =
  | { type: "cursor_advanced"; from: string; to: string | null }
  | { type: "item_dispatched"; id: string; agent: Agent }
  | { type: "item_completed"; id: string; outcome: CompletionOutcome }
  | { type: "paused" }
  | { type: "resumed" }
  | { type: "blocked_awaiting_approval"; id: string; reason: string };

export interface StaleReport {
  item_id: string;
  spec_section: string;
  diff_summary: string;
}

export interface QueueContext {
  item_id: string;
  label: string;
  context: string;
}

export interface Worktree {
  path: string;
  branch: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | string;
}

export interface Turn {
  id: string;
  prompt: string;
  startedAt: number;
  cardIds: string[];
  narrationIds: string[];
}

export interface LairSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  workspace: string;
  phase: Phase;
  agentChoice: AgentChoice;
  turnIds: string[];
  turns: Turn[];
  cards: CardData[];
  narrations: NarrationLine[];
  worktreePath?: string | null;
}
