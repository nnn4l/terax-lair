import { beforeEach, describe, expect, test } from "vitest";
import { useLair } from "@/lair/state";
import type { CardData } from "@/lair/types";

const card: CardData = {
  id: "card-1",
  agent: "codex",
  status: "streaming",
  raw_output: "",
  summary: null,
  outcome: null,
  error: null,
  usage: null,
  model: null,
  effort: null,
};

describe("lair state", () => {
  beforeEach(() => {
    useLair.setState({
      cards: [],
      narrations: [],
      turns: [],
      sessions: [],
      activeSessionId: null,
      currentTurnId: null,
      workspace: "",
      phase: "implement",
      agentChoice: "codex",
    });
  });

  test("card updates attach to their turn immediately without duplicates", () => {
    const turnId = useLair.getState().startTurn("do work");

    useLair.getState().upsertCard(card, turnId);
    expect(useLair.getState().turns[0].cardIds).toEqual([card.id]);

    useLair.getState().attachCardIds(turnId, [card.id]);

    expect(useLair.getState().turns[0].cardIds).toEqual([card.id]);
    expect(useLair.getState().cards).toEqual([card]);
  });

  test("sessions isolate turns and restore per-chat controls", () => {
    const state = useLair.getState() as typeof useLair extends {
      getState: () => infer T;
    }
      ? T & {
          newSession: (title?: string) => string;
          switchSession: (id: string) => void;
        }
      : never;

    const first = state.newSession("Feature A");
    useLair.getState().setWorkspace("C:/repo/a");
    useLair.getState().setPhase("plan");
    useLair.getState().setAgentChoice("claude");
    useLair.getState().startTurn("first turn");

    const second = useLair.getState().newSession("Feature B");
    useLair.getState().setWorkspace("C:/repo/b");
    useLair.getState().setPhase("test");
    useLair.getState().setAgentChoice("codex");
    useLair.getState().startTurn("second turn");

    useLair.getState().switchSession(first);
    expect(useLair.getState().workspace).toBe("C:/repo/a");
    expect(useLair.getState().phase).toBe("plan");
    expect(useLair.getState().agentChoice).toBe("claude");
    expect(useLair.getState().turns.map((t) => t.prompt)).toEqual([
      "first turn",
    ]);

    useLair.getState().switchSession(second);
    expect(useLair.getState().workspace).toBe("C:/repo/b");
    expect(useLair.getState().phase).toBe("test");
    expect(useLair.getState().agentChoice).toBe("codex");
    expect(useLair.getState().turns.map((t) => t.prompt)).toEqual([
      "second turn",
    ]);
  });
});
