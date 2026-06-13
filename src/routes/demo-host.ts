// Demo host helpers — this is the HOST layer (lives under routes/, NOT in the
// published library). It owns persistence (localStorage) and a trivial asset
// resolver + thumbnail generator. The library itself stores nothing.

import type { ResolvedAsset, TimelineProject } from '$lib/index.js';

const PROJECT_KEY = 'sts-demo.project';
const ADV_PROJECT_KEY = 'sts-demo.advanced.project';
const HEIGHT_KEY = 'sts-demo.timelineHeight';
const LANG_KEY = 'sts-demo.lang';

export function loadProject(advanced = false): TimelineProject | null {
	try {
		const raw = localStorage.getItem(advanced ? ADV_PROJECT_KEY : PROJECT_KEY);
		return raw ? (JSON.parse(raw) as TimelineProject) : null;
	} catch {
		return null;
	}
}

export function saveProject(project: TimelineProject, advanced = false): void {
	try {
		localStorage.setItem(advanced ? ADV_PROJECT_KEY : PROJECT_KEY, JSON.stringify(project));
	} catch {
		/* ignore */
	}
}

export function loadTimelineHeight(): number | undefined {
	const n = Number(localStorage.getItem(HEIGHT_KEY));
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function saveTimelineHeight(h: number): void {
	try {
		localStorage.setItem(HEIGHT_KEY, String(h));
	} catch {
		/* ignore */
	}
}

export function loadLang(): 'en' | 'id' {
	return localStorage.getItem(LANG_KEY) === 'id' ? 'id' : 'en';
}

export function saveLang(lang: 'en' | 'id'): void {
	try {
		localStorage.setItem(LANG_KEY, lang);
	} catch {
		/* ignore */
	}
}

/** Resolve http(s) URLs to themselves (the demo only handles direct URLs). */
export async function resolveAsset(assetId: string): Promise<ResolvedAsset> {
	return { url: assetId, hasAudio: true };
}

/** Seek a <video> to grab a thumbnail frame (frame is at a 30fps reference). */
const thumbCache = new Map<string, string>();
export async function generateThumbnail(assetId: string, frame: number): Promise<string> {
	const url = assetId;
	const seconds = frame / 30;
	const key = `${url}:${Math.floor(seconds)}`;
	const cached = thumbCache.get(key);
	if (cached) return cached;

	return new Promise<string>((resolve, reject) => {
		const video = document.createElement('video');
		video.crossOrigin = 'anonymous';
		video.muted = true;
		video.preload = 'auto';
		video.src = url;
		const cleanup = () => {
			video.removeAttribute('src');
			video.load();
		};
		video.addEventListener('error', () => {
			cleanup();
			reject(new Error('thumbnail failed'));
		});
		video.addEventListener('loadeddata', () => {
			video.currentTime = Math.min(seconds, Math.max(0, (video.duration || 1) - 0.1));
		});
		video.addEventListener('seeked', () => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = 160;
				canvas.height = Math.round((video.videoHeight / video.videoWidth) * 160) || 90;
				const ctx = canvas.getContext('2d');
				if (!ctx) throw new Error('no 2d ctx');
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
				const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
				thumbCache.set(key, dataUrl);
				cleanup();
				resolve(dataUrl);
			} catch (e) {
				cleanup();
				reject(e as Error);
			}
		});
	});
}
