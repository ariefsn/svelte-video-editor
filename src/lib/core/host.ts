import { getContext, setContext } from 'svelte';
import type { TimelineProject, TimelineRange } from '../types/timeline.js';
import type { TimelineEditorStore } from './state.svelte.js';

// Host-agnostic contract: everything external (asset URLs, thumbnails,
// waveforms, export, gating) is supplied by the embedding host via these
// callbacks. The editor never fetches, never builds storage URLs itself.

export type ResolvedAsset = {
	url: string;
	durationFrames?: number;
	hasAudio: boolean;
	width?: number;
	height?: number;
};

export type EditorAction = 'export' | 'magnetic-main-track';

export type EditorHost = {
	/** Resolve a clip's media URL (+metadata). Receives assetId when the clip
	 * has one, otherwise the stored URL (documented contract extension). */
	resolveAsset: (assetId: string) => Promise<ResolvedAsset>;
	/** Frame preview for hover-scrub (and future filmstrips). The frame number
	 * is expressed at a fixed 30fps reference timebase (seconds = frame / 30)
	 * so hosts don't need to know the project fps. */
	generateThumbnail: (assetId: string, frame: number) => Promise<string>;
	/** Optional future waveforms — accepted now so clip renderers can plug in. */
	generateWaveform?: (assetId: string) => Promise<Float32Array>;
	/** Host owns rendering. */
	onExport: (project: TimelineProject, range?: TimelineRange) => void;
	/** Tier/permission gating decided by the host; the editor only asks. */
	can: (action: EditorAction) => boolean;
};

/** Arguments handed to host-supplied section-override snippets. Snippets
 * can't call getContext, so the editor passes its context explicitly.
 * `onBack` is undefined when the host didn't supply an onBack handler — the
 * built-in sections hide their back affordance in that case. */
export type SectionCtx = {
	editor: TimelineEditorStore;
	host: EditorHost;
	onBack?: () => void;
	onRequestDelete: () => void;
};

const KEY = Symbol.for('svelte-timeline-studio-host');

export function setEditorHost(host: EditorHost): EditorHost {
	return setContext(KEY, host);
}

export function useEditorHost(): EditorHost {
	return getContext<EditorHost>(KEY);
}
