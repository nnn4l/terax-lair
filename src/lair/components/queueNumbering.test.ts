import { describe, expect, test } from "vitest";
import { numberQueueItems } from "@/lair/components/queueNumbering";
import type { QueueItem } from "@/lair/types";

function item(id: string, children: QueueItem[] = []): QueueItem {
  return {
    id,
    label: id,
    context: "",
    checked: false,
    children,
    source: null,
    agent_hint: null,
    stale: false,
  };
}

describe("numberQueueItems", () => {
  test("numbers top-level groups and nested tasks like an implementation plan", () => {
    const rows = numberQueueItems([
      item("setup", [item("install"), item("configure")]),
      item("verify", [item("types"), item("tests", [item("unit")])]),
    ]);

    expect(rows.map((row) => [row.id, row.number, row.depth])).toEqual([
      ["setup", "1", 0],
      ["install", "1.1", 1],
      ["configure", "1.2", 1],
      ["verify", "2", 0],
      ["types", "2.1", 1],
      ["tests", "2.2", 1],
      ["unit", "2.2.1", 2],
    ]);
  });
});
