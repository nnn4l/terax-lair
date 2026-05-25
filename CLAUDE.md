# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read TERAX.md first

`TERAX.md` is the authoritative architecture + conventions doc and is loaded as agent memory by Terax itself. Read it before making non-trivial changes. The summary below only flags the rules that are easy to violate on a cold start; TERAX.md has the full rationale and the architecture detail.

## Commands

Package manager is **pnpm only** (never npm/npx/yarn). All commands run from the repo root unless noted.

- Install: `pnpm install`
- Dev (Tauri shell + Vite): `pnpm tauri dev`
- Production bundle: `pnpm tauri build`
- Frontend type-check: `pnpm exec tsc --noEmit`
- Frontend tests (Vitest): `pnpm test` (CI) / `pnpm test:watch` (TDD)
- Single frontend test: `pnpm exec vitest run path/to/file.test.ts` or `-t "test name"`
- Rust lint: `cd src-tauri && cargo clippy`
- Rust tests: `cd src-tauri && cargo test --locked`
- Single Rust test: `cd src-tauri && cargo test <name> -- --nocapture`

"Done" requires all four checks pass: `tsc --noEmit`, `pnpm test`, `cargo clippy`, `cargo test --locked`. Core-subsystem changes (terminal/shell spawn, workspace auth, git, fs, IPC, AI tool surface) need a test that locks the invariant.

## Architecture in one paragraph

Two-process Tauri 2 app. **Rust (`src-tauri/src/`) owns every OS interaction** (PTY via `portable-pty`, fs, git, shell, secrets via OS keychain, AI HTTP proxy with SSRF guard, workspace auth registry) and exposes each as a `#[tauri::command]` registered in `src-tauri/src/lib.rs`. **Frontend (`src/`)** is a single-window React 19 + TypeScript app; features live in `src/modules/<area>/` (terminal, editor, explorer, ai, agents, git-history, source-control, tabs, theme, settings, etc.) and `App.tsx` is only a coordinator wiring them together. Tabs are a tagged union and are never unmounted on switch (hidden via `invisible pointer-events-none`) so PTYs and dev servers keep streaming. The AI subsystem is BYOK via Vercel AI SDK v6 with keys stored only in the OS keychain (`secrets_*` commands, service `terax-ai`); tools that mutate state set `needsApproval: true` and `lib/security.ts` is a deny-list applied on both read and write that must not be bypassed.

See TERAX.md sections "Architecture", "PTY shell integration", "AI subsystem", "Cross-platform conventions", and "Known gotchas" for the load-bearing details (ConPTY `SPAWN_LOCK`, Windows Job Object lifecycle, OSC 7/133 parsing, path normalization, AiComposerProvider unconditional mount, React 19 strict-mode double-spawn).

## Hard rules

- **pnpm only.** Never npm/npx/yarn.
- **No em-dash** anywhere (code, comments, commits, docs).
- **No emojis** anywhere.
- **Imports**: always `@/...` on the frontend, never relative across modules.
- **Comments**: default to none. If genuinely needed, 1-2 lines on *why*, never *what*. No AI-generic filler.
- **Paths**: canonical form on the frontend is forward-slash. When a path may come from OSC 7, the explorer, or the OS, split on `/[\\/]/` rather than `"/"`.
- **Secret-path deny-list** (`lib/security.ts`) applies on both read and write. Never bypass.
- **Quality bar**: correctness, performance (the product is ~7-8 MB and ultra-light: weigh RAM, IPC round-trips, re-renders, dep weight on every change), security (validate at every IPC/fs/network/AI-tool boundary), UI polish, and functional-core / imperative-shell architecture.

## Adding a Tauri plugin

Three steps, all required: (1) `Cargo.toml` dependency, (2) `.plugin(...)` call in `src-tauri/src/lib.rs::run()`, (3) capability entry in `src-tauri/capabilities/default.json`.

## shadcn/ui and AI Elements

Primitives in `src/components/ui/` and `src/components/ai-elements/` are generated. Do not hand-edit. Re-run `pnpm dlx shadcn add` to upgrade; composition wrappers belong in `src/modules/ai/components/` (or the relevant module).
