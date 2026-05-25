# Lair Fork Notes

Forked from `crynta/terax-ai` @ `34b0a0b` (v0.7.3). Tag: `lair-baseline`. Origin: `nnn4l/terax-lair`. Upstream: `crynta/terax-ai`.

## What we keep from Terax (don't touch)

- CodeMirror editor (`src/modules/editor/`)
- File explorer (`src/modules/explorer/`)
- xterm.js terminal stack (`src/modules/terminal/`)
- Git panel + history (`src/modules/source-control/`, `src/modules/git-history/`)
- Existing AI agent/provider abstraction (`src/modules/ai/`): used as fallback
- Theme engine + shadcn/ui primitives
- Tauri command surface for fs, pty, git, shell, secrets, workspace, net

## What we add (in `src/lair/` and `src-tauri/src/lair/`)

- Claude Code + Codex CLI providers via subprocess (PTY-backed if Terax's PTY layer supports detached one-shot spawn; otherwise `tokio::process::Command`)
- Card-style summary chat (`LairChat`) with caveman compression
- Phase dropdown (brainstorm/plan/implement/refactor/test/review)
- Agent dropdown: Codex (default) / Claude / Compare / Auto
- OpenRouter (Haiku) summarizer + Auto router
- Worktree workspace switcher

## What we replace

- Default chat panel -> `LairChat` mounted as a tab (or alongside, behind a setting). Terax's chat stays available for M1.

## Map

- Chat panel: `src/modules/ai/components/AiChat.tsx` renders existing Terax chat messages. It is pulled through lazy exports in `src/modules/ai/components/lazy.tsx` and `src/modules/ai/index.ts`.
- Chat state store: `src/modules/ai/store/chatStore.ts`. `useChatStore` owns selected model, sessions, panel open state, active session id, live context, approvals, and `getOrCreateChat(sessionId)`. `makeChat()` wires `createContextAwareTransport()` from `src/modules/ai/lib/transport.ts`.
- Provider abstraction: `src/modules/ai/config.ts` defines `ProviderId`, `ProviderInfo`, `PROVIDERS`, `MODELS`, `DEFAULT_MODEL_ID`, keyless providers, and local provider defaults. Runtime model construction is in `src/modules/ai/lib/agent.ts` via `buildLanguageModel()` and `buildConfiguredLanguageModel()`. Registering a provider means extending `ProviderId`, adding a `PROVIDERS` entry, adding models, adding a `buildLanguageModel` switch arm, and updating key/settings UI if it needs user configuration.
- Settings/providers list: `src/settings/sections/ModelsSection.tsx` renders provider cards, add-provider menu, default chat model picker, local provider fields, and OpenRouter model id. Defaults and persistence live in `src/modules/settings/store.ts`; the hydrated cross-window store is `src/modules/settings/preferences.ts`; settings window routing is `src/modules/settings/openSettingsWindow.ts` and `src/settings/SettingsApp.tsx`.
- PTY frontend API: `src/modules/terminal/lib/pty-bridge.ts` exposes `openPty(cols, rows, handlers, cwd?)` returning `{ id, write(data), resize(cols, rows), close() }`. It invokes `pty_open`, `pty_write`, `pty_resize`, and `pty_close` with `currentWorkspaceEnv()`.
- PTY Rust API: `src-tauri/src/modules/pty/mod.rs` defines `pty_open(app, state, registry, cols, rows, cwd, workspace, on_data, on_exit) -> Result<u32, String>`, plus `pty_write`, `pty_resize`, `pty_close`, and `pty_close_all`. `pty_open` authorizes cwd through `authorize_user_spawn_cwd()` before spawning.
- PTY spawn internals: `src-tauri/src/modules/pty/session.rs::spawn(id, app, cols, rows, cwd, workspace, on_data, on_exit) -> Result<(Arc<Session>, PtySize), String>` builds the shell command through `shell_init::build_command()`, opens `portable_pty`, streams data through Tauri channels, emits agent signals, and serializes ConPTY lifecycle on Windows. It is interactive shell-focused, so Lair Task 4 can fall back to `tokio::process::Command` for one-shot CLI calls if this API does not fit.
- Tauri command registration: `src-tauri/src/lib.rs::run()` wires managed state and the `tauri::generate_handler![...]` list. Lair commands should be registered there after adding `src-tauri/src/lair/` modules.
- App mount point: `src/app/App.tsx`. Existing AI input is mounted below `workspaceSurface` in the workspace panel around the `AiInputBar` block. Existing mini chat is `AiMiniWindow`, with `AgentRunBridge` and `LocalAgentNotificationsBridge` mounted near the root. A Lair tab mount will need either a new tab kind in `src/modules/tabs/lib/useTabs.ts` plus a stack block in `workspaceSurface`, or a replacement/side-by-side panel around the current AI input region.
- Managed terminal agents: `src/app/App.tsx` `spawnManagedAgent()` opens a terminal tab via `newAgentTab()` from `src/modules/tabs/lib/useTabs.ts`, installs Claude hooks, and writes `claude <task>\r`. This is the closest existing path for Task 4/7 integration, but it is Claude-specific today.
