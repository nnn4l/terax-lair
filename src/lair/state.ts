import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AgentChoice, CardData, Phase } from "@/lair/types";

interface LairState {
  cards: CardData[];
  phase: Phase;
  agentChoice: AgentChoice;
  workspace: string;
  upsertCard: (card: CardData) => void;
  appendChunk: (id: string, chunk: string) => void;
  clearCards: () => void;
  setPhase: (phase: Phase) => void;
  setAgentChoice: (agentChoice: AgentChoice) => void;
  setWorkspace: (workspace: string) => void;
}

export const useLair = create<LairState>()(
  persist(
    (set) => ({
      cards: [],
      phase: "implement",
      agentChoice: "codex",
      workspace: "",
      upsertCard: (card) =>
        set((state) => {
          const idx = state.cards.findIndex((c) => c.id === card.id);
          if (idx === -1) return { cards: [...state.cards, card] };
          const cards = [...state.cards];
          cards[idx] = card;
          return { cards };
        }),
      appendChunk: (id, chunk) =>
        set((state) => {
          const idx = state.cards.findIndex((c) => c.id === id);
          if (idx === -1) return state;
          const cards = [...state.cards];
          cards[idx] = {
            ...cards[idx],
            raw_output: cards[idx].raw_output + chunk,
          };
          return { cards };
        }),
      clearCards: () => set({ cards: [] }),
      setPhase: (phase) => set({ phase }),
      setAgentChoice: (agentChoice) => set({ agentChoice }),
      setWorkspace: (workspace) => set({ workspace }),
    }),
    {
      name: "lair-state",
      partialize: (state) => ({
        phase: state.phase,
        agentChoice: state.agentChoice,
        workspace: state.workspace,
      }),
    },
  ),
);
