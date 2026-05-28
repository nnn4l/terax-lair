# DESIGN.md

## Foundation

Lair inherits Terax AI's design foundation. Do not reinvent primitives.

- **Components:** shadcn/ui, style `radix-luma`, base `mist`. Primitives in `src/components/ui/`. Re-run `pnpm dlx shadcn add` to upgrade — never hand-edit.
- **AI Elements:** Vercel AI Elements in `src/components/ai-elements/`. Used inside Lair cards (`MessageResponse`). Compose wrappers in `src/lair/components/`.
- **Icons:** Hugeicons (`@hugeicons/react` + `@hugeicons/core-free-icons`). One set; never mix.
- **Styling:** Tailwind v4 with `@theme` config in `src/App.css`. Use `cn()` from `@/lib/utils`. Always semantic tokens (`bg-card`, `text-foreground`, `border-border`), never raw hex or color names.
- **Layout:** `react-resizable-panels` for split surfaces. `motion` (Framer Motion successor) for animation.

## Color strategy

**Restrained.** Tinted neutrals + a single accent (`primary` token) used for actions, current selection, and state indicators.

OKLCH throughout. Neutrals tinted toward the brand hue (slight cool blue). Never `#000` / `#fff`.

State vocabulary (use exactly these tokens):

- `bg-background` — outer shell
- `bg-card` — content surface
- `bg-muted` — secondary surface (sidebars, dropdowns, chips)
- `border-border` — default borders
- `text-foreground` — primary text
- `text-muted-foreground` — secondary text
- `bg-primary` / `text-primary-foreground` — primary action
- `bg-destructive` / `text-destructive-foreground` — destructive action / error
- `bg-amber-500` / `text-amber-500` — warning (used for stale flags and pending gates)

Per-agent accents on cards:

- Claude lane: `border-orange-500/70`
- Codex lane: `border-violet-500/70`
- DeepSeek-Pro lane: `border-cyan-500/70`
- DeepSeek-Flash lane: `border-teal-500/70`

Use accents on left/full borders never as solo side-stripes. Card borders are full-perimeter at `/40`–`/70` opacity.

## Theme

Dark by default, locked. Scene sentence:

*"Nathan working at his desk after dinner, monitor at eye level, ambient light from one warm bulb, deep into a coding session that started before sunset and will end past midnight."*

This forces dark. Never offer a light variant.

Theme presets shipped via Terax (terax-default, nord, tokyo-night, catppuccin, claude, gruvbox, sage, rose-pine). Lair adopts whatever is active; never overrides at component level.

## Typography

- **Font:** Inter (system fallback stack). One family across the entire surface. No display/body pairing.
- **Scale:** fixed rem-based. Ratio ~1.15 between common sizes. Lair's existing scale:
  - `text-[10px]` — chips, status badges, very compact metadata
  - `text-[11px]` — secondary metadata, footer hints
  - `text-[12px]` — body, cards, inputs (default)
  - `text-[13px]` — chat composer, prominent body
  - `text-[14px]` — section titles, dashboard column heads
  - Headings use weight + size contrast, not display fonts.
- **Letter-spacing:** `tracking-tight` on headlines and labels; default on body.
- **Weight:** `font-semibold` (600) on titles and labels; `font-medium` (500) on actionable items; default (400) on body.

## Spacing rhythm

- Tight inside cards: `px-3 py-2` typical
- Generous between groups: `gap-3` to `gap-6`
- Side panels: `p-3` to `p-4`
- Dashboard grid gaps: `gap-3`

Vary spacing for rhythm. Same padding everywhere = monotony. Cards inside cards = always wrong.

## Elevation

Layered opacity, not box-shadows. Light shadow (`shadow-sm`) on raised surfaces; never `shadow-lg` or larger. Translucent overlays use `bg-black/70 backdrop-blur-sm` for modals.

## Components — current vocabulary

- **Card** (agent run): full-perimeter border at `/70` lane-color opacity + `bg-card/70` + `shadow-sm` + `rounded-lg` + `px-2.5 py-2`.
- **Chip** (status, model, usage): `rounded bg-muted/50 px-1.5 py-0.5 text-[10.5px] text-muted-foreground`.
- **Button (primary):** `rounded-md bg-primary text-primary-foreground` + `px-2.5 py-1 text-[11px] font-medium`.
- **Button (ghost):** muted background on hover only; no border by default.
- **Dropdowns / selects:** shadcn `Select` (recently migrated from native `<select>`).
- **System cards (StaleSpec, ApprovalGate, PillarCheck):** `SystemCard` wrapper with tone (info/warning/success/danger), icon + title + body + actions.

## Motion

- Transitions: 150–250ms, ease-out (`cubic-bezier(0.16, 1, 0.3, 1)` / quart-out).
- Never animate layout properties (`width`, `height`, `top`). Use `transform` + `opacity`.
- Card streaming: pulse dot indicator only. No spinners over content.
- Modal open: fade backdrop + slide-up content (≤200ms).
- Meter chip cycle: 4s per lane, fade transition (300ms).

## Accessibility

- Focus rings via shadcn defaults; never remove.
- Keyboard shortcuts use `metaKey || ctrlKey` (cross-platform Cmd/Ctrl).
- Color is never the sole signal (status chips have text labels too).

## Lair-specific patterns

- **Agent identity = lane.** Cards carry a lane chip + model chip + effort chip. Never an "agent icon."
- **Compact summary first.** Streaming state shows progress framing + collapsed raw. Done state shows summary + outcome + expand toggle.
- **System cards distinct from agent cards.** Different tone, different icon, never confusable.
- **Pinned current task header.** When queue active, "Now: <label>" sits above chat scroll.
- **Pillars invisible to user but visible to agents.** Auto-injected; user sees them only in `.lair/pillars.md`.

## Bans (Lair-specific, on top of impeccable shared bans)

- **Don't:** add new icon libraries beyond Hugeicons.
- **Don't:** hand-roll dropdowns when shadcn `Select` exists.
- **Don't:** use raw `#hex` colors; only semantic tokens or OKLCH at the token level.
- **Don't:** wrap a card inside a card inside a card. One container layer max.
- **Don't:** add modals when a popover or inline surface would do.
- **Don't:** use em dashes anywhere.
- **Don't:** use emoji as UI affordances (Hugeicons only). Emoji allowed in agent narration if it travels with the agent's voice.

## Reference projects

- Look at **Terax's existing chat composer + status bar** before designing a new control.
- Look at **Linear's task rows** before designing a new list item.
- Look at **Cursor's diff overlay** before designing a new code review surface.
