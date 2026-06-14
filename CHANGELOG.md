# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

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
