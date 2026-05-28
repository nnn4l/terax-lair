import type { ReactNode } from "react";
import { OrchestratorChatCard } from "@/lair/components/OrchestratorChatCard";
import { TodaysPlanCard } from "@/lair/components/TodaysPlanCard";
import { WorkspaceLauncher } from "@/lair/components/WorkspaceLauncher";

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card">
      {children}
    </div>
  );
}

export function DashboardView() {
  return (
    <div className="grid h-full grid-cols-[minmax(200px,240px)_minmax(420px,1fr)_minmax(240px,280px)] gap-3 overflow-hidden bg-background/40 p-3">
      <Card>
        <WorkspaceLauncher />
      </Card>
      <Card>
        <OrchestratorChatCard />
      </Card>
      <Card>
        <TodaysPlanCard />
      </Card>
    </div>
  );
}
