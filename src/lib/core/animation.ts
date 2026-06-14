// Clip enter/exit transition math — pure, framework-free, and the single source
// of truth shared by the preview components (StageMedia, TextOverlayView) and,
// later, a server-side compositor. Everything derives from the playhead, so the
// preview scrubs correctly when dragging/playing/looping; nothing here mounts or
// touches the DOM.

import {
	clipEndF,
	frameToSec,
	type AnimPreset,
	type ClipTransition,
	type Easing,
	type TimelineClip
} from '../types/timeline.js';

export function clamp(v: number, lo: number, hi: number): number {
	return Math.min(Math.max(v, lo), hi);
}

/** Easing applied to a 0→1 progress value. `bounce`/`pop` presets override this
 * with their own spring-ish curve regardless of the chosen easing. */
export function ease(t: number, easing: Easing): number {
	switch (easing) {
		case 'ease-in':
			return t * t;
		case 'ease-out':
			return 1 - (1 - t) * (1 - t);
		case 'ease-in-out':
			return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
		default:
			return t;
	}
}

// A decaying-bounce curve: settles at 1 with a couple of overshoots.
function bounceOut(t: number): number {
	const n1 = 7.5625;
	const d1 = 2.75;
	if (t < 1 / d1) return n1 * t * t;
	if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
	if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
	return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// A single overshoot (used by `pop`): rises past 1 then settles.
function backOut(t: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Inline-style fragments for a clip at a given playhead time. Identity values
 * (`opacity:1, transform:'none', …`) when the clip has no animation or the
 * playhead is outside its enter/exit windows. */
export type AnimStyle = {
	opacity: number;
	transform: string;
	filter: string;
	clipPath: string;
};

const IDENTITY: AnimStyle = { opacity: 1, transform: 'none', filter: 'none', clipPath: 'none' };

/**
 * `p` is eased enter/exit progress in [0,1] where 1 = fully on-screen (resting)
 * and 0 = fully off/hidden. `side` flips direction for the slide presets.
 */
function presetStyle(preset: AnimPreset, p: number, side: 'in' | 'out'): AnimStyle {
	const inv = 1 - p; // 0 at rest, 1 at the extreme
	// Slides come from the named edge on enter; on exit they leave to the OPPOSITE
	// edge so the motion reads as continuing, not rewinding.
	const dir = side === 'in' ? 1 : -1;
	switch (preset) {
		case 'fade':
			return { ...IDENTITY, opacity: p };
		case 'slide-left':
			return { ...IDENTITY, opacity: p, transform: `translateX(${-inv * 100 * dir}%)` };
		case 'slide-right':
			return { ...IDENTITY, opacity: p, transform: `translateX(${inv * 100 * dir}%)` };
		case 'slide-up':
			return { ...IDENTITY, opacity: p, transform: `translateY(${-inv * 100 * dir}%)` };
		case 'slide-down':
			return { ...IDENTITY, opacity: p, transform: `translateY(${inv * 100 * dir}%)` };
		case 'scale':
			return { ...IDENTITY, opacity: p, transform: `scale(${0.85 + 0.15 * p})` };
		case 'zoom':
			return { ...IDENTITY, opacity: p, transform: `scale(${1.15 - 0.15 * p})` };
		case 'spin':
			return { ...IDENTITY, opacity: p, transform: `rotate(${inv * 180 * dir}deg) scale(${p})` };
		case 'blur':
			return { ...IDENTITY, opacity: p, filter: `blur(${inv * 8}px)` };
		case 'flip':
			return {
				...IDENTITY,
				opacity: p,
				transform: `perspective(600px) rotateY(${inv * 90 * dir}deg)`
			};
		case 'wipe': {
			// Reveal from the leading edge; the eased `p` already shapes the speed.
			const pct = p * 100;
			return side === 'in'
				? { ...IDENTITY, clipPath: `inset(0 ${100 - pct}% 0 0)` }
				: { ...IDENTITY, clipPath: `inset(0 0 0 ${100 - pct}%)` };
		}
		default:
			return { ...IDENTITY, opacity: p };
	}
}

export function clipAnimStyle(clip: TimelineClip, playheadSec: number, fps: number): AnimStyle {
	const anim = clip.animation;
	if (!anim || (!anim.in && !anim.out)) return IDENTITY;

	const startS = frameToSec(clip.startF, fps);
	const endS = frameToSec(clipEndF(clip), fps);

	// Enter window: [startS, startS + inDur). Exit window: (endS - outDur, endS].
	if (anim.in) {
		const dur = frameToSec(Math.max(1, anim.in.durationF), fps);
		if (playheadSec < startS + dur) {
			const t = clamp((playheadSec - startS) / dur, 0, 1);
			return applyCurve(anim.in, t, 'in');
		}
	}
	if (anim.out) {
		const dur = frameToSec(Math.max(1, anim.out.durationF), fps);
		if (playheadSec > endS - dur) {
			const t = clamp((endS - playheadSec) / dur, 0, 1);
			return applyCurve(anim.out, t, 'out');
		}
	}
	return IDENTITY;
}

function applyCurve(tr: ClipTransition, rawT: number, side: 'in' | 'out'): AnimStyle {
	let p: number;
	if (tr.preset === 'bounce') p = bounceOut(rawT);
	else if (tr.preset === 'pop') p = backOut(rawT);
	else p = ease(rawT, tr.easing);
	return presetStyle(tr.preset, p, side);
}
