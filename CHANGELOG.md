# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [1.1.0] - 2026-06-15

### Changed (breaking)

- **i18n message keys renamed `snake_case` → `camelCase`.** Every key in the `Messages` /
  `MessagesOverride` catalog is now camelCase (e.g. `add_text` → `addText`,
  `background_opacity` → `backgroundOpacity`, `op_blocked_locked` → `opBlockedLocked`). Hosts
  that pass a `messages` override must rename their keys to match. The exported type names
  (`Messages`, `MessageKey`, `MessagesOverride`) are unchanged.

### Added

- **Customizable preview background** — the composition background (previously always black) can
  now be a **solid color** or a **linear gradient**, picked from a swatch button in the toolbar
  (and the bottom zoom bar on mobile). Each category has a full-width Solid/Gradient tab, 20
  presets, and custom pickers (gradient = two stops + angle), plus a transparent option. Stored on
  the project as `ProjectBackground` (`background` field; `null` = transparent) and exposed via the
  pure `backgroundCss()` helper so hosts render the same background on export. Older projects
  default to solid black, preserving the previous look. New exports: `ProjectBackground`,
  `defaultProjectBackground`, `BACKGROUND_SOLID_PRESETS`, `BACKGROUND_GRADIENT_PRESETS`,
  `backgroundCss`.
- **Text clip border** — per-text-clip border with a toggle, color picker, and width
  (`TextClipStyle.borderColor` / `borderWidthPct`), mirroring the existing background control.
- **Customizable text shadow** — when a text clip's shadow is enabled, its color, blur, and
  offset are now editable (`TextClipStyle.shadowColor` / `shadowBlurPct` / `shadowOffsetPct`)
  instead of a fixed black drop shadow. Older projects fall back to the previous look.
- **Animation enter/exit tabs** — the inspector's Animation section now switches between
  "On enter" and "On exit" with a tab instead of stacking both control sets.

### Changed

- **Select dropdowns** now render a custom chevron (`appearance-none` + padding) so the arrow has
  comfortable spacing from the edge instead of sitting flush against it (affects the frame-rate,
  easing, and preset dropdowns).
- **Popover** gained an opt-in `fixed` mode that positions the panel in a viewport-clamped fixed
  layer, so popovers can't be clipped by an ancestor's `overflow` (used by the background picker
  inside the toolbar / bottom bar).
- **Wider zoom-out range** — the timeline minimum zoom (`ZOOM_MIN`) drops from 10 to 5 px/sec,
  letting long projects zoom out further.
- **Group is now a toggle** — `groupSelection()` (⌘G) ungroups a selection that is already a
  single group instead of reassigning a new group id (which only recolored it). Ungroup also
  stays available explicitly via ⌘⇧G.

### Fixed

- Older projects now backfill newly-added text style fields during migration, so the inspector's
  Background/Border toggles always match what's rendered (previously an absent field could show a
  toggle in the wrong state).

[1.1.0]: https://github.com/ariefsn/svelte-video-editor/releases/tag/v1.1.0

## [1.0.0] - 2026-06-14

Initial public release of `@ariefsn/svelte-video-editor` — a host-agnostic, Svelte 5
video timeline editor with zero design-system dependency.

### Added

- **Timeline editing** — clips, tracks, and trimming with CapCut/Premiere-style edits:
  ripple, roll, and slip. Includes clip grouping, linked audio, markers, in/out range
  selection, and full undo/redo history.
- **Clip transitions** — per-clip enter/exit animations (`fade`, `slide-left`, `slide-right`,
  `slide-up`, `slide-down`, `scale`, `zoom`, `bounce`, `pop`, `spin`, `blur`, `wipe`, `flip`)
  with frame-based duration and easing (`linear`, `ease-in`, `ease-out`, `ease-in-out`),
  scrubbed live by the playhead from the inspector's Animation section. Exposes the
  `ClipAnimation`, `ClipTransition`, `AnimPreset`, and `Easing` types plus `ANIM_PRESETS`,
  `EASINGS`, `defaultTransition`, and the pure `clipAnimStyle(clip, playheadSec, fps)` helper
  so hosts render transitions frame-for-frame on export. Each clip's `animation` round-trips
  through the project JSON.
- **Real-time DOM preview** — `<video>`/`<audio>`/canvas playback driven by
  `requestAnimationFrame`, fully replaceable with a custom preview renderer
  (Remotion, canvas, WebGL compositor, …).
- **Host-agnostic contract** — all external concerns (asset URLs, thumbnails, export,
  permissions, persistence, notifications, confirmation, i18n) are injected by the host.
  The library owns no storage and persists nothing itself.
- **Responsive & mobile-ready UI** — the media bin and clip inspector collapse into bottom
  sheets, the toolbar folds into an overflow menu, clip options are reachable by touch, and
  keyboard shortcuts are centrally managed.
- **Customization** — replace any editor section via snippets receiving `SectionCtx`;
  Tailwind v4 theming through `--ts-*` CSS variables with built-in light/dark palettes; and
  localization via the i18n message catalog.
- **Atomic-design component library** — atoms / molecules / organisms built with Svelte 5
  runes and strict TypeScript, with zero design-system dependency (no shadcn or bits-ui).
  Public API and theme tokens are exported from `src/lib/index.ts` and the shipped `app.css`.

[1.0.0]: https://github.com/ariefsn/svelte-video-editor/releases/tag/v1.0.0
