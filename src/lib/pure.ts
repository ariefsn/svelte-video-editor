// svelte-video-editor/pure — the framework-free surface of the library.
//
// Exposed as the `./pure` subpath (plain `default` condition, no `svelte`) so a
// non-Svelte host — e.g. a Remotion (React) composition or a server renderer —
// can reproduce the editor's per-frame visual exactly. Re-exports only; nothing
// reachable from here may import a Svelte component.

// ---- clip transitions -----------------------------------------------------
export { clipAnimStyle, ease, type AnimStyle } from './core/animation.js';

// ---- composition background -----------------------------------------------
export { backgroundCss } from './core/background.js';

// ---- composition rules ----------------------------------------------------
// What is visible/audible at time t and how it looks — the same functions the
// editor's own preview uses.
export {
	projectDurationF,
	isClipActive,
	clipSourceSec,
	layeredClips,
	visibleClipsAt,
	aspectRatioValue,
	fitStage,
	compositionSize,
	trackAudible,
	clipAudible,
	clipGain,
	hexToRgba,
	mediaClipCss,
	textClipCss,
	toCssText,
	type CssProperties
} from './core/render.js';

// ---- migration & ids ------------------------------------------------------
// Normalize a stored/older project before rendering it.
export { migrateProject } from './core/migration.js';
export { uid } from './utils.js';

// ---- domain types & helpers -----------------------------------------------
export {
	createEmptyProject,
	createTrack,
	defaultTextClipStyle,
	defaultTransition,
	defaultProjectBackground,
	clipKindForMediaType,
	ANIM_PRESETS,
	EASINGS,
	FPS_OPTIONS,
	FPS_DEFAULT,
	MARKER_COLORS,
	BACKGROUND_SOLID_PRESETS,
	BACKGROUND_GRADIENT_PRESETS,
	frameToSec,
	secToFrame,
	clipEndF,
	isMediaClip,
	isTextClip,
	clipHasAudio,
	type TimelineProject,
	type TimelineTrack,
	type TimelineClip,
	type ClipBase,
	type MediaClip,
	type MediaClipKind,
	type MediaType,
	type StockAttribution,
	type TextClip,
	type TextClipStyle,
	type ProjectBackground,
	type ClipAnimation,
	type ClipTransition,
	type AnimPreset,
	type Easing,
	type TimelineMarker,
	type TimelineRange,
	type BinItem,
	type TimelineAspectRatio,
	type TimelineFps
} from './types/timeline.js';
