import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AgentDropdown } from "@/lair/components/AgentDropdown";
import { Card } from "@/lair/components/Card";
import { PhaseDropdown } from "@/lair/components/PhaseDropdown";
import type { CardData } from "@/lair/types";

describe("LairChat components", () => {
  test("agent picker defaults to text-only Codex-first choices", () => {
    const html = renderToStaticMarkup(<AgentDropdown />);
    expect(html.indexOf("Codex")).toBeLessThan(html.indexOf("Claude"));
    expect(html).toContain("Compare");
    expect(html).toContain("Auto");
  });

  test("phase picker renders every Lair phase", () => {
    const html = renderToStaticMarkup(<PhaseDropdown />);
    for (const phase of [
      "brainstorm",
      "plan",
      "implement",
      "refactor",
      "test",
      "review",
    ]) {
      expect(html).toContain(`>${phase}</option>`);
    }
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
    };

    const html = renderToStaticMarkup(<Card card={card} />);
    expect(html).toContain("summarizer failed");
    expect(html).toContain("raw details");
    expect(html).toContain("Codex");
  });
});
