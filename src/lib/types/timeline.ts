import { uid } from '../utils.js';

// Timeline editor domain model — schema v2 (frame-based).
//
// All clip times are INTEGER FRAME COUNTS at the project's fps; field names
// carry the F suffix so the unit is unambiguous. The playhead alone lives in
// float seconds (smooth rAF/media sync) and is quantized to frames at every
// edit boundary. Everything here is plain JSON — the same shape doubles as
// the undo snapshot, a stored record, and (later) the payload a server-side
// compositor (ffmpeg/Remotion) consumes.
//
// v1 (seconds-based, kinded tracks, overlaps allowed) is upgraded by
// `migrateProject` in core/migration.ts.

// ---- media types (inlined; previously shared via $lib/types/media) --------

export type MediaType = 'image' | 'video' | 'gif' | 'audio';

/** Attribution for stock media (Unsplash/Pexels). Carried alongside the media
 * item so a host can append a credit line at publish/render time. */
export type StockAttribution = {
	name: string;
	source: 'unsplash' | 'pexels';
	kind: 'photo' | 'video';
	authorUrl?: string;
	mediaPageUrl?: string;
};

// ---- timeline domain ------------------------------------------------------

export type TimelineAspectRatio = '16:9' | '9:16' | '1:1';

export const FPS_OPTIONS = [24, 25, 30, 50, 60] as const;
export type TimelineFps = (typeof FPS_OPTIONS)[number];
export const FPS_DEFAULT: TimelineFps = 30;

// Tracks are generic lanes — any track holds any clip kind.
export type TimelineTrack = {
	id: string;
	name: string;
	muted: boolean;
	solo: boolean;
	hidden: boolean;
	locked: boolean;
	height: number;
};

export const TRACK_HEIGHT_MIN = 32;
export const TRACK_HEIGHT_MAX = 120;
export const TRACK_HEIGHT_DEFAULT = 56;

export const ZOOM_MIN = 10;
export const ZOOM_MAX = 400;
export const ZOOM_DEFAULT = 50;

/** Minimum clip length, in frames. */
export const CLIP_MIN_FRAMES = 1;

// ---- clip enter/exit transitions -----------------------------------------

export type AnimPreset =
	| 'fade'
	| 'slide-left'
	| 'slide-right'
	| 'slide-up'
	| 'slide-down'
	| 'scale' // grow 0.85 → 1
	| 'zoom' // punch 1.15 → 1
	| 'bounce'
	| 'pop' // overshoot 0.6 → 1.1 → 1
	| 'spin' // rotate + fade
	| 'blur' // blur(8px) → 0 + fade
	| 'wipe' // clip-path reveal
	| 'flip'; // rotateY 90° → 0

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export const ANIM_PRESETS: readonly AnimPreset[] = [
	'fade',
	'slide-left',
	'slide-right',
	'slide-up',
	'slide-down',
	'scale',
	'zoom',
	'bounce',
	'pop',
	'spin',
	'blur',
	'wipe',
	'flip'
];

export const EASINGS: readonly Easing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

/** One side of a clip transition. */
export type ClipTransition = {
	preset: AnimPreset;
	/** Animation length in frames; clamped to the clip's duration. */
	durationF: number;
	easing: Easing;
};

/** Optional enter/exit transitions on a clip. Either side may be absent. */
export type ClipAnimation = { in?: ClipTransition; out?: ClipTransition };

/** Sensible default when a transition side is first enabled (~0.5s @30fps). */
export function defaultTransition(): ClipTransition {
	return { preset: 'fade', durationF: 15, easing: 'ease-out' };
}

type ClipBase = {
	id: string;
	trackId: string;
	startF: number;
	durationF: number;
	// Clips sharing a groupId form one group: selection, drag, delete and
	// lock act on the whole group atomically. Groups can span tracks.
	groupId: string | null;
	locked: boolean;
	name: string;
	/** Optional enter/exit transitions, applied in the preview/compositor. */
	animation?: ClipAnimation;
};

export type MediaClipKind = 'video' | 'image' | 'audio';

export type MediaClip = ClipBase & {
	kind: MediaClipKind;
	// Remote asset URL only — blob: URLs must never enter the serialized
	// project (they die on refresh). When assetId is set, hosts may resolve
	// a fresh URL via resolveAsset; url is the fallback.
	url: string;
	assetId?: string;
	trimInF: number;
	// Probed source length in frames; null for images (freely stretchable).
	// Invariant for media: trimInF + durationF <= sourceDurationF.
	sourceDurationF: number | null;
	volume: number;
	/** Linear gain ramps, in frames from the clip edges. */
	fadeInF: number;
	fadeOutF: number;
	// Detached/linked audio: a video clip and its detached audio clip share a
	// linkId; moving/trimming one propagates to the other until unlinked.
	linkId: string | null;
	// True once a video clip's embedded audio has been detached — the video
	// element then plays permanently muted.
	audioDetached?: boolean;
	attribution?: StockAttribution;
};

