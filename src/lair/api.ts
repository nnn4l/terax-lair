import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  BackendStatusEvent,
  CardUpdateEvent,
  ChecklistData,
  ChecklistSection,
  HubState,
  Lane,
  LaneStatus,
  ModelInfo,
  NarrationEvent,
  AutopilotMode,
  PillarFinding,
  QueueEvent,
  QueueItem,
  SendMessageRequest,
  SpecCompleteEvent,
  StaleReport,
  StreamChunkEvent,
  Worktree,
} from "@/lair/types";
import { currentWorkspaceEnv } from "@/modules/workspace";

export async function sendMessage(req: SendMessageRequest): Promise<string[]> {
  return await invoke<string[]>("lair_send_message", { req });
}

export async function onCardUpdate(
  cb: (event: CardUpdateEvent) => void,
): Promise<UnlistenFn> {
  return await listen<CardUpdateEvent>("lair-card-update", (event) =>
    cb(event.payload),
  );
}

export async function onStreamChunk(
  cb: (event: StreamChunkEvent) => void,
): Promise<UnlistenFn> {
  return await listen<StreamChunkEvent>("lair-stream-chunk", (event) =>
    cb(event.payload),
  );
}

export async function onNarration(
  cb: (event: NarrationEvent) => void,
): Promise<UnlistenFn> {
  return await listen<NarrationEvent>("lair-narration", (event) =>
    cb(event.payload),
  );
}

export async function listWorktrees(root: string): Promise<Worktree[]> {
  return await invoke<Worktree[]>("lair_list_worktrees", {
    root,
    workspace: currentWorkspaceEnv(),
  });
}

export async function readChecklist(workspace: string): Promise<ChecklistData> {
  return await invoke<ChecklistData>("lair_read_checklist", { workspace });
}

export async function appendChecklistItem(
  workspace: string,
  section: ChecklistSection,
  text: string,
): Promise<void> {
  await invoke("lair_append_checklist_item", { workspace, section, text });
}

export async function toggleChecklistItem(
  workspace: string,
  line: number,
): Promise<void> {
  await invoke("lair_toggle_checklist_item", { workspace, line });
}

export async function deleteChecklistItem(
  workspace: string,
  line: number,
): Promise<void> {
  await invoke("lair_delete_checklist_item", { workspace, line });
}

export async function watchChecklist(workspace: string): Promise<void> {
  await invoke("lair_watch_checklist", { workspace });
}

export async function onChecklistChanged(cb: () => void): Promise<UnlistenFn> {
  return await listen("lair-checklist-changed", () => cb());
}

export async function listModels(): Promise<ModelInfo[]> {
  return await invoke<ModelInfo[]>("lair_list_models");
}

export async function listHubTabs(): Promise<HubState> {
  return await invoke<HubState>("lair_list_hub_tabs");
}

export async function openRepoTab(repoPath: string): Promise<HubState> {
  return await invoke<HubState>("lair_open_repo_tab", { repoPath });
}

export async function closeHubTab(tabId: string): Promise<HubState> {
  return await invoke<HubState>("lair_close_hub_tab", { tabId });
}

export async function switchHubTab(tabId: string): Promise<HubState> {
  return await invoke<HubState>("lair_switch_hub_tab", { tabId });
}

export async function importSpec(
  workspace: string,
  path: string,
): Promise<QueueItem[]> {
  return await invoke<QueueItem[]>("lair_import_spec", { workspace, path });
}

export async function pasteSpec(
  workspace: string,
  markdown: string,
): Promise<QueueItem[]> {
  return await invoke<QueueItem[]>("lair_paste_spec", { workspace, markdown });
}

export async function listSpecs(workspace: string): Promise<string[]> {
  return await invoke<string[]>("lair_list_specs", { workspace });
}

export async function queuePause(): Promise<void> {
  await invoke("lair_queue_pause");
}

export async function queueResume(): Promise<void> {
  await invoke("lair_queue_resume");
}

export async function queueSkip(): Promise<void> {
  await invoke("lair_queue_skip");
}

