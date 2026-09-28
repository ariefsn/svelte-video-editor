import {
	clipEndF,
	frameToSec,
	isMediaClip,
	type MediaClip,
	type TimelineProject
} from '../types/timeline.js';
import { clipAudible, clipGain, clipSourceSec, isClipActive } from './render.js';

type PlaybackEngineOpts = {
	getProject: () => TimelineProject;
	getPlayhead: () => number;
	setPlayhead: (t: number) => void;
	getDuration: () => number;
	getLoopRange: () => { inSec: number; outSec: number } | null;
	onEnded: () => void;
};

// Drift tolerated on NON-master elements before a hard seek. Precise
// currentTime seeks decode from the previous keyframe (often >100ms on remote
// MP4s), so corrections must be rare or they themselves cause the stutter.
const DRIFT_THRESHOLD = 0.3;
// Minimum gap between corrections per element, so a slow seek can finish
// before being re-corrected.
const CORRECTION_COOLDOWN_MS = 500;
// Clips within this many seconds of becoming active get their element mounted
// and pre-seeked so the boundary handoff doesn't hiccup on decode/network.
export const PRELOAD_LOOKAHEAD = 5;

/**
 * Clock for the DOM-layered preview. While a video clip is active its element
 * IS the clock (a video is never drift-corrected against itself, so single-
 * video playback is perfectly smooth); the wall clock (performance.now) is
 * continuously re-anchored to it and takes over across gaps, images and
 * audio-only stretches. Secondary elements get loose drift correction with a
 * cooldown instead of per-frame hard seeks.
 */
export class PlaybackEngine {
	#opts: PlaybackEngineOpts;
	#elements = new Map<string, HTMLVideoElement | HTMLAudioElement>();
	#lastCorrection = new Map<string, number>();
	#rafId: number | null = null;
	#wallStart = 0;
	#playing = false;
	#masterClipId: string | null = null;

	constructor(opts: PlaybackEngineOpts) {
		this.#opts = opts;
	}

	register(clipId: string, el: HTMLVideoElement | HTMLAudioElement): void {
		this.#elements.set(clipId, el);
		// Sync immediately: an active element shows the right frame while
		// paused; a lookahead element pre-seeks to its in-point.
		this.#syncElement(clipId, el, this.#opts.getPlayhead(), true);
	}

