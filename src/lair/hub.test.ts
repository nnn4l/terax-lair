import { beforeEach, describe, expect, it } from "vitest";
import { useHub } from "@/lair/hub";

describe("useHub", () => {
  beforeEach(() => {
    useHub.setState({
      tabs: [
        {
          id: "dashboard",
          kind: "dashboard",
          label: "Dashboard",
          repo_path: null,
        },
      ],
      activeTabId: "dashboard",
    });
  });

  it("starts with Dashboard active", () => {
    const { tabs, activeTabId } = useHub.getState();
    expect(tabs).toHaveLength(1);
    expect(activeTabId).toBe("dashboard");
  });

  it("setHubState mirrors backend snapshot", () => {
    useHub.getState().setHubState({
      tabs: [
        {
          id: "dashboard",
          kind: "dashboard",
          label: "Dashboard",
          repo_path: null,
        },
        { id: "repo:/x", kind: "repo", label: "x", repo_path: "/x" },
      ],
      active_tab_id: "repo:/x",
    });
    expect(useHub.getState().tabs).toHaveLength(2);
    expect(useHub.getState().activeTabId).toBe("repo:/x");
  });

  it("activeTab returns matched tab", () => {
    useHub.getState().setHubState({
      tabs: [
        {
          id: "dashboard",
          kind: "dashboard",
          label: "Dashboard",
          repo_path: null,
        },
        { id: "repo:/x", kind: "repo", label: "x", repo_path: "/x" },
      ],
      active_tab_id: "repo:/x",
    });
    const active = useHub.getState().activeTab();
    expect(active?.kind).toBe("repo");
    expect(active?.repo_path).toBe("/x");
  });
});
