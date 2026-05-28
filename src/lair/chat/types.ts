import type { ComponentType } from "react";

export type ChatType = "simple" | "brainstorm" | "implementation" | "dashboard";

export type ChatScope =
  | { kind: "dashboard" }
  | { kind: "workspace"; repoPath: string }
  | { kind: "spec"; specId: string; repoPath: string };

export type AgentId = "codex" | "claude";

export type AgentState =
  | { kind: "idle" }
  | { kind: "orchestrating" }
  | { kind: "locked"; agent: AgentId }
  | { kind: "handoff_pending"; from: AgentId; to: AgentId }
  | { kind: "error"; message: string };

export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatMessageStatus = "sending" | "streaming" | "complete" | "error" | "stopped";
export type RunCardStatus = "running" | "complete" | "error" | "stopped";
export type RunCardType = "thinking" | "dispatch" | "tool" | "error";

export interface ChatRunCard {
  id: string;
  messageId: string;
  type: RunCardType;
  status: RunCardStatus;
  title: string;
  detail?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  createdAt: number;
  status: ChatMessageStatus;
}

export interface LairChatSession {
  id: string;
  title: string;
  type: ChatType;
  scope: ChatScope;
  createdAt: number;
  updatedAt: number;
  agentState: AgentState;
  messages: ChatMessage[];
  runCards: ChatRunCard[];
}

export interface ChatTransportEvents {
  appendAssistant: (chunk: string) => void;
  updateRunCard: (cardId: string, patch: Partial<ChatRunCard>) => void;
  setAgentState: (state: AgentState) => void;
}

export interface ChatTransportInput {
  chat: LairChatSession;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  runCard: ChatRunCard;
}

export interface ChatTransport {
  id: string;
  label: string;
  run: (
    input: ChatTransportInput,
    events: ChatTransportEvents,
    signal: AbortSignal,
  ) => Promise<void>;
}

export interface ChatEmptySuggestion {
  label: string;
  prompt: string;
  Icon?: ComponentType<{ className?: string }>;
}
