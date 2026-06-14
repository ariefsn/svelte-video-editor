import {
	FPS_DEFAULT,
	TRACK_HEIGHT_DEFAULT,
	ZOOM_DEFAULT,
	FPS_OPTIONS,
	type BinItem,
	type MediaClip,
	type TextClip,
	type TimelineClip,
	type TimelineFps,
	type TimelineProject,
	type TimelineTrack
} from '../types/timeline.js';

// Upgrades any serialized project (v1 seconds-based or v2 frame-based) to the
// current v2 shape. Pure and node-safe — unit-tested in migration.spec.ts.
//
// v1 → v2 rules:
// - times convert via round(seconds * 30) with fps = 30
// - field renames: timelineStart→startF, duration→durationF, trimIn→trimInF,
//   sourceDuration→sourceDurationF
// - tracks gain solo:false (and drop the legacy `kind` field)
// - clips gain fadeInF/fadeOutF: 0, linkId: null
// - project gains fps, markers: [], range: null
// - overlap normalization: v1 allowed same-track overlaps, v2 forbids them.
//   Per track, clips are walked in (startF, array-order) order; a clip whose
//   head overlaps the previous clip is head-trimmed to the previous end
//   (media clips also advance trimInF); clips left shorter than 1 frame drop.

type RawRecord = Record<string, unknown>;

function num(v: unknown, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
	return typeof v === 'string' ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
	return typeof v === 'boolean' ? v : fallback;
}

function migrateTrack(raw: RawRecord): TimelineTrack {
	return {
		id: str(raw.id, ''),
		name: str(raw.name, 'Track'),
		muted: bool(raw.muted, false),
		solo: bool(raw.solo, false),
		hidden: bool(raw.hidden, false),
		locked: bool(raw.locked, false),
		height: num(raw.height, TRACK_HEIGHT_DEFAULT)
	};
}

function migrateClip(raw: RawRecord, fps: number, fromV1: boolean): TimelineClip {
	const toF = (v: unknown, fallback: number): number =>
		fromV1 ? Math.round(num(v, fallback) * fps) : Math.round(num(v, fallback));

	const base = {
		id: str(raw.id, ''),
		trackId: str(raw.trackId, ''),
		startF: toF(fromV1 ? raw.timelineStart : raw.startF, 0),
		durationF: toF(fromV1 ? raw.duration : raw.durationF, 0),
		groupId: typeof raw.groupId === 'string' ? raw.groupId : null,
		locked: bool(raw.locked, false),
		name: str(raw.name, ''),
		// Optional enter/exit transitions; absent = none. Plain JSON, kept as-is.
		animation: (raw.animation as TimelineClip['animation']) ?? undefined
	};

	if (raw.kind === 'text') {
		return {
			...base,
			kind: 'text',
			text: str(raw.text, ''),
			style: raw.style as TextClip['style']
		};
	}

	const rawSource = fromV1 ? raw.sourceDuration : raw.sourceDurationF;
	const clip: MediaClip = {
		...base,
		kind: raw.kind as MediaClip['kind'],
		url: str(raw.url, ''),
		assetId: typeof raw.assetId === 'string' ? raw.assetId : undefined,
		trimInF: toF(fromV1 ? raw.trimIn : raw.trimInF, 0),
		sourceDurationF: rawSource === null || rawSource === undefined ? null : toF(rawSource, 0),
		volume: num(raw.volume, 1),
		fadeInF: Math.round(num(raw.fadeInF, 0)),
		fadeOutF: Math.round(num(raw.fadeOutF, 0)),
		linkId: typeof raw.linkId === 'string' ? raw.linkId : null,
		audioDetached: bool(raw.audioDetached, false) || undefined,
		attribution: raw.attribution as MediaClip['attribution']
	};
	return clip;
}

/** Trim away same-track overlaps (v2 invariant). Mutates and filters. */
export function normalizeOverlaps(project: TimelineProject): void {
	const keep = new Set<string>();
	for (const track of project.tracks) {
		const clips = project.clips
			.map((clip, index) => ({ clip, index }))
			.filter((e) => e.clip.trackId === track.id)
			.sort((a, b) => a.clip.startF - b.clip.startF || a.index - b.index);
		let prevEnd = Number.NEGATIVE_INFINITY;
		for (const { clip } of clips) {
			if (clip.startF < prevEnd) {
				const delta = prevEnd - clip.startF;
				clip.startF += delta;
				clip.durationF -= delta;
				if ('trimInF' in clip && clip.sourceDurationF !== null) clip.trimInF += delta;
			}
			if (clip.durationF >= 1) {
				keep.add(clip.id);
				prevEnd = clip.startF + clip.durationF;
			}
		}
	}
	// Clips on missing tracks are dropped too.
	project.clips = project.clips.filter((c) => keep.has(c.id));
}

export function migrateProject(input: unknown): TimelineProject {
	const raw = input as RawRecord;
	const fromV1 = num(raw.schemaVersion, 1) < 2;
	const fps = (FPS_OPTIONS as readonly number[]).includes(num(raw.fps, FPS_DEFAULT))
		? (num(raw.fps, FPS_DEFAULT) as TimelineFps)
		: FPS_DEFAULT;

	const project: TimelineProject = {
		schemaVersion: 2,
		id: str(raw.id, ''),
		workspaceId: str(raw.workspaceId, ''),
		name: str(raw.name, ''),
		aspectRatio: (raw.aspectRatio as TimelineProject['aspectRatio']) ?? '16:9',
		fps,
		tracks: Array.isArray(raw.tracks) ? raw.tracks.map((t) => migrateTrack(t as RawRecord)) : [],
		clips: Array.isArray(raw.clips)
			? raw.clips.map((c) => migrateClip(c as RawRecord, fps, fromV1))
			: [],
		markers: Array.isArray(raw.markers) ? (raw.markers as TimelineProject['markers']) : [],
		range: (raw.range as TimelineProject['range']) ?? null,
		bin: Array.isArray(raw.bin) ? (raw.bin as BinItem[]) : [],
		zoom: num(raw.zoom, ZOOM_DEFAULT),
		createdAt: num(raw.createdAt, 0),
		updatedAt: num(raw.updatedAt, 0)
	};

	if (fromV1) normalizeOverlaps(project);
	return project;
}
