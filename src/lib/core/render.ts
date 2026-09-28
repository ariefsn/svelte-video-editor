// Composition rules — pure, framework-free, and the single source of truth for
// WHAT is on screen/audible at a given time and HOW it looks. The editor's own
// preview (PreviewStage, StageMedia, TextOverlayView, PlaybackEngine) uses these,
// and any other player (Remotion, canvas, WebGL, ffmpeg graph builder) can call
// the same functions to reproduce the preview exactly. Times are float seconds
// on the project timeline, matching `clipAnimStyle(clip, playheadSec, fps)`.

import type { AnimStyle } from './animation.js';
import {
	clipEndF,
	clipHasAudio,
	frameToSec,
	type MediaClip,
	type TextClipStyle,
	type TimelineAspectRatio,
	type TimelineClip,
	type TimelineProject,
	type TimelineTrack
} from '../types/timeline.js';

/** Inline-style object with camelCase CSS property names — usable as a React
 * `style` prop, with `Object.assign(el.style, …)`, or via `toCssText`. */
export type CssProperties = Record<string, string | number>;

// ---- timing ---------------------------------------------------------------

/** Project length in frames: the end of the last clip (0 when empty). */
export function projectDurationF(project: TimelineProject): number {
	return project.clips.reduce((max, clip) => Math.max(max, clipEndF(clip)), 0);
}

/** Whether the clip is on screen/audible at `t` seconds: `[start, end)`. */
export function isClipActive(clip: TimelineClip, t: number, fps: number): boolean {
	return t >= frameToSec(clip.startF, fps) && t < frameToSec(clipEndF(clip), fps);
}

/** Position inside the clip's SOURCE media (seconds) for timeline time `t`. */
export function clipSourceSec(clip: MediaClip, t: number, fps: number): number {
	return t - frameToSec(clip.startF, fps) + frameToSec(clip.trimInF, fps);
}

// ---- layering -------------------------------------------------------------

/** All clips on visible tracks, bottom → top. Track array order is z-order
 * (index 0 = bottom); `zIndex` is that track index. Hidden tracks are skipped. */
export function layeredClips(project: TimelineProject): { clip: TimelineClip; zIndex: number }[] {
	const result: { clip: TimelineClip; zIndex: number }[] = [];
	project.tracks.forEach((track, index) => {
		if (track.hidden) return;
		for (const clip of project.clips) {
			if (clip.trackId === track.id) result.push({ clip, zIndex: index });
		}
	});
	return result;
}

/** The clips visible at `t` seconds, bottom → top. */
export function visibleClipsAt(
	project: TimelineProject,
	t: number
): { clip: TimelineClip; zIndex: number }[] {
	return layeredClips(project).filter((e) => isClipActive(e.clip, t, project.fps));
}

// ---- stage size -----------------------------------------------------------

/** Width / height, e.g. `'16:9'` → 1.777… */
export function aspectRatioValue(aspectRatio: TimelineAspectRatio): number {
	const [w, h] = aspectRatio.split(':').map(Number);
	return w / h;
}

/** Largest stage that fits `containerWidth × containerHeight` at the aspect ratio. */
export function fitStage(
	aspectRatio: TimelineAspectRatio,
	containerWidth: number,
	containerHeight: number
): { width: number; height: number } {
	const aspect = aspectRatioValue(aspectRatio);
	const width = Math.max(0, Math.min(containerWidth, containerHeight * aspect));
	return { width, height: aspect > 0 ? width / aspect : 0 };
}

/** Output pixel size whose SHORT side is `shortSide` (16:9 → 1920×1080 by default). */
export function compositionSize(
	aspectRatio: TimelineAspectRatio,
	shortSide = 1080
): { width: number; height: number } {
	const aspect = aspectRatioValue(aspectRatio);
	return aspect >= 1
		? { width: Math.round(shortSide * aspect), height: shortSide }
		: { width: shortSide, height: Math.round(shortSide / aspect) };
}

// ---- audio ----------------------------------------------------------------

/** Track audibility: any solo → only soloed tracks play; mute always silences
 * its own track, even when soloed. */
