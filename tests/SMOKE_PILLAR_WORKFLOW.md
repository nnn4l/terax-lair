# Lair Workflow Integration Smoke Matrix

Date: 2026-05-27

Automated checks run during implementation:

| Check | Result | Notes |
|---|---|---|
| `pnpm exec tsc --noEmit` | Pass | Frontend typecheck clean after Tasks 7-11. |
| `pnpm test --run src/lair/components/LairChat.test.tsx` | Pass | 7 tests passed. |
| `pnpm test src/lair/state.test.ts` | Pass | 2 tests passed. Persist storage warnings are expected in test runtime. |
| `cargo build` | Pass | Tauri backend builds after workflow wiring. |
| `cargo test --lib lair::pillar` | Pass | 6 passed, 1 ignored real API smoke. |
| `cargo test --lib lair::queue::tests::all_leaves_checked` | Pass | 4 passed. |
| `cargo test --lib lair::hub_tabs::tests` | Pass | 8 passed. |

Manual app smoke checklist:

| # | Test | Result | Notes |
|---|---|---|---|
| 1 | Pillars file auto-create | Not run | Open a fresh workspace with no `.lair/pillars.md`. |
| 2 | Pillar text injected into system prompt | Not run | Edit `.lair/pillars.md`, save, then send a prompt that reveals current system context. |
| 3 | PhaseDropdown shows Critique not Plan | Not run | Options should be implement, refactor, test, critique, review. |
| 4 | Phase migration plan -> implement | Not run | Set persisted phase to `plan`, reload, confirm no crash and phase becomes `implement`. |
| 5 | Spec complete fires PillarCheckCard | Not run | Complete final queue leaf while phase is Implement. |
| 6 | Pillar check populates tray | Not run | Click run check, expect critique tray drafts from findings. |
| 7 | Skip dismisses without findings | Not run | Click skip on PillarCheckCard. |
| 8 | Critique button toggles tray | Not run | Composer critique button opens and closes tray. |
| 9 | Linear dispatch | Not run | Add 3 drafts, click linear, expect sequential critique cards. |
| 10 | Parallel dispatch | Not run | Add 3 drafts, click parallel, expect concurrent critique cards. |
| 11 | Empty drafts disable dispatch | Not run | Linear and parallel buttons disabled when all drafts are blank. |
| 12 | Pillar check failure retry/skip | Not run | Disable network or remove key, click run check, expect retry and skip. |
| 13 | Re-complete during Critique suppressed | Not run | Completing queue work while already in Critique should not fire another card. |
| 14 | Deleted pillars auto-recreate | Not run | Delete `.lair/pillars.md`, then send a message. File should be recreated. |

