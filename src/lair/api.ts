import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  CardUpdateEvent,
  ChecklistData,
  ChecklistSection,
  ModelInfo,
  NarrationEvent,
  SendMessageRequest,
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