export function trackAudible(project: TimelineProject, track: TimelineTrack | undefined): boolean {
	if (!track) return false;
	if (track.muted) return false;
	const anySolo = project.tracks.some((t) => t.solo);
	return anySolo ? track.solo : true;
}

/** Whether the clip should be heard at all (track mute/solo, detached audio,
 * zero volume). Timing is separate — see `isClipActive`. */
export function clipAudible(project: TimelineProject, clip: TimelineClip): boolean {
	if (!clipHasAudio(clip) || clip.volume <= 0) return false;
	return trackAudible(
		project,
		project.tracks.find((tr) => tr.id === clip.trackId)
	);
}

/** Output gain in [0,1] at `t` seconds: clip volume × linear fade-in/out ramps
 * relative to the clip edges. Does not apply mute/solo — see `clipAudible`. */
export function clipGain(clip: MediaClip, t: number, fps: number): number {
	const startSec = frameToSec(clip.startF, fps);
	const endSec = frameToSec(clipEndF(clip), fps);
	let gain = clip.volume;
	if (clip.fadeInF > 0) {
		gain *= Math.min(1, Math.max(0, (t - startSec) / frameToSec(clip.fadeInF, fps)));
	}
	if (clip.fadeOutF > 0) {
		gain *= Math.min(1, Math.max(0, (endSec - t) / frameToSec(clip.fadeOutF, fps)));
	}
	return Math.min(1, Math.max(0, gain));
}

// ---- visual styles --------------------------------------------------------

/** `#rrggbb` + opacity → `rgba(r, g, b, a)`. */
export function hexToRgba(hex: string, opacity: number): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Full-bleed media layer (video/image): covers the stage, plus the clip's
 * enter/exit animation when `anim` is given. */
export function mediaClipCss(anim?: AnimStyle): CssProperties {
	return {
		position: 'absolute',
		inset: 0,
		width: '100%',
		height: '100%',
		objectFit: 'cover',
		...(anim ?? {})
	};
}

/**
 * A text clip's box, positioned inside a stage of `stageHeight` px (the stage
 * itself must be `position: relative`). All sizes are % of stage height, so the
 * result scales to any output resolution. Pass the clip's `clipAnimStyle` as
 * `anim` to include its enter/exit animation.
 */
export function textClipCss(
	style: TextClipStyle,
	stageHeight: number,
	anim?: AnimStyle
): CssProperties {
	const px = (pct: number) => `${(stageHeight * pct) / 100}px`;
	const css: CssProperties = {
		position: 'absolute',
		maxWidth: '100%',
		whiteSpace: 'pre-wrap',
		left: `${style.xPct}%`,
		top: `${style.yPct}%`,
		transform:
			anim && anim.transform !== 'none'
				? `translate(-50%, -50%) ${anim.transform}`
				: 'translate(-50%, -50%)',
		opacity: anim?.opacity ?? 1,
		filter: anim?.filter ?? 'none',
		clipPath: anim?.clipPath ?? 'none',
		fontFamily: style.fontFamily,
		fontSize: px(style.fontSizePct),
		fontWeight: style.fontWeight,
		color: style.color,
		textAlign: style.align,
		padding: px(style.paddingPct),
		borderRadius: px(style.borderRadiusPct),
		backgroundColor: style.backgroundColor
			? hexToRgba(style.backgroundColor, style.backgroundOpacity)
			: 'transparent',
		border: style.borderColor
			? `${px(style.borderWidthPct ?? 0.3)} solid ${style.borderColor}`
			: 'none'
	};
	if (style.shadow) {
		css.textShadow = `0 ${px(style.shadowOffsetPct ?? 0.15)} ${px(style.shadowBlurPct ?? 0.4)} ${
			style.shadowColor ?? 'rgba(0,0,0,0.6)'
		}`;
	}
	return css;
}

/** Serialize a `CssProperties` object to an inline `style` string. */
export function toCssText(css: CssProperties): string {
	return Object.entries(css)
		.map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v};`)
		.join(' ');
}
