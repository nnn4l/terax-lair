# Lair M1 Smoke Results

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
