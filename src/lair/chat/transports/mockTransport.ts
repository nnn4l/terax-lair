import type { ChatTransport } from "@/lair/chat/types";

export const mockChatTransport: ChatTransport = {
  id: "mock",
  label: "Mock",
  async run(input, events, signal) {
    events.setAgentState({ kind: "orchestrating" });
    events.updateRunCard(input.runCard.id, {
      type: "dispatch",
      title: "Orchestrating",
      detail: "Checking request and selecting an agent.",
    });

    await Promise.resolve();
    if (signal.aborted) return;

    events.setAgentState({ kind: "locked", agent: "codex" });
    events.updateRunCard(input.runCard.id, {
      status: "running",
      title: "Codex selected",
      detail: "Mock transport is standing in for real dispatch.",
    });

    await Promise.resolve();
    if (signal.aborted) return;

    events.appendAssistant(
      `Mock response for: ${input.userMessage.content}\n\nThis shell is wired through the reusable chat transport boundary.`,
    );
    events.updateRunCard(input.runCard.id, {
      status: "complete",
      title: "Run complete",
      detail: "Transport finished.",
    });
  },
};
