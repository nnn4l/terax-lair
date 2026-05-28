import { describe, expect, test } from "vitest";
import { resolvePlanImportPath } from "@/lair/components/planImportPath";

describe("resolvePlanImportPath", () => {
  test("keeps absolute Windows and Unix paths", () => {
    expect(resolvePlanImportPath("C:\\Dev\\repo\\docs\\plan.md", "C:/Dev/repo")).toBe(
      "C:/Dev/repo/docs/plan.md",
    );
    expect(resolvePlanImportPath("/home/n/repo/docs/plan.md", "/home/n/repo")).toBe(
      "/home/n/repo/docs/plan.md",
    );
  });

  test("resolves workspace-relative plan paths", () => {
    expect(
      resolvePlanImportPath("docs/superpowers/plans/queue.md", "C:\\Dev\\repo"),
    ).toBe("C:/Dev/repo/docs/superpowers/plans/queue.md");
  });
});
