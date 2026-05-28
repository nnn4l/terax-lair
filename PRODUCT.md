# PRODUCT.md

## Product

**Lair** is a personal desktop workshop for driving Claude Code, Codex, and (soon) DeepSeek CLI agents from a single window. Forked from Terax AI; adds card-based summary chat, hierarchical task queue, multi-agent dispatch, pillar-anchored prompts, and a dashboard for cross-project orientation.

## Register

product

## Users

One user (Nathan): high-school junior, game-developer-in-training, builds Cocos Creator and Unity projects, writes design specs in Obsidian, runs Claude Code + Codex daily, will run DeepSeek via UniClaudeProxy on the same machine. Sits at a desk. Has ADHD-adjacent attention patterns: struggles with wall-of-text; needs compact, scannable surfaces; needs visible "what's happening now" anchoring or loses thread.

Not for: teams, multi-user, anyone other than Nathan. No telemetry, no auth, no marketplace.

## Product purpose

Replace Nathan's current workflow (separate terminals for each CLI, dropdown-driven chat picking, vault-and-repo bouncing) with one focused workshop. Optimize for:

- **Scannability** over verbosity. Cards collapse to summary; raw output stays one click away.
- **Both agents visible simultaneously** without screen-splitting fatigue.
- **Spec → queue → execution** workflow. Specs in repo `docs/` get compressed into a hierarchical queue; autopilot walks it.
- **Vault for strategy, repo for tactics.** Long-term thinking lives in Obsidian; concrete specs and queues live in code repos.
- **Design pillars as anchors** auto-injected into every system prompt so agents stay aligned even when Nathan doesn't actively police them.

## Strategic principles

1. **Personal, not product.** Features only exist if they help one user. No "what if scale."
2. **Compact over verbose.** Every surface is scannable in 2 seconds; depth on demand.
3. **Inherit Terax polish.** shadcn/ui (radix-luma style, mist base), Tailwind v4 with `@theme` tokens, Vercel AI Elements, Hugeicons. No raw form elements, no untokened colors, no hand-rolled chrome.
4. **Caveman narration.** Status lines drop articles, use fragments. Code stays normal.
5. **Phase + pillars + queue drive context.** Agents always know what phase, which pillars apply, and what task they're executing. No manual context-paste.

## Tone

Tight. Technical. Honest. No filler. No "Great! I'll help you with that." Status lines read like dev log entries, not assistant pleasantries.

## Anti-references

- **Don't:** look like a SaaS dashboard (no big-number hero metrics, no gradient-text headlines, no identical-card grids).
- **Don't:** look like a consumer chat app (no avatar circles, no message bubbles with timestamp lines, no emoji reactions).
- **Don't:** look like a code editor extension panel (no VSCode-style chrome cribbing).
- **Don't:** look generic-AI (no "ai-generated" feel — every component must feel deliberate).
- **Don't:** sprawl. Lair is a single-window app; no second windows except settings.

## Reference points (positive)

- **Linear** — task list visual rhythm, command palette feel, status chip vocabulary.
- **Raycast** — keyboard-first interactions, dense but legible information density.
- **Terax AI's existing UI** — the foundation Lair extends; visual quality bar.
- **Cursor's diff overlay** — diff-accept-reject pattern (already in Terax).
- **Cocos Creator's project hub** — clean grid of recent projects with metadata-rich cards.

## What Lair is NOT

- Not a full IDE (Terax inherits editor + file tree + terminal + git; Lair adds workflow on top).
- Not a brainstorming tool (brainstorming happens in Obsidian + chat sessions outside Lair).
- Not a planning tool (Plan phase removed; planning is a vault activity).
- Not a marketing surface (no landing page, no docs site, no demo videos; Lair only ships locally).
