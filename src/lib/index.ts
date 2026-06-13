// svelte-timeline-studio — a host-agnostic Svelte 5 video timeline editor.
//
// Browser-only: render under an `{#if browser}` guard in SvelteKit (see README).
// Import the shipped theme once in your app: `import 'svelte-timeline-studio/app.css'`.

// ---- main components ------------------------------------------------------
export { default as TimelineEditor } from './components/atomic/organisms/TimelineEditor.svelte';
export { default as ProjectListView } from './components/atomic/organisms/ProjectListView.svelte';

// ---- overridable section components (wrap-a-default pattern) ---------------
export { default as TimelineToolbar } from './components/atomic/organisms/TimelineToolbar.svelte';
export { default as AssetBinPanel } from './components/atomic/organisms/AssetBinPanel.svelte';
export { default as PreviewStage } from './components/atomic/organisms/PreviewStage.svelte';
export { default as TransportBar } from './components/atomic/organisms/TransportBar.svelte';
export { default as TimelineTracks } from './components/atomic/organisms/TimelineTracks.svelte';
export { default as InspectorPanel } from './components/atomic/organisms/InspectorPanel.svelte';
export { default as ShortcutsFooter } from './components/atomic/organisms/ShortcutsFooter.svelte';
export { default as ConfirmDialog } from './components/atomic/organisms/ConfirmDialog.svelte';

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
	type TimelineClip,
	type MediaClip,
	type MediaClipKind,
	type TextClip,
	type TextClipStyle,
	type TimelineTrack,
	type TimelineMarker,
	type TimelineRange,
	type TimelineAspectRatio,
	type TimelineFps,
	type BinItem,
	type MediaType,
	type StockAttribution
} from './types/timeline.js';
