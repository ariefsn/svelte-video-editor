import { describe, expect, it } from 'vitest';
import {
	createEmptyProject,
	defaultTextClipStyle,
	type MediaClip,
	type TextClip,
	type TimelineTrack
} from '../types/timeline.js';
import {
	clipAudible,
	clipGain,
	clipSourceSec,
	compositionSize,
	fitStage,
	isClipActive,
	projectDurationF,
	textClipCss,
	toCssText,
	trackAudible,
	visibleClipsAt
} from './render.js';

function track(id: string, overrides: Partial<TimelineTrack> = {}): TimelineTrack {
	return {
		id,
		name: id,
		muted: false,
		solo: false,
		hidden: false,
		locked: false,
		height: 56,
		...overrides
	};
}

function media(
	id: string,
	trackId: string,
	startF: number,
	durationF: number,
	overrides: Partial<MediaClip> = {}
): MediaClip {
	return {
		id,
		trackId,
		startF,
		durationF,
		groupId: null,
		locked: false,
		name: id,
		kind: 'video',
		url: 'u',
		trimInF: 0,
		sourceDurationF: 1000,
		volume: 1,
		fadeInF: 0,
		fadeOutF: 0,
		linkId: null,
		...overrides
	};
}

function project(tracks: TimelineTrack[], clips: MediaClip[]) {
	return { ...createEmptyProject('p'), fps: 30 as const, tracks, clips };
}

describe('timing', () => {
	it('project duration is the end of the last clip', () => {
		expect(projectDurationF(project([track('a')], []))).toBe(0);
		expect(
			projectDurationF(project([track('a')], [media('1', 'a', 0, 30), media('2', 'a', 60, 15)]))
		).toBe(75);
	});

	it('clip is active on [start, end)', () => {
		const c = media('1', 'a', 30, 30); // 1s..2s @30fps
		expect(isClipActive(c, 0.99, 30)).toBe(false);
		expect(isClipActive(c, 1, 30)).toBe(true);
		expect(isClipActive(c, 1.99, 30)).toBe(true);
		expect(isClipActive(c, 2, 30)).toBe(false);
	});

	it('source time honours trim-in', () => {
		const c = media('1', 'a', 30, 30, { trimInF: 60 }); // starts at 1s, source-in 2s
		expect(clipSourceSec(c, 1.5, 30)).toBeCloseTo(2.5);
	});
});

describe('layering', () => {
	it('orders bottom → top by track index and skips hidden tracks', () => {
		const p = project(
			[track('bottom'), track('hidden', { hidden: true }), track('top')],
			[media('t', 'top', 0, 30), media('h', 'hidden', 0, 30), media('b', 'bottom', 0, 30)]
		);
		expect(visibleClipsAt(p, 0.5).map((e) => [e.clip.id, e.zIndex])).toEqual([
			['b', 0],
			['t', 2]
		]);
		expect(visibleClipsAt(p, 5)).toEqual([]);
	});
});

describe('stage size', () => {
	it('fits the container keeping the aspect ratio', () => {
		expect(fitStage('16:9', 1600, 1600)).toEqual({ width: 1600, height: 900 });
		expect(fitStage('9:16', 1600, 1600)).toEqual({ width: 900, height: 1600 });
	});

	it('composition size uses the short side', () => {
		expect(compositionSize('16:9')).toEqual({ width: 1920, height: 1080 });
		expect(compositionSize('9:16')).toEqual({ width: 1080, height: 1920 });
		expect(compositionSize('1:1', 720)).toEqual({ width: 720, height: 720 });
	});
});

describe('audio', () => {
	it('solo silences non-soloed tracks; mute wins over solo', () => {
		const a = track('a', { solo: true });
		const b = track('b');
		const p = project([a, b], []);
		expect(trackAudible(p, a)).toBe(true);
		expect(trackAudible(p, b)).toBe(false);
		expect(trackAudible(p, { ...a, muted: true })).toBe(false);
	});

	it('detached video audio and images are not audible', () => {
		const p = project([track('a')], []);
		expect(clipAudible(p, media('1', 'a', 0, 30))).toBe(true);
		expect(clipAudible(p, media('1', 'a', 0, 30, { audioDetached: true }))).toBe(false);
		expect(clipAudible(p, media('1', 'a', 0, 30, { kind: 'image' }))).toBe(false);
		expect(clipAudible(p, media('1', 'a', 0, 30, { volume: 0 }))).toBe(false);
	});

	it('gain ramps linearly through fades', () => {
		// 0s..4s, 1s fade in, 1s fade out, volume 0.8
		const c = media('1', 'a', 0, 120, { volume: 0.8, fadeInF: 30, fadeOutF: 30 });
		expect(clipGain(c, 0, 30)).toBe(0);
		expect(clipGain(c, 0.5, 30)).toBeCloseTo(0.4);
		expect(clipGain(c, 2, 30)).toBeCloseTo(0.8);
		expect(clipGain(c, 3.5, 30)).toBeCloseTo(0.4);
	});
});

describe('text style', () => {
	const clip: TextClip = {
		...media('1', 'a', 0, 30),
		kind: 'text',
		text: 'hi',
		style: { ...defaultTextClipStyle(), backgroundColor: '#ff0000', backgroundOpacity: 0.5 }
	} as unknown as TextClip;

	it('scales % sizes by stage height and centers on the anchor', () => {
		const css = textClipCss(clip.style, 1000);
		expect(css.fontSize).toBe('60px'); // 6%
		expect(css.left).toBe('50%');
		expect(css.top).toBe('80%');
		expect(css.transform).toBe('translate(-50%, -50%)');
		expect(css.backgroundColor).toBe('rgba(255, 0, 0, 0.5)');
		expect(css.textShadow).toBe('0 1.5px 4px #000000');
	});

	it('composes the enter/exit animation after the centering translate', () => {
		const css = textClipCss(clip.style, 1000, {
			opacity: 0.5,
			transform: 'scale(0.9)',
			filter: 'none',
			clipPath: 'none'
		});
		expect(css.transform).toBe('translate(-50%, -50%) scale(0.9)');
		expect(css.opacity).toBe(0.5);
	});

	it('serializes to kebab-case inline style', () => {
		expect(toCssText({ fontSize: '10px', opacity: 1 })).toBe('font-size: 10px; opacity: 1;');
	});
});
