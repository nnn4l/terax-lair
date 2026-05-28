# Lair M3 Smoke Results

Date: 2026-05-28

## Automated checks

| Check | Result | Notes |
|---|---:|---|
| `pnpm exec tsc --noEmit` | ✓ | Pass |
| `pnpm test --run` | ✓ | 13 files, 77 tests passed |
| `cd src-tauri && cargo build` | ✓ | Pass |
| `cd src-tauri && cargo clippy -- -D warnings` | ✓ | Pass after clippy cleanup |
| `cd src-tauri && cargo test --locked` | ✓ | 191 passed, 4 ignored |

## Manual matrix

`pnpm tauri dev` interactive walk not completed in this agent session. Items below need live app verification.

| # | Test | Result | Notes |
|---|---|---:|---|
| 1 | Seed lanes | Pending | Live app required |
| 2 | Lane Picker grouped | Pending | Live app required |
| 3 | Send via Pi Implementor | Pending | Live app required |
| 4 | Send via Pi Fast | Pending | Live app required |
| 5 | Auto routes test prompt | Pending | Live app required |
| 6 | Auto routes refactor strategy | Pending | Live app required |
| 7 | Open three tabs via + button | Pending | Live app required |
| 8 | Switch tabs mid-stream | Pending | Live app required |
| 9 | Home or Cmd+K opens modal | Pending | Live app required |
| 10 | Click session card in Home | Pending | Live app required |
| 11 | Esc / backdrop closes Home | Pending | Live app required |
| 12 | Context meter cycles | Pending | Live app required |
| 13 | Meter popover shows lanes + /clear | Pending | Live app required |
| 14 | /clear on Pi Implementor | Pending | Live app required |
| 15 | Stop button kills stream | Pending | Live app required |
| 16 | Cmd+. kills stream | Pending | Live app required |
| 17 | lanes.toml watcher updates picker | Pending | Live app required |
| 18 | Kill Pi process recovery | Pending | Live app required |
| 19 | Dashboard three-row layout | Pending | Live app required |
| 20 | Click priority copies | Pending | Live app required |
| 21 | Click workspace row opens repo tab | Pending | Live app required |
| 22 | First-run no workspaces empty state | Pending | Live app required |
| 23 | No plan fallback | Pending | Live app required |
| 24 | persisted `agent_choice: "compare"` migration | Pending | Live app required |
| 25 | persisted phase `plan` migration | Pending | Live app required |
