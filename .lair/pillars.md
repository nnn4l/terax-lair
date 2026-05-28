# Design Pillars

These do not drift. Edit rarely.

## 1. Personal, not product
We're building for one user. No multi-user, auth, telemetry, sharing, marketplace.
*Violation looks like:* features that only make sense at scale; "what if users want X."

## 2. Compact over verbose
Agent responses collapse to summary cards by default. Raw output stays one click away.
*Violation looks like:* full CLI dumps as primary content; multi-paragraph default renders.

## 3. Both agents visible simultaneously
Claude + Codex usable in the same window without screen-splitting fatigue.
*Violation looks like:* side-by-side panels that take half the screen each.

## 4. Spec to queue to execution
Work flows from spec into a hierarchical queue. Chat is the execution log, not the task list.
*Violation looks like:* ad-hoc work bypassing the queue; queue treated as decoration.

## 5. Vault for strategy, repo for tactics
Long-term goals and canon live in obsidian-vault. Concrete specs and queue live in the repo.
*Violation looks like:* design canon committed to the game repo; tactical TODOs in the vault.

## 6. Inherit Terax polish
Lair components match Terax's design system (shadcn, AI Elements, theme tokens). No raw select elements, no untokened colors, no hand-rolled chrome.
*Violation looks like:* native form elements, hardcoded hex, custom buttons that don't use shadcn primitives.

## 7. Caveman narration
Haiku narrations and summary cards drop articles and filler. Short fragments. Code stays normal.
*Violation looks like:* "Great! I'll help you with that..." style padding in agent surfaces.
