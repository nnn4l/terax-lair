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

Filled in during Task 2.
