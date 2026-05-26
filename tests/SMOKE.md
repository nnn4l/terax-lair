# Lair Smoke Results

M1 rows: 1-10. M2 rows: 11-21.

Date: 2026-05-25

Run `pnpm tauri dev`, then walk this matrix and fill the Result + Notes columns.

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Workspace set. Agent = Claude. Phase = implement. Prompt: "list 3 files in cwd". Send. Skeleton card streams, then collapses to summary. Expand reveals full output. | | |
| 2 | Same with Codex. | | |
| 3 | Agent = Compare, prompt: "what's 2+2?". Two cards appear in parallel; both summarize independently. | | |
| 4 | Agent = Auto, phase = brainstorm, prompt: "should I rewrite my game in Rust?". Routes to Claude. | | |
| 5 | Agent = Auto, phase = implement, prompt: "rename variable x to y in this file". Routes to Codex. | | |
| 6 | Change phase mid-session. Next message uses new phase prefix (visible in raw output). | | |
| 7 | Send empty input. Send button disabled. | | |
| 8 | Workspace switcher: change to another worktree. Next message runs in that cwd. | | |
| 9 | Disconnect network. Send a message. CLI streams; summarizer fails; card shows raw output with error badge. | | |
| 10 | Terax inherited features (terminal, editor, file tree, git panel) still work. | | |
| 11 | Agent = Auto. Send any message. Narration line "Routing to ... Reason: ..." appears above the card. | | |
| 12 | Agent = Claude. Send. Narration "Dispatching to Claude." appears, card streams, then narration "Claude done. ..." appears under the card. | | |
| 13 | Agent = Compare. Send. Narration "Launching both ..." appears, two cards stream, two done narrations follow. | | |
| 14 | On a successful card, click `→ checklist`. Pick `Now`. Item appears in the checklist panel above the file tree within 200ms. | | |
| 15 | Externally edit `.lair/checklist.md` (add `- [ ] foo` under `## Now`). Panel reflects within 200ms via the file watcher. | | |
| 16 | Toggle a checklist item via the panel checkbox. `.lair/checklist.md` updates on disk. | | |
| 17 | Claude pill bar: pick model = `haiku-4.5`, effort = `high`. Send. Card header chip shows model + effort. CLI was invoked with `--model claude-haiku-4-5` (verify via raw output / stderr). | | |
| 18 | Codex pill bar: pick effort = `high`. Send. CLI invoked with `--reasoning high` (verify per installed Codex CLI). | | |
| 19 | After any successful card, footer shows usage badge `X.Xk in · X.Xk out · $0.XXX`. Tooltip on hover shows raw numbers. | | |
| 20 | Phase = Refactor. Prompt: "add a new feature: dark mode toggle". Agent pushes back / refuses to add new feature (real per-phase system prompt is active). | | |
| 21 | Phase change mid-session (Refactor → Implement). Next message reflects new system prompt (agent willing to add features). | | |
