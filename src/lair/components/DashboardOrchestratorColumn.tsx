import { ChatShell } from "@/lair/chat/components/ChatShell";
import type { ChatEmptySuggestion } from "@/lair/chat/types";

const SUGGESTIONS: ChatEmptySuggestion[] = [
  { label: "Plan today", prompt: "Plan today based on calendar and open tasks." },
  { label: "What's overdue", prompt: "What's overdue across school, projects, and the vault?" },
  { label: "Brainstorm Combo Cars", prompt: "Brainstorm the next priority for Combo Cars." },
  { label: "Ingest raw/", prompt: "Ingest anything new in raw/ that isn't in the wiki yet." },
];

export function DashboardOrchestratorColumn() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatShell
        chatId="dashboard-orchestrator"
        title="Orchestrator"
        type="dashboard"
        scope={{ kind: "dashboard" }}
        emptyText="Ask about the vault, today's plan, project memory, or what to work on next."
        suggestions={SUGGESTIONS}
      />
    </div>
  );
}
