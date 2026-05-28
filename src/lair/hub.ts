import { create } from "zustand";
import type { HubState, HubTab } from "@/lair/types";

interface HubStore {
  tabs: HubTab[];
  activeTabId: string | null;
  setHubState: (state: HubState) => void;
  activeTab: () => HubTab | undefined;
}

export const useHub = create<HubStore>((set, get) => ({
  tabs: [
    {
      id: "dashboard",
      kind: "dashboard",
      label: "Dashboard",
      repo_path: null,
    },
  ],
  activeTabId: "dashboard",
  setHubState: (state) =>
    set({ tabs: state.tabs, activeTabId: state.active_tab_id }),
  activeTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId);
  },
}));
