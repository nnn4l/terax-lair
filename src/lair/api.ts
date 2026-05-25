import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  CardUpdateEvent,
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

export async function listWorktrees(root: string): Promise<Worktree[]> {
  return await invoke<Worktree[]>("lair_list_worktrees", {
    root,
    workspace: currentWorkspaceEnv(),
  });
}
