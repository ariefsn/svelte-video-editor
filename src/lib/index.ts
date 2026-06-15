// svelte-video-editor — a host-agnostic Svelte 5 video timeline editor.
//
// Browser-only: render under an `{#if browser}` guard in SvelteKit (see README).
// Import the shipped theme once in your app: `import 'svelte-video-editor/app.css'`.

// ---- main components ------------------------------------------------------
export { default as TimelineEditor } from './components/organisms/TimelineEditor.svelte';
export { default as ProjectListView } from './components/organisms/ProjectListView.svelte';

// ---- overridable section components (wrap-a-default pattern) ---------------
export { default as TimelineToolbar } from './components/organisms/TimelineToolbar.svelte';
export { default as AssetBinPanel } from './components/organisms/AssetBinPanel.svelte';
export { default as PreviewStage } from './components/organisms/PreviewStage.svelte';
export { default as TransportBar } from './components/organisms/TransportBar.svelte';
export { default as TimelineTracks } from './components/organisms/TimelineTracks.svelte';
export { default as InspectorPanel } from './components/organisms/InspectorPanel.svelte';
export { default as ShortcutsFooter } from './components/organisms/ShortcutsFooter.svelte';
export { default as ConfirmDialog } from './components/molecules/ConfirmDialog.svelte';

// ---- host contract & store ------------------------------------------------
export {
	setEditorHost,
	useEditorHost,
	type EditorAction,
	type EditorHost,
	type ResolvedAsset,
	type SectionCtx
} from './core/host.js';
export {
	TimelineEditorStore,
	setTimelineEditor,
	useTimelineEditor,
	type TimelineEditorDeps,
	type DragState
} from './core/state.svelte.js';
export type { ConfirmFn, ConfirmOptions } from './core/confirm.svelte.js';
export type { NotifyFn, NotifyKind } from './core/notify.js';

// ---- migration & project helpers ------------------------------------------
export { migrateProject } from './core/migration.js';
export { uid, cn, formatLocalDateTime } from './utils.js';

// ---- clip transitions -----------------------------------------------------
// Pure helper so a host's custom/server renderer can reproduce the editor's
// per-frame visual for a clip's enter/exit animation exactly.
export { clipAnimStyle, ease, type AnimStyle } from './core/animation.js';

// ---- composition background -----------------------------------------------
// Pure helper so a host's custom/server renderer reproduces the project's
// background exactly. `null` → 'transparent'.
export { backgroundCss } from './core/background.js';

// ---- i18n -----------------------------------------------------------------
export {
	defaultMessages,
	resolveMessages,
	type Messages,
	type MessageKey,
	type MessagesOverride
} from './i18n/messages.js';

// ---- domain types & helpers -----------------------------------------------
export {
	createEmptyProject,
	createTrack,
	defaultTextClipStyle,
	defaultTransition,
	defaultProjectBackground,
	BACKGROUND_SOLID_PRESETS,
	BACKGROUND_GRADIENT_PRESETS,
	ANIM_PRESETS,
	EASINGS,
	clipEndF,
	clipHasAudio,
	clipKindForMediaType,
	frameToSec,
	secToFrame,
	isMediaClip,
	isTextClip,
	FPS_OPTIONS,
	FPS_DEFAULT,
	MARKER_COLORS,
	TRACK_HEIGHT_MIN,
	TRACK_HEIGHT_MAX,
	TRACK_HEIGHT_DEFAULT,
	ZOOM_MIN,
	ZOOM_MAX,
	ZOOM_DEFAULT,
	CLIP_MIN_FRAMES,
	type TimelineProject,
	type ProjectBackground,
	type TimelineClip,
	type MediaClip,
	type MediaClipKind,
	type TextClip,
	type TextClipStyle,
	type AnimPreset,
	type Easing,
	type ClipTransition,
	type ClipAnimation,
	type TimelineTrack,
	type TimelineMarker,
	type TimelineRange,
	type TimelineAspectRatio,
	type TimelineFps,
	type BinItem,
	type MediaType,
	type StockAttribution
} from './types/timeline.js';
