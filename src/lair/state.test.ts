import { beforeEach, describe, expect, test } from "vitest";
import { useLair } from "@/lair/state";
import type { CardData, Lane } from "@/lair/types";

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

const lane = (id: string, enabled: boolean): Lane => ({
  id,
  label: id,
  cli: id === "codex" ? "codex" : "claude",
  env: {},
  default_model: null,
  default_effort: null,
  role: "implementor",
  cost_tier: "standard",
  clear_required: false,
  backend: null,
  auto_bias: [],
  enabled,
  context_window: null,
});

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
      lanes: [],
      activeLaneId: "claude",
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
    useLair.getState().setPhase("implement");
    useLair.getState().setAgentChoice("claude");
    useLair.getState().startTurn("first turn");

    const second = useLair.getState().newSession("Feature B");
    useLair.getState().setWorkspace("C:/repo/b");
    useLair.getState().setPhase("test");
    useLair.getState().setAgentChoice("codex");
    useLair.getState().startTurn("second turn");

    useLair.getState().switchSession(first);
    expect(useLair.getState().workspace).toBe("C:/repo/a");
    expect(useLair.getState().phase).toBe("implement");
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

  test("lane reload keeps active lane selectable", () => {
    useLair.getState().setActiveLaneId("pi-implementor");

    useLair.getState().setLanes([
      lane("claude", true),
      lane("pi-implementor", false),
      lane("pi-fast", true),
    ]);

    expect(useLair.getState().activeLaneId).toBe("claude");
  });
});
