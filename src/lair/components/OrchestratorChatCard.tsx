import { useState } from "react";
import { ChatShell } from "@/lair/chat/components/ChatShell";
import type { ChatEmptySuggestion } from "@/lair/chat/types";
import { openRepoTab } from "@/lair/api";
import { useHub } from "@/lair/hub";

const SUGGESTIONS: ChatEmptySuggestion[] = [
  {
    label: "Plan today",
    prompt: "Plan today based on calendar and open tasks.",
  },
  {
    label: "What's overdue",
    prompt: "What's overdue across school, projects, and the vault?",
  },
  {
    label: "Brainstorm Combo Cars",
    prompt: "Brainstorm the next priority for Combo Cars.",
  },
  {
    label: "Ingest new files",
    prompt: "Ingest anything new in raw/ that isn't in the wiki yet.",
  },
];

export function OrchestratorChatCard() {
  const setHubState = useHub((s) => s.setHubState);
  const [busy, setBusy] = useState(false);

  function copyToClipboard(text: string) {
    void navigator.clipboard?.writeText(text);
  }

  async function openWorkspaceFromText(text: string) {
    const match = text.match(/[A-Za-z]:[\\/][^\s"]+|\/[^\s"]+/);
    if (!match) return;
    setBusy(true);
    try {
      const next = await openRepoTab(match[0]);
      setHubState(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ChatShell
      chatId="dashboard-orchestrator"
      title="Orchestrator"
      type="dashboard"
      scope={{ kind: "dashboard" }}
      emptyText="Ask about the vault, today's plan, project memory, or what to work on next."
      suggestions={SUGGESTIONS}
      renderActions={(text: string) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <ActionChip label="copy" onClick={() => copyToClipboard(text)} />
          <ActionChip
            label="open workspace from text"
            disabled={busy}
            onClick={() => void openWorkspaceFromText(text)}
          />
        </div>
      )}
    />
  );
}

function ActionChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-border/60 bg-card/70 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {label}
    </button>
  );
}
