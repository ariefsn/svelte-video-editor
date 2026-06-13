// Pure timeline math — no Svelte imports so it stays trivially testable.

/** Width (px) of the sticky track-header column in the timeline. */
export const TRACK_HEADER_W = 160;

/** Pixel distance within which a dragged edge snaps to a candidate. */
export const SNAP_PX = 8;

/** Drag MIME prefix for bin items; suffixed with the item's media type so
 * lanes can accept/reject during dragover (data is unreadable until drop). */
export const BIN_ITEM_MIME_PREFIX = 'application/x-timeline-bin-';

export function timeToPx(t: number, zoom: number): number {
	return t * zoom;
}

export function pxToTime(px: number, zoom: number): number {
	return px / zoom;
}

// Zoom stays px-per-SECOND; frames convert through fps at the boundary.
export function frameToPx(frame: number, fps: number, zoom: number): number {
	return (frame / fps) * zoom;
}

export function pxToFrame(px: number, fps: number, zoom: number): number {
	return Math.round((px / zoom) * fps);
}

/**
 * Snap a time to the nearest candidate within threshold seconds. Returns the
 * original time when nothing is close enough.
 */
export function snap(t: number, candidates: number[], threshold: number): number {
	let best = t;
	let bestDist = threshold;
	for (const c of candidates) {
		const d = Math.abs(c - t);
		if (d < bestDist) {
			best = c;
			bestDist = d;
		}
	}
	return best;
}

/** Format a frame count as HH:MM:SS:FF at the given fps. */
export function formatTimecode(frame: number, fps: number): string {
	const f = Math.max(0, Math.round(frame));
	const totalSeconds = Math.floor(f / fps);
	const ff = f % fps;
	const hh = Math.floor(totalSeconds / 3600);
	const mm = Math.floor((totalSeconds % 3600) / 60);
	const ss = totalSeconds % 60;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

/** Format seconds as a short duration label for clips/bin items (e.g. 12.5s). */
export function formatDuration(t: number): string {
	if (t >= 60) {
		const minutes = Math.floor(t / 60);
		const seconds = Math.round(t - minutes * 60);
		return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ''}`;
	}
	return `${t.toFixed(1)}s`;
}

// Distinct hues for group accents; a group id hashes to a stable palette slot
// so all members of a group share a color and different groups differ.
const GROUP_HUES = [265, 25, 145, 200, 325, 50, 95, 230];

export function groupColor(groupId: string): string {
	let hash = 0;
	for (let i = 0; i < groupId.length; i++) {
		hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0;
	}
	return `hsl(${GROUP_HUES[hash % GROUP_HUES.length]} 85% 62%)`;
}

/**
 * Pick a "nice" ruler tick interval for the current zoom so labels stay
 * readable (~target px apart).
 */
export function rulerInterval(zoom: number, targetPx = 80): number {
	const raw = targetPx / zoom;
	const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
	for (const s of steps) {
		if (s >= raw) return s;
	}
	return steps[steps.length - 1];
}
