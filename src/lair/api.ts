import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  CardUpdateEvent,
  ChecklistData,
  ChecklistSection,
  ModelInfo,
  NarrationEvent,
  AutopilotMode,
  QueueEvent,
  QueueItem,
  SendMessageRequest,
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
