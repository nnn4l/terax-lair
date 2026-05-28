# Lair Dashboard Design Brief

**Date:** 2026-05-27
**Status:** Confirmed (Nathan, pending later critique)
**Produced via:** `impeccable shape` skill
**Replaces:** `src/lair/components/DashboardView.tsx` current layout

## 1. Feature Summary

Lair Dashboard. Cross-project orientation surface that appears as the default tab when Lair opens. Answers "what should I work on right now?" Tells Nathan today's plan, where his current focus is, which workspaces are warm, and lets him talk to the vault/orchestrator without entering a workspace first. Distinct from the workspace view (chat + queue + editor); Dashboard sits *before* picking a project.

## 2. Primary User Action

Pick a workspace and drop into work. Every other surface on the Dashboard either supports that choice or accomplishes a smaller task without entering a workspace.

## 3. Design Direction

- **Color strategy:** Restrained (per DESIGN.md). Single accent on the primary action. Lane chips on workspace cards use existing per-lane accent borders. Today's briefing uses semantic tokens only.
- **Theme:** dark, locked. Scene: Nathan at desk after dinner, monitor at eye level, deep in a session that started before sunset.
- **Anchors:** Cocos Creator project hub (workspace card grid + metadata), Raycast (keyboard-first feel, dense legibility), Linear inbox view (calm density), Terax existing chat composer (visual sibling).

## 4. Scope

- Fidelity: high-fi brief; production-ready when implemented later
- Breadth: one surface (the Dashboard tab)
- Interactivity: static layout + named interactions; no animations specced beyond DESIGN.md defaults
- Time intent: ships when M3 ships

## 5. Layout Strategy

