// Demo host helpers — this is the HOST layer (lives under routes/, NOT in the
// published library). It owns persistence (localStorage) and a trivial asset
// resolver + thumbnail generator. The library itself stores nothing.

import { uid, type BinItem, type MediaType, type ResolvedAsset, type TimelineProject } from '$lib/index.js';

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

/**
 * Drop bin items and clips backed by a local file from an earlier session —
 * their blob URLs died with that tab. Returns how many were removed so the
 * host can tell the user instead of showing silently broken media.
 */
export function pruneDeadLocalAssets(project: TimelineProject): number {
	const deadBin = project.bin.filter((i) => isLocalAssetId(i.assetId) && !isLocalAssetLive(i.assetId));
	const deadClips = project.clips.filter(
		(c) => 'assetId' in c && isLocalAssetId(c.assetId) && !isLocalAssetLive(c.assetId)
	);
	if (deadBin.length === 0 && deadClips.length === 0) return 0;

	const deadIds = new Set(deadBin.map((i) => i.id));
	const deadClipIds = new Set(deadClips.map((c) => c.id));
	project.bin = project.bin.filter((i) => !deadIds.has(i.id));
	project.clips = project.clips.filter((c) => !deadClipIds.has(c.id));
	return deadBin.length + deadClips.length;
}

/** blob: URLs must never be persisted — keep the assetId, blank the URL. */
function stripBlobUrls(project: TimelineProject): TimelineProject {
	return {
		...project,
		bin: project.bin.map((item) => (item.url.startsWith('blob:') ? { ...item, url: '' } : item)),
		// `'url' in clip` narrows away TextClip, which carries no media URL.
		clips: project.clips.map((clip) =>
			'url' in clip && clip.url.startsWith('blob:') ? { ...clip, url: '' } : clip
		)
	};
}

export function saveProject(project: TimelineProject, advanced = false): void {
	try {
		localStorage.setItem(
			advanced ? ADV_PROJECT_KEY : PROJECT_KEY,
			JSON.stringify(stripBlobUrls(project))
		);
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

// --- Local (picked / dropped) files -----------------------------------------
// A blob: URL only lives as long as this tab, so local files are registered
// here under a stable assetId and the project stores that id — never the blob
// URL (see the `MediaClip.url` contract in types/timeline.ts). resolveAsset
// then hands back the live URL for as long as the session lasts.
type LocalAsset = {
	url: string;
	name: string;
	mediaType: MediaType;
	duration: number | null;
};

const localAssets = new Map<string, LocalAsset>();

function mediaTypeForFile(file: File): MediaType | null {
	const mime = file.type.toLowerCase();
	if (mime === 'image/gif') return 'gif';
	if (mime.startsWith('video/')) return 'video';
	if (mime.startsWith('audio/')) return 'audio';
	if (mime.startsWith('image/')) return 'image';

	// Some browsers hand over an empty type for less common containers, so fall
	// back to the extension (same buckets the paste-a-URL form uses).
	const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
	if (ext === 'gif') return 'gif';
	if (/^(mp4|webm|mov|m4v|mkv|avi)$/.test(ext)) return 'video';
	if (/^(mp3|wav|ogg|m4a|aac|flac)$/.test(ext)) return 'audio';
	if (/^(png|jpe?g|webp|avif|bmp|svg)$/.test(ext)) return 'image';
	return null;
}

/** Probe intrinsic length in SECONDS; images have none (freely stretchable). */
function probeDuration(url: string, mediaType: MediaType): Promise<number | null> {
	if (mediaType !== 'video' && mediaType !== 'audio') return Promise.resolve(null);
	return new Promise((resolve) => {
		const el = document.createElement(mediaType === 'audio' ? 'audio' : 'video');
		el.preload = 'metadata';
		const done = (value: number | null) => {
			el.removeAttribute('src');
			el.load();
			resolve(value);
		};
		el.addEventListener('loadedmetadata', () =>
			done(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null)
		);
		// A duration we can't read is survivable — the editor falls back to a
		// default clip length — so never reject and lose the whole import.
		el.addEventListener('error', () => done(null));
		el.src = url;
	});
}

/**
 * Register a picked/dropped file and build the BinItem for `addItems`.
 * Returns null for file types the editor can't place on a track.
 */
export async function registerLocalFile(file: File): Promise<BinItem | null> {
	const mediaType = mediaTypeForFile(file);
	if (!mediaType) return null;

	const url = URL.createObjectURL(file);
	const duration = await probeDuration(url, mediaType);
	const assetId = `local:${uid()}`;
	localAssets.set(assetId, { url, name: file.name, mediaType, duration });

	return { id: uid(), assetId, url, name: file.name, mediaType, duration };
}

/** True while the blob URL behind this assetId is still alive in this tab. */
function isLocalAssetLive(assetId: string | undefined): boolean {
	return !!assetId && localAssets.has(assetId);
}

function isLocalAssetId(assetId: string | undefined): assetId is string {
	return !!assetId && assetId.startsWith('local:');
}

/** Live blob URL for a local asset, or the id itself (a real URL) otherwise. */
function urlForAsset(assetId: string): string {
	const local = localAssets.get(assetId);
	if (local) return local.url;
	if (isLocalAssetId(assetId)) {
		// Persisted from an earlier session — the blob died with that tab.
		throw new Error(`local asset ${assetId} is no longer available`);
	}
	return assetId;
}

/** Resolve http(s) URLs to themselves; local files via the session registry. */
export async function resolveAsset(assetId: string): Promise<ResolvedAsset> {
	return { url: urlForAsset(assetId), hasAudio: true };
}

/** Seek a <video> to grab a thumbnail frame (frame is at a 30fps reference). */
const thumbCache = new Map<string, string>();
export async function generateThumbnail(assetId: string, frame: number): Promise<string> {
	const seconds = frame / 30;
	// Key on the assetId, not the URL: a blob URL differs per session, and
	// caching under it would strand entries after a re-import.
	const key = `${assetId}:${Math.floor(seconds)}`;
	const cached = thumbCache.get(key);
	if (cached) return cached;

	const url = urlForAsset(assetId);

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
