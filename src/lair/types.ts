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

export interface CardData {
  id: string;
  agent: Agent;
  status: CardStatus;
  raw_output: string;
  summary: string | null;
  outcome: string | null;
  error: string | null;
}

export interface SendMessageRequest {
  prompt: string;
  agent_choice: AgentChoice;
  phase: Phase;
  workspace: string;
}

export interface StreamChunkEvent {
  card_id: string;
  chunk: string;
}

export interface CardUpdateEvent {
  card: CardData;
}

export interface Worktree {
  path: string;
  branch: string | null;
}
