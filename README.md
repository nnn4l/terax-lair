# Lair

Personal desktop workshop for Claude Code + Codex. Forked from [Terax AI](https://github.com/crynta/terax-ai); see `LAIR_NOTES.md` for what changed.

## Setup

```bash
pnpm install
cp .env.example .env
# edit .env with your OpenRouter API key
pnpm tauri dev
```

## Required env

- `OPENROUTER_API_KEY` for Haiku summarization + Auto routing
- `OPENROUTER_MODEL` (optional) defaults to `anthropic/claude-haiku-4.5`

## Required CLIs on PATH

- `claude` (Claude Code)
- `codex`

## What's different from Terax

- Claude Code + Codex CLI providers
- Card-style summary chat (LairChat)
- Phase dropdown
- Agent dropdown: Codex (default), Claude, Compare, Auto
- Git worktree workspace switcher
- Everything else inherited from Terax