	unregister(clipId: string): void {
		const el = this.#elements.get(clipId);
		if (el && !el.paused) el.pause();
		this.#elements.delete(clipId);
		this.#lastCorrection.delete(clipId);
		if (this.#masterClipId === clipId) this.#masterClipId = null;
	}

	play(): void {
		if (this.#playing) return;
		this.#playing = true;
		this.#wallStart = performance.now() - this.#opts.getPlayhead() * 1000;
		this.#tick();
	}

	pause(): void {
		this.#playing = false;
		this.#masterClipId = null;
		if (this.#rafId !== null) {
			cancelAnimationFrame(this.#rafId);
			this.#rafId = null;
		}
		for (const el of this.#elements.values()) {
			if (!el.paused) el.pause();
		}
	}

	seek(t: number): void {
		this.#opts.setPlayhead(t);
		if (this.#playing) this.#wallStart = performance.now() - t * 1000;
		this.#masterClipId = null;
		this.syncFrame(t, true);
	}

	/** Re-apply mute/volume/position to all registered elements (e.g. after a track mute toggle). */
	refresh(): void {
		this.syncFrame(this.#opts.getPlayhead(), false);
	}

	destroy(): void {
		this.pause();
		this.#elements.clear();
		this.#lastCorrection.clear();
	}

	#tick = (): void => {
		if (!this.#playing) return;
		const now = performance.now();
		let t = (now - this.#wallStart) / 1000;

		// Derive time from the master video element when one is active and
		// healthy; keep the wall clock anchored to it for seamless handoff.
		const master = this.#findMaster(t);
		if (master) {
			const project = this.#opts.getProject();
			const startSec = frameToSec(master.clip.startF, project.fps);
			const trimSec = frameToSec(master.clip.trimInF, project.fps);
			const endSec = frameToSec(clipEndF(master.clip), project.fps);
			const mt = master.el.currentTime - trimSec + startSec;
			if (mt >= startSec && mt < endSec) {
				t = mt;
				this.#wallStart = now - t * 1000;
			}
		}

		// Loop within the in/out range when enabled.
		const loop = this.#opts.getLoopRange();
		if (loop && t >= loop.outSec) {
			this.seek(loop.inSec);
			this.#rafId = requestAnimationFrame(this.#tick);
			return;
		}

		const duration = this.#opts.getDuration();
		if (t >= duration) {
			this.#opts.setPlayhead(duration);
			this.pause();
			this.#opts.onEnded();
			return;
		}
		this.#opts.setPlayhead(t);
		this.syncFrame(t, false);
		this.#rafId = requestAnimationFrame(this.#tick);
	};

	#findMaster(t: number): { el: HTMLVideoElement; clip: MediaClip } | null {
		const project = this.#opts.getProject();
		const tF = t * project.fps;
		const isCandidate = (clip: MediaClip): boolean => {
			if (clip.kind !== 'video') return false;
			if (tF < clip.startF || tF >= clipEndF(clip)) return false;
			const el = this.#elements.get(clip.id);
			return !!el && !el.paused && !el.seeking && el.readyState >= 2;
		};

		// Prefer the previous master while it's still valid — switching clocks
		// mid-clip would jitter the playhead.
		if (this.#masterClipId) {
			const prev = project.clips.find((c) => c.id === this.#masterClipId);
			if (prev && isMediaClip(prev) && isCandidate(prev)) {
				return { el: this.#elements.get(prev.id) as HTMLVideoElement, clip: prev };
			}
		}

		for (const track of project.tracks) {
			if (track.hidden) continue;
			for (const clip of project.clips) {
				if (clip.trackId !== track.id || !isMediaClip(clip)) continue;
				if (isCandidate(clip)) {
					this.#masterClipId = clip.id;
					return { el: this.#elements.get(clip.id) as HTMLVideoElement, clip };
				}
			}
		}
		this.#masterClipId = null;
		return null;
	}

	syncFrame(t: number, forceSeek: boolean): void {
		for (const [clipId, el] of this.#elements) {
			this.#syncElement(clipId, el, t, forceSeek);
		}
	}

	#syncElement(
		clipId: string,
		el: HTMLVideoElement | HTMLAudioElement,
		t: number,
		forceSeek: boolean
	): void {
		const project = this.#opts.getProject();
		const clip = project.clips.find((c) => c.id === clipId);
		if (!clip || !isMediaClip(clip)) return;
		if (clip.kind === 'image') return;

		const fps = project.fps;
		const startSec = frameToSec(clip.startF, fps);
		const trimSec = frameToSec(clip.trimInF, fps);

		// Only touch media-element properties when they actually change — this
		// runs every rAF tick for every staged element.
		const muted = !clipAudible(project, clip);
		if (el.muted !== muted) el.muted = muted;

		const volume = clipGain(clip, t, fps);
		if (Math.abs(el.volume - volume) > 0.005) el.volume = volume;

		if (!isClipActive(clip, t, fps)) {
			if (!el.paused) el.pause();
			// Lookahead: prime the decoder at the clip's in-point so the
			// upcoming boundary handoff starts on an already-decoded frame.
			const inLookahead = t >= startSec - PRELOAD_LOOKAHEAD && t < startSec;
			if (inLookahead && !el.seeking && Math.abs(el.currentTime - trimSec) > DRIFT_THRESHOLD) {
				el.currentTime = trimSec;
			}
			return;
		}

		const desired = clipSourceSec(clip, t, fps);
		if (forceSeek) {
			el.currentTime = desired;
			this.#lastCorrection.set(clipId, performance.now());
		} else if (clipId !== this.#masterClipId && !el.seeking) {
			const now = performance.now();
			const last = this.#lastCorrection.get(clipId) ?? 0;
			if (
				Math.abs(el.currentTime - desired) > DRIFT_THRESHOLD &&
				now - last > CORRECTION_COOLDOWN_MS
			) {
				el.currentTime = desired;
				this.#lastCorrection.set(clipId, now);
			}
		}

		if (this.#playing && el.paused) {
			// Autoplay policies (iOS) can reject; retry muted so video at least renders.
			el.play().catch(() => {
				el.muted = true;
				el.play().catch(() => {});
			});
		} else if (!this.#playing && !el.paused) {
			el.pause();
		}
	}
}
