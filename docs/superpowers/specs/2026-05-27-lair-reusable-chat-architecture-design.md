# Lair Reusable Chat Architecture Design

Date: 2026-05-27

## Goal

Build one polished, reusable chat architecture for Lair. It should power workspace chats, implementation chats, brainstorm chats, and the dashboard orchestrator chat without replacing the current visual identity.

The system should avoid the current card-first problem. Assistant text is the primary response. Cards support the response with run status, tool activity, approvals, errors, and progress.

## Core Architecture

The chat system is split into four layers:

- `chat-ui`: reusable UI components for header, thread, message, composer, markdown, actions, empty states, and run cards.
- `chat-store`: local state for chats, messages, active agent, lock state, run state, and queue/spec bindings.
- `chat-transport`: a small adapter interface used by every backend path.
- `chat-transports`: concrete adapters for orchestrator, Codex CLI, Claude CLI, mock responses, and later OpenClaw.

The first useful implementation should build the reusable shell and transport boundary, then connect it to the existing Lair CLI agent path. Terax AI chat can be used as a visual and component reference, but its token/API-dependent backend should not become the core architecture.

## Chat Scopes And Types

Chat scope describes where the chat lives:

- `dashboard`: vault and planning oriented, not repo-first.
- `workspace`: tied to a repo/workspace.
- `spec`: tied to one imported spec and its queue.

Chat type describes purpose:

- `simple`: quick user task. Defaults to Auto.
- `brainstorm`: in-repo brainstorming, useful when the main implementation path is blocked by usage limits or context issues.
- `implementation`: one chat per spec. It hard-follows the queue/spec execution model.
- `dashboard`: dashboard orchestrator chat for vault interaction, daily planning, memory, and routing into workspaces/specs.

A workspace can have many chats. A spec creates one implementation chat, not one chat per queue row. Queue rows visualize the spec execution plan and current phase, but the implementation chat remains the single conversation for that spec.

## Agent Routing And Locking

Auto chats begin with the orchestrator. The orchestrator is a real model call using Haiku via OpenRouter now, with OpenClaw planned later.

The orchestrator may:

- ask a compact clarifying checklist
- dispatch to Codex
- dispatch to Claude
- report a blocked or error state

Once dispatched, the chat locks to the chosen agent. The lock is sticky, not absolute. It can change through explicit user handoff, usage limits, repeated agent failure, tool failure, or a capability mismatch.

Implementation/spec chats will usually route to Codex by default because implementation is expected to be its strongest and highest-usage path. Claude remains available for handoff or special cases.

## Orchestrator Contract

The orchestrator should return structured dispatch data, not only prose.

Recommended shape:

```ts
interface OrchestratorDecision {
  mode: "clarify" | "dispatch" | "blocked";
  agent?: "codex" | "claude";
  reason: string;
  message: string;
  startingPrompt?: string;
  confidence?: number;
}
```

For unclear requests, the orchestrator should ask a short checklist before dispatching. This avoids slow, confusing starts inside CLI agents.

If OpenRouter is unavailable or the token is missing, the UI should show a visible warning and offer a fallback route to Codex. It should not silently fail.

## UI Design

Use one `ChatShell` everywhere. Dashboard center chat should be a wrapper around the same shell, not a separate chat implementation.

Shared UI pieces:

- `ChatHeader`: title, scope chip, state chip, queue phase chip when relevant, agent lock/handoff control.
- `ChatThread`: scrollable message list with bottom anchoring that does not fight the user when they scroll upward.
- `ChatMessage`: readable user and assistant messages, markdown support, subtle metadata where existing style supports it.
- `RunCards`: inline supporting cards for thinking, command, approval, tool event, error, stopped, and done states.
- `ChatComposer`: multiline input, Enter to send, Shift+Enter for newline, stop while running.
- `MessageActions`: copy, retry, optional edit for user message, optional handoff.
- `EmptyState`: scope-specific prompt chips.

