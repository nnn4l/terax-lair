import { describe, expect, test } from "vitest";
import { resolveLairWorkspace } from "@/lair/workspace";

describe("resolveLairWorkspace", () => {
  test("keeps selected workspace when already set", () => {
    expect(resolveLairWorkspace("C:/repo", "C:/other")).toBe("C:/repo");
  });

  test("uses current workspace candidate when none is selected", () => {
    expect(resolveLairWorkspace("", "C:/repo")).toBe("C:/repo");
  });

  test("keeps empty workspace when no candidate exists", () => {
    expect(resolveLairWorkspace("", null)).toBe("");
  });
});