export type TextClipStyle = {
	fontFamily: string;
	// % of stage height — maps 1:1 to composition-relative units server-side.
	fontSizePct: number;
	fontWeight: 400 | 600 | 700;
	color: string;
	backgroundColor: string | null;
	backgroundOpacity: number;
	align: 'left' | 'center' | 'right';
	// Anchor center, % of stage width/height.
	xPct: number;
	yPct: number;
	paddingPct: number;
	borderRadiusPct: number;
	shadow: boolean;
};

export type TextClip = ClipBase & {
	kind: 'text';
	text: string;
	style: TextClipStyle;
};

export type TimelineClip = MediaClip | TextClip;

export const MARKER_COLORS = [
	'#ef4444',
	'#f59e0b',
	'#22c55e',
	'#06b6d4',
	'#8b5cf6',
	'#ec4899'
] as const;

export type TimelineMarker = {
	id: string;
	frame: number;
	color: string;
	label: string;
};

export type TimelineRange = {
	inFrame: number;
	outFrame: number;
};

export type BinItem = {
	id: string;
	url: string;
	mediaType: MediaType;
	name: string;
	// Source-intrinsic length in SECONDS (fps-independent); converted to
	// frames when a clip is created from this item.
	duration: number | null;
	assetId?: string;
	attribution?: StockAttribution;
};

export type TimelineProject = {
	schemaVersion: 2;
	id: string;
	/** Optional host-owned grouping key (workspace/user/etc.); the editor
	 * never reads it. Kept for hosts that want to scope stored projects. */
	workspaceId: string;
	name: string;
	aspectRatio: TimelineAspectRatio;
	fps: TimelineFps;
	// Array order = z-order; index 0 renders at the bottom.
	tracks: TimelineTrack[];
	clips: TimelineClip[];
	markers: TimelineMarker[];
	range: TimelineRange | null;
	bin: BinItem[];
	zoom: number;
	createdAt: number;
	updatedAt: number;
};

// ---- helpers -------------------------------------------------------------

export function isMediaClip(clip: TimelineClip): clip is MediaClip {
	return clip.kind !== 'text';
}

export function isTextClip(clip: TimelineClip): clip is TextClip {
	return clip.kind === 'text';
}

export function clipEndF(clip: TimelineClip): number {
	return clip.startF + clip.durationF;
}

export function frameToSec(frame: number, fps: number): number {
	return frame / fps;
}

export function secToFrame(seconds: number, fps: number): number {
	return Math.round(seconds * fps);
}

/** Whether a clip produces audio in the preview/render. */
export function clipHasAudio(clip: TimelineClip): clip is MediaClip {
	if (!isMediaClip(clip)) return false;
	if (clip.kind === 'audio') return true;
	return clip.kind === 'video' && !clip.audioDetached;
}

// Gif is treated as an image source in the preview.
export function clipKindForMediaType(mediaType: MediaType): MediaClipKind {
	if (mediaType === 'video') return 'video';
	if (mediaType === 'audio') return 'audio';
	return 'image';
}

export function defaultTextClipStyle(): TextClipStyle {
	return {
		fontFamily: 'Inter, sans-serif',
		fontSizePct: 6,
		fontWeight: 600,
		color: '#ffffff',
		backgroundColor: null,
		backgroundOpacity: 0.6,
		align: 'center',
		xPct: 50,
		yPct: 80,
		paddingPct: 1.5,
		borderRadiusPct: 1,
		shadow: true
	};
}

export function createTrack(name: string): TimelineTrack {
	return {
		id: uid(),
		name,
		muted: false,
		solo: false,
		hidden: false,
		locked: false,
		height: TRACK_HEIGHT_DEFAULT
	};
}

export function createEmptyProject(
	name: string,
	options: { fps?: TimelineFps; workspaceId?: string } = {}
): TimelineProject {
	const now = Date.now();
	return {
		schemaVersion: 2,
		id: uid(),
		workspaceId: options.workspaceId ?? '',
		name,
		aspectRatio: '16:9',
		fps: options.fps ?? FPS_DEFAULT,
		tracks: [createTrack('Track 1'), createTrack('Track 2'), createTrack('Track 3')],
		clips: [],
		markers: [],
		range: null,
		bin: [],
		zoom: ZOOM_DEFAULT,
		createdAt: now,
		updatedAt: now
	};
}
