export type Agent = "claude" | "codex";
export type AgentChoice = "claude" | "codex" | "compare" | "auto";
export type Phase =
  | "brainstorm"
  | "plan"
  | "implement"
  | "refactor"
  | "test"
  | "review";
export type CardStatus = "streaming" | "summarizing" | "done" | "failed";
export type ChecklistSection = "now" | "next" | "later" | "done";

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
  now: ChecklistItem[];
  next: ChecklistItem[];
  later: ChecklistItem[];
  done: ChecklistItem[];
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