State chips:

- `Orchestrating`
- `Codex`
- `Claude`
- `Brainstorm`
- `Stopped`
- `Error`

Assistant text must stream visibly as the actual answer. Cards should spawn immediately when processing starts, so the user sees activity without waiting for final agent output.

## Data Flow

Send flow:

1. User sends message.
2. Store creates a user message and an assistant placeholder immediately.
3. If chat is Auto and not locked, transport routes to orchestrator.
4. Orchestrator clarifies, dispatches, or blocks.
5. Dispatch starts the selected CLI transport and locks the chat.
6. Agent text streams into the assistant message.
7. Agent events update run cards attached to that message.
8. Stop cancels the active transport and marks the message stopped.

Implementation chat flow:

1. Spec import creates one implementation chat and one queue execution model.
2. Queue UI exposes `Open chat` or `Continue`.
3. Opening the queue chat loads the single implementation chat.
4. Current queue phase/item is injected into each send.
5. Built-in phase modes are removed or folded into queue metadata.

Dashboard chat flow:

1. Dashboard chat uses the same shell and orchestrator.
2. Context comes from vault, daily plan, recent workspaces, and project memory.
3. Dashboard chat can suggest specs, workspaces, and next actions.
4. Repo implementation work should route into workspace/spec chat instead of pretending the dashboard chat is the repo agent.

## Persistence And Memory

The vault is the durable project memory. Chat persistence can be local and lightweight at first.

Initial persistence requirements:

- keep chats available during the app session
- preserve implementation chat identity for imported specs
- preserve agent lock state per chat
- preserve enough message state for retry and visible history

Non-goals for the first pass:

- database-backed chat history
- fake citations
- full cross-chat memory synthesis
- replacing the vault as project memory

## Error Handling

Required visible states:

- OpenRouter token missing or request failed
- CLI agent limit reached
- CLI command failed
- transport stopped by user
- orchestrator returned blocked
- handoff failed

Errors should appear in the thread and, when relevant, as run cards with retry or handoff actions.

## Suggested File Layout

```text
src/lair/chat/
  types.ts
  store.ts
  transports/
    types.ts
    mockTransport.ts
    orchestratorTransport.ts
    codexCliTransport.ts
    claudeCliTransport.ts
  components/
    ChatShell.tsx
    ChatHeader.tsx
    ChatThread.tsx
    ChatMessage.tsx
    ChatComposer.tsx
    RunCards.tsx
    EmptyState.tsx
    MessageActions.tsx
```

The existing dashboard `OrchestratorChatCard` should become a thin wrapper around `ChatShell`.

## Test Plan

Unit tests:

- create chat with scope/type
- send creates user message plus assistant placeholder
- orchestrator clarification keeps chat unlocked
- orchestrator dispatch locks the chat
- handoff changes agent lock
- stop marks run stopped
- implementation chat injects current queue context

Transport tests:

- mock stream success
- mock failure
- stop/cancel
- dispatch payload parsing

UI smoke tests:

- dashboard chat renders with dashboard scope
- simple chat starts in Auto
- implementation chat opens from queue/spec
- cards appear immediately while processing
- assistant response text remains visible and copyable

## M3b Scope

Recommended first implementation slice:

- shared chat types
- shared chat store
- shared chat shell UI
- mock transport for no-token testing
- Lair CLI transport integration for Codex/Claude cards and streaming
- dashboard chat uses same shell visually
- orchestrator transport boundary, with real OpenRouter connection if existing project config supports it

Defer:

- OpenClaw integration
- full vault action tooling
- database chat history
- cross-chat memory synthesis
- advanced handoff packaging

## Self Review

- No placeholders left.
- One chat per spec is explicit.
- Queue rows do not create chats.
- Dashboard chat reuse is explicit.
- Orchestrator is a real model, not fake routing.
- Agent lock is sticky with defined escape hatches.
- First implementation slice is narrow enough for M3b.