export async function queuePin(itemId: string): Promise<void> {
  await invoke("lair_queue_pin", { itemId });
}

export async function queueUnpin(): Promise<void> {
  await invoke("lair_queue_unpin");
}

export async function queueGet(): Promise<QueueItem[] | null> {
  return await invoke<QueueItem[] | null>("lair_queue_get");
}

export async function queueSetAutopilot(mode: AutopilotMode): Promise<void> {
  await invoke("lair_queue_set_autopilot", { mode });
}

export async function queueResync(acceptedIds: string[]): Promise<void> {
  await invoke("lair_queue_resync", { acceptedIds });
}

export async function queueCheckStale(): Promise<StaleReport[]> {
  return await invoke<StaleReport[]>("lair_queue_check_stale");
}

export async function queueApprove(): Promise<void> {
  await invoke("lair_queue_resume");
}

export async function queueDrop(itemId: string): Promise<void> {
  await invoke("lair_queue_drop", { itemId });
}

export async function queueMarkDone(itemId: string): Promise<void> {
  await invoke("lair_queue_mark_done", { itemId });
}

export async function queueEditContext(itemId: string, context: string): Promise<void> {
  await invoke("lair_queue_edit_context", { itemId, context });
}

export async function onQueueEvent(
  cb: (event: QueueEvent) => void,
): Promise<UnlistenFn> {
  return await listen<QueueEvent>("lair-queue-event", (event) =>
    cb(event.payload),
  );
}

export async function onSpecChanged(
  cb: (file: string) => void,
): Promise<UnlistenFn> {
  return await listen<string>("lair-spec-changed", (event) =>
    cb(event.payload),
  );
}

export async function readPillars(workspace: string): Promise<string> {
  return await invoke<string>("lair_read_pillars", { workspace });
}

export async function runPillarCheck(
  workspace: string,
): Promise<PillarFinding[]> {
  return await invoke<PillarFinding[]>("lair_run_pillar_check", { workspace });
}

export async function dispatchCritiques(
  workspace: string,
  items: string[],
  mode: "linear" | "parallel",
): Promise<void> {
  await invoke("lair_dispatch_critiques", { workspace, items, mode });
}

export async function onSpecComplete(
  cb: (event: SpecCompleteEvent) => void,
): Promise<UnlistenFn> {
  return await listen<SpecCompleteEvent>("lair-spec-complete", (event) =>
    cb(event.payload),
  );
}

// ---- M3: Lane + Stop API ----

export async function listLanes(): Promise<Lane[]> {
  return await invoke<Lane[]>("lair_list_lanes");
}

export async function saveLane(lane: Lane): Promise<void> {
  await invoke("lair_save_lane", { lane });
}

export async function deleteLane(laneId: string): Promise<void> {
  await invoke("lair_delete_lane", { laneId });
}

export async function getLaneStatus(laneId: string): Promise<LaneStatus | null> {
  return await invoke<LaneStatus | null>("lair_get_lane_status", { laneId });
}

export async function getAllLaneStatus(): Promise<LaneStatus[]> {
  return await invoke<LaneStatus[]>("lair_get_all_lane_status");
}

export async function clearLane(laneId: string): Promise<void> {
  await invoke("lair_clear_lane", { laneId });
}

export async function stopCard(cardId: string): Promise<void> {
  await invoke("lair_stop_card", { cardId });
}

export async function onLaneStatusChanged(
  cb: (status: LaneStatus) => void,
): Promise<UnlistenFn> {
  return await listen<LaneStatus>("lair-lane-status-changed", (e) => cb(e.payload));
}

export async function onBackendStatusChanged(
  cb: (event: BackendStatusEvent) => void,
): Promise<UnlistenFn> {
  return await listen<BackendStatusEvent>("lair-backend-status-changed", (e) => cb(e.payload));
}

export async function onLaneCleared(
  cb: (laneId: string) => void,
): Promise<UnlistenFn> {
  return await listen<string>("lair-lane-cleared", (e) => cb(e.payload));
}
