import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Card } from "@/lair/components/Card";
import { LanePicker } from "@/lair/components/LanePicker";
import { LairChat, TurnView } from "@/lair/components/LairChat";
import { PhaseDropdown } from "@/lair/components/PhaseDropdown";
import { useLair } from "@/lair/state";
import type { CardData } from "@/lair/types";

describe("LairChat components", () => {
  test("lane picker renders a Select trigger", () => {
    const html = renderToStaticMarkup(<LanePicker />);
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
  });

  test("phase picker renders every Lair phase", () => {
    const html = renderToStaticMarkup(<PhaseDropdown />);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('data-slot="select-trigger"');
    expect(html).not.toContain("<option");
  });

  test("lair chat wraps in graphite console surface", () => {
    const html = renderToStaticMarkup(<LairChat />);
    expect(html).toContain("data-lair-surface=\"graphite-console\"");
  });

  test("lair chat renders a chat thread with composer affordances", () => {
    const chatHtml = renderToStaticMarkup(<LairChat />);
    const card: CardData = {
      id: "card-1",
      agent: "codex",
      status: "done",
      raw_output: "raw output",
      summary: "Implemented **markdown** summary.",
      outcome: "complete",
      error: null,
      usage: null,
      model: null,
      effort: null,
    };
    const turnHtml = renderToStaticMarkup(
      <TurnView
        turn={{
          id: "turn-1",
          prompt: "Make the summary **clear**",
          startedAt: 1,
          cardIds: ["card-1"],
          narrationIds: [],
        }}
        cardById={new Map([["card-1", card]])}
        narrationById={new Map()}
        onRetry={() => undefined}
        onEdit={() => undefined}
      />,
    );

    expect(chatHtml).toContain('data-lair-thread="true"');
    expect(chatHtml).toContain('data-lair-surface="graphite-console"');
    expect(chatHtml).toContain('data-lair-composer="command-surface"');
    expect(chatHtml).toContain('aria-label="Message Lair"');
    expect(chatHtml).toContain('aria-label="Send message"');
    expect(turnHtml).toContain('data-lair-role="user"');
    expect(turnHtml).toContain('data-lair-role="assistant"');
    expect(turnHtml).toContain('data-lair-turn="timeline"');
    expect(turnHtml).toContain('data-lair-phase="prompt"');
    expect(turnHtml).toContain('data-lair-phase="agent-work"');
    expect(turnHtml).toContain('data-lair-card-section="result"');
    expect(turnHtml).toContain("Make the summary");
    expect(turnHtml).toContain("Implemented");
    expect(turnHtml).toContain('aria-label="Copy assistant response"');
    expect(turnHtml).toContain('aria-label="Retry prompt"');
    expect(turnHtml).toContain('aria-label="Edit prompt"');
  });

  test("lair chat shows contextual thinking state for a pending turn", () => {
    const html = renderToStaticMarkup(
      <TurnView
        turn={{
          id: "turn-1",
          prompt: "Investigate",
          startedAt: 1,
          cardIds: [],
          narrationIds: [],
        }}
        cardById={new Map()}
        narrationById={new Map()}
        onRetry={() => undefined}
        onEdit={() => undefined}
      />,
    );

    expect(html).toContain("Thinking");
    expect(html).not.toContain("waiting...");
  });

  test("lane picker shows with lane data loaded", () => {
    useLair.setState({
      lanes: [
        {
          id: "claude",
          label: "Claude",
          cli: "claude",
          env: {},
          default_model: "claude-opus-4-5",
          default_effort: "medium",
          role: "implementor",
          cost_tier: "expensive",
          clear_required: false,
          backend: null,
          auto_bias: [],
          enabled: true,
          context_window: 200000,
        },
      ],
      activeLaneId: "claude",
    });
    const html = renderToStaticMarkup(<LanePicker />);
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
  });

  test("card renders raw output when summary is unavailable", () => {
    const card: CardData = {
      id: "1",
      agent: "codex",
      status: "done",
      raw_output: "raw details",
      summary: null,
      outcome: null,
      error: "summarizer failed",
      usage: null,
      model: null,
      effort: null,
    };

    const html = renderToStaticMarkup(<Card card={card} />);
    expect(html).toContain('data-lair-agent-card="true"');
    expect(html).toContain('data-lair-agent="codex"');
    expect(html).toContain('data-lair-card-section="issue"');
    expect(html).toContain("summarizer failed");
    expect(html).toContain("raw details");
    expect(html).toContain("Codex");
  });
});
