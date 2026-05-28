import { useState } from "react";
import { AmbientStrip } from "@/lair/components/AmbientStrip";
import { DashboardOrchestratorColumn } from "@/lair/components/DashboardOrchestratorColumn";
import { OpenWorkspaceDialog } from "@/lair/components/OpenWorkspaceDialog";
import { TodayBriefingRow } from "@/lair/components/TodayBriefingRow";
import { WorkspacesColumn } from "@/lair/components/WorkspacesColumn";

export function DashboardView() {
  const [openDialog, setOpenDialog] = useState(false);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <TodayBriefingRow />
      <div className="grid flex-1 grid-cols-[minmax(220px,38%)_minmax(360px,1fr)] overflow-hidden">
        <WorkspacesColumn onOpenDialog={() => setOpenDialog(true)} />
        <DashboardOrchestratorColumn />
      </div>
      <AmbientStrip />
      {openDialog ? (
        <OpenWorkspaceDialog open={openDialog} onOpenChange={setOpenDialog} />
      ) : null}
    </div>
  );
}