Three-row, asymmetric grid. Not a card grid.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Lair                                          [settings] [home: active]│
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  TODAY                                                                 │
│  Friday, May 27 — 14:23                          63°F clear · Bay Area │
│                                                                        │
│  Three priorities                                                      │
│   1. Combo Cars run-loop pass                                          │
│   2. Lair M3 lane scaffolding                                          │
│   3. APUSH essay (due Mon)                                             │
│                                                                        │
│  Now: Lair M3 lane scaffolding · queue 3/12 · last touched 2h ago      │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌─ Workspaces ──────────────────┐  ┌─ Orchestrator ────────────────┐ │
│   │ ★ terax-lair         2h ago   │  │  Ask about the vault, plans,  │ │
│   │   combo-cars         yesterday│  │  project memory, or what to   │ │
│   │   medieval-shooter   3d ago   │  │  work on next.                │ │
│   │   apush-essay        5d ago   │  │                               │ │
│   │   + open another                │  │  [Plan today]                 │ │
│   │                               │  │  [What's overdue]             │ │
│   │                               │  │  [Brainstorm Combo Cars]      │ │
│   │                               │  │  [Ingest raw/]                │ │
│   │                               │  │                               │ │
│   │                               │  │  > type message...            │ │
│   └───────────────────────────────┘  └───────────────────────────────┘ │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  vault: 2 uningested · 5 wiki edits today · log entry pending          │
└────────────────────────────────────────────────────────────────────────┘
```

Three rows, fluid:

- **Row 1 — TODAY (top, full-width).** Briefing block. Day/date/time + weather + three priorities + "Now" status line. No card chrome around it. Generous vertical padding (`py-6`). Editorial density: feels like reading a printed agenda. Section label `TODAY` in `text-[10px] uppercase tracking-wide text-muted-foreground/70`. Priorities numbered, body weight, scannable. "Now" line in `text-muted-foreground` smaller than priorities but still ~`text-[13px]`.
- **Row 2 — Workspaces + Orchestrator (middle, two columns, asymmetric).** Workspaces ~38% width; Orchestrator ~62%. Workspaces left because it's the secondary action; Orchestrator dominant because it's the more frequent action. No card-in-card; each is a bordered region with section header.
  - **Workspaces column:** vertical list of recent workspaces. Each row: small lane chip + project name + last-touched relative time. Active/last workspace marked with a small star or `bg-muted` highlight. "+ open another" affordance at bottom. Single sorted list (last touched first), max 6 visible, scroll for more.
  - **Orchestrator column:** chat composer + empty-state starter chips. Reuses `ChatShell`. Starter chips as rounded-pill buttons that pre-fill the composer. After the first send, chips collapse and chat thread takes over.
- **Row 3 — Ambient strip (bottom, full-width, single line).** `text-[11px] text-muted-foreground`. Uningested file count from `raw/`, wiki edits today, pending log entries. Hidden entirely if all counts zero.

Spatial rhythm: Row 1 contemplative, Row 2 active, Row 3 ambient. Distinct padding per row.

No identical card grid. Rows feel like newspaper sections, not bento boxes.

## 6. Key States

- **Default:** workspaces present, today's plan exists, orchestrator ready. Renders the layout above.
- **First-run (no workspaces):** Row 1 still shows briefing if vault has a plan. Workspaces column shows large dashed-border empty state: "No workspaces yet. Open one to start." with prominent "+ open workspace" button centered. Orchestrator works normally.
- **No plan today:** Row 1 collapses priorities + Now line; renders only "Friday, May 27 — 14:23 · 63°F clear" with a quiet prompt: "Build today's plan with /plan in vault" linking to vault path. Doesn't replace the whole row with empty-state chrome; just trims.
- **No orchestrator yet (no API key set):** Orchestrator column renders inline notice: "Connect a model in settings to talk to the vault." Link to settings → models. Starter chips dim. Workspaces still functional.
- **Loading:** Row 1 shows skeleton lines for priorities (3 thin grey bars). Workspaces column shows 3 skeleton rows. Orchestrator empty state renders immediately (no skeleton). Total skeleton time ≤500ms typical.
- **Ambient strip empty:** hidden, no shadow of the row left.

## 7. Interaction Model

- **Click workspace row:** opens or switches to that workspace's repo tab in the hub; Dashboard tab stays open.
- **Click "+ open another":** spawns `OpenWorkspaceDialog`. On confirm, opens workspace tab.
- **Click starter chip:** pre-fills orchestrator composer; doesn't auto-send.
- **Send orchestrator message:** chip strip collapses; chat thread renders responses inline using `ChatShell`.
- **Hover workspace row:** subtle `bg-muted/30` lift. Last-touched timestamp gets full date in tooltip.
- **Click priority text in Row 1:** copies to clipboard with small toast. No deep-link to vault (M4 work).
- **Click ambient indicator:** no-op for M3; reserved for M4.
- **Keyboard:** Cmd+1 / Cmd+2 / Cmd+3 jumps focus between Row 1, Workspaces column, Orchestrator. Cmd+Shift+N triggers "+ open another."

## 8. Content Requirements

- **TODAY header:** day name, full date, time (24h). Weather: temp + condition + location. Sourced from existing `scripts/plan_data.py` output in vault.
- **Three priorities:** parsed from `~/obsidian-vault/output/daily-plans/YYYY-MM-DD.md`. Top three under "## Top priorities" or "## Three priorities" or first three under "## Now". Fallback heuristic order.
- **Now line:** active workspace name + queue progress (`N/M` items checked) + last-touched relative time. From `.lair/state.json` of last-used workspace.
- **Workspace rows:** project name (basename of path), last-touched relative time, small lane chip showing workspace's preferred lane if set.
- **Orchestrator empty text:** "Ask about the vault, today's plan, project memory, or what to work on next." Keep.
- **Starter chips:** four chips, max 24 chars label. Existing labels: "Plan today" / "What's overdue" / "Brainstorm Combo Cars" / "Ingest raw/". Dynamic generation deferred.
- **Ambient strip:** comma-separated facts. Numbers render only when > 0; phrases drop when count zero.

No assets, illustrations, or images required. Pure typography + layout.

## 9. Recommended References (for implementation)

- `reference/product.md` — current register
- `reference/layout.md` — asymmetric row rhythm
- `reference/typeset.md` — editorial Row 1 hierarchy
- `reference/clarify.md` — empty-state copy tuning
- `reference/onboard.md` — first-run flow polish

## 10. Decisions Locked

- Asymmetric two-column for Row 2 (38/62), not equal-thirds.
- New Row 1 briefing block replaces the current `TodaysPlanCard` raw `<pre>` markdown rendering.
- Ambient strip auto-hides on zero state.
- Priority click copies; no vault deep-linking (M4).
- No avatar circles, no message bubbles in Orchestrator; `ChatShell` reuse keeps visual vocabulary aligned with the workspace chat.
- Workspace cards become text rows, not card chrome. Existing 3-card-grid pattern dropped. Cards-inside-cards trap avoided.

## Future critique notes

(Empty — Nathan will critique later.)
