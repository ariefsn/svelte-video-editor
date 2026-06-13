import {
	clipEndF,
	clipKindForMediaType,
	createTrack,
	isMediaClip,
	secToFrame,
	CLIP_MIN_FRAMES,
	type BinItem,
	type MediaClip,
	type TimelineClip,
	type TimelineProject,
	type TimelineTrack
} from '../types/timeline.js';
import { uid } from '../utils.js';

// Pure editing operations over a TimelineProject (plain JSON or $state proxy
// alike). Every op validates FIRST and only then applies, so a failure never
// partially mutates. The store wraps each call in #mutate() → one undo entry.
// Unit-tested in ops.spec.ts (vitest node project).

export type OpFailReason =
	| 'locked'
	| 'occupied'
	| 'not-contiguous'
	| 'no-target'
	| 'no-audio'
	| 'invalid';

export type OpResult = { ok: true } | { ok: false; reason: OpFailReason };

const OK: OpResult = { ok: true };
const fail = (reason: OpFailReason): OpResult => ({ ok: false, reason });

type IdGen = () => string;
const defaultIdGen: IdGen = () => uid();

// ---- lookups -------------------------------------------------------------

export function clipById(project: TimelineProject, id: string): TimelineClip | undefined {
	return project.clips.find((c) => c.id === id);
}

export function trackById(project: TimelineProject, id: string): TimelineTrack | undefined {
	return project.tracks.find((t) => t.id === id);
}

export function isClipLocked(project: TimelineProject, clip: TimelineClip): boolean {
	return clip.locked || (trackById(project, clip.trackId)?.locked ?? false);
}

export function trackClipsSorted(project: TimelineProject, trackId: string): TimelineClip[] {
	return project.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.startF - b.startF);
}

function overlapping(
	project: TimelineProject,
	trackId: string,
	startF: number,
	endF: number,
	exclude: ReadonlySet<string>
): TimelineClip[] {
	return project.clips.filter(
		(c) => c.trackId === trackId && !exclude.has(c.id) && c.startF < endF && clipEndF(c) > startF
	);
}

export function spanFree(
	project: TimelineProject,
	trackId: string,
	startF: number,
	endF: number,
	exclude: ReadonlySet<string>
): boolean {
	return overlapping(project, trackId, startF, endF, exclude).length === 0;
}

export function linkedPartner(project: TimelineProject, clip: TimelineClip): MediaClip | null {
	if (!isMediaClip(clip) || !clip.linkId) return null;
	const partner = project.clips.find(
		(c) => c.id !== clip.id && isMediaClip(c) && c.linkId === clip.linkId
	);
	return (partner as MediaClip) ?? null;
}

// ---- split ---------------------------------------------------------------

function splitOne(
	project: TimelineProject,
	clip: TimelineClip,
	atF: number,
	idgen: IdGen
): TimelineClip | null {
	if (atF <= clip.startF || atF >= clipEndF(clip)) return null;
	const headDuration = atF - clip.startF;
	const tail: TimelineClip = {
		...structuredClone(toPlain(clip)),
		id: idgen(),
		startF: atF,
		durationF: clip.durationF - headDuration
	};
	if (isMediaClip(tail)) {
		if (tail.sourceDurationF !== null) tail.trimInF += headDuration;
		// Fades stay attached to their respective outer edges.
		tail.fadeInF = 0;
		tail.fadeOutF = Math.min((clip as MediaClip).fadeOutF ?? 0, tail.durationF);
		(clip as MediaClip).fadeOutF = 0;
		// A split breaks audio linking for the tail (head keeps the link).
		tail.linkId = null;
	}
	clip.durationF = headDuration;
	project.clips.push(tail);
	return tail;
}

// $state proxies can't be structuredClone'd directly in all runtimes; round
// trip through JSON for safety (clips are plain JSON by design).
function toPlain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/** Split the given clips at a frame. Locked/non-spanning clips are skipped. */
export function splitClips(
	project: TimelineProject,
	clipIds: string[],
	atF: number,
	idgen: IdGen = defaultIdGen
): { ok: true; newIds: string[] } {
	const newIds: string[] = [];
	for (const id of clipIds) {
		const clip = clipById(project, id);
		if (!clip || isClipLocked(project, clip)) continue;
		const tail = splitOne(project, clip, atF, idgen);
		if (tail) newIds.push(tail.id);
	}
	return { ok: true, newIds };
}

/** ⇧S: razor every unlocked clip under the playhead on every unlocked track. */
export function splitAllAt(
	project: TimelineProject,
	atF: number,
	idgen: IdGen = defaultIdGen
): { ok: true; newIds: string[] } {
	const ids = project.clips
		.filter((c) => !isClipLocked(project, c) && c.startF < atF && atF < clipEndF(c))
		.map((c) => c.id);
	return splitClips(project, ids, atF, idgen);
}

// ---- overwrite / insert placement -----------------------------------------

/**
 * Make [startF, endF) free on a track by trimming/splitting/removing
 * overlapped clips (standard NLE overwrite). Fails on locked victims.
 */
export function resolveOverwrite(
	project: TimelineProject,
	trackId: string,
	startF: number,
	endF: number,
	exclude: ReadonlySet<string>,
	idgen: IdGen = defaultIdGen
): OpResult {
	const victims = overlapping(project, trackId, startF, endF, exclude);
	if (victims.some((v) => isClipLocked(project, v))) return fail('locked');

	const removeIds = new Set<string>();
	for (const victim of victims) {
		const vStart = victim.startF;
		const vEnd = clipEndF(victim);
		if (vStart >= startF && vEnd <= endF) {
			removeIds.add(victim.id);
		} else if (vStart < startF && vEnd > endF) {
			// Victim straddles the whole span: split, then trim both halves.
			const tail = splitOne(project, victim, startF, idgen);
			if (tail) {
				const cut = endF - tail.startF;
				tail.startF = endF;
				tail.durationF -= cut;
				if (isMediaClip(tail) && tail.sourceDurationF !== null) tail.trimInF += cut;
			}
		} else if (vStart < startF) {
			// Tail overlapped: trim the victim's tail.
			victim.durationF = startF - vStart;
			if (isMediaClip(victim)) victim.fadeOutF = Math.min(victim.fadeOutF, victim.durationF);
		} else {
			// Head overlapped: trim the victim's head.
			const cut = endF - vStart;
			victim.startF = endF;
			victim.durationF -= cut;
			if (isMediaClip(victim)) {
				if (victim.sourceDurationF !== null) victim.trimInF += cut;
				victim.fadeInF = Math.min(victim.fadeInF, victim.durationF);
			}
		}
	}
	project.clips = project.clips.filter(
		(c) => !removeIds.has(c.id) && c.durationF >= CLIP_MIN_FRAMES
	);
	return OK;
}

/**
 * Open a gap: split clips spanning atF (all unlocked tracks), then shift
 * everything starting at/after atF right by lengthF. Fails if a locked clip
 * spans the point or sits in the shifted region.
 */
export function insertGap(
	project: TimelineProject,
	atF: number,
	lengthF: number,
	exclude: ReadonlySet<string>,
	idgen: IdGen = defaultIdGen
): OpResult {
	const spanning = project.clips.filter(
		(c) => !exclude.has(c.id) && c.startF < atF && atF < clipEndF(c)
	);
	const shifting = project.clips.filter((c) => !exclude.has(c.id) && c.startF >= atF);
	if (
		spanning.some((c) => isClipLocked(project, c)) ||
		shifting.some((c) => isClipLocked(project, c))
	) {
		return fail('locked');
	}
	for (const clip of spanning) splitOne(project, clip, atF, idgen);
	for (const clip of project.clips) {
		if (!exclude.has(clip.id) && clip.startF >= atF) clip.startF += lengthF;
	}
	return OK;
}

export type ClipMove = { clipId: string; startF: number; trackId: string };

/**
 * Commit a drag: move clips to new positions/tracks, resolving collisions by
 * mode. 'overwrite' trims what's underneath (per target track); 'insert'
 * opens a gap at the landing span across all tracks first. All-or-nothing.
 */
export function placeClips(
	project: TimelineProject,
	moves: ClipMove[],
	mode: 'overwrite' | 'insert',
	idgen: IdGen = defaultIdGen
): OpResult {
	if (moves.length === 0) return OK;
	const moveIds = new Set(moves.map((m) => m.clipId));
	const resolved = moves.map((m) => {
		const clip = clipById(project, m.clipId);
		return clip ? { ...m, clip } : null;
	});
	if (resolved.some((r) => r === null)) return fail('invalid');
	const entries = resolved as {
		clipId: string;
		startF: number;
		trackId: string;
		clip: TimelineClip;
	}[];
	if (entries.some((e) => isClipLocked(project, e.clip))) return fail('locked');
	if (entries.some((e) => !trackById(project, e.trackId) || trackById(project, e.trackId)?.locked))
		return fail('locked');

	if (mode === 'insert') {
		const spanStart = Math.min(...entries.map((e) => e.startF));
		const spanEnd = Math.max(...entries.map((e) => e.startF + e.clip.durationF));
		const result = insertGap(project, spanStart, spanEnd - spanStart, moveIds, idgen);
		if (!result.ok) return result;
	} else {
		// Validate all overwrites BEFORE applying any (locked victims abort).
		for (const e of entries) {
			const victims = overlapping(
				project,
				e.trackId,
				e.startF,
				e.startF + e.clip.durationF,
				moveIds
			);
			if (victims.some((v) => isClipLocked(project, v))) return fail('locked');
		}
		for (const e of entries) {
			const result = resolveOverwrite(
				project,
				e.trackId,
				e.startF,
				e.startF + e.clip.durationF,
				moveIds,
				idgen
			);
			if (!result.ok) return result;
		}
	}

	for (const e of entries) {
		e.clip.startF = e.startF;
		e.clip.trackId = e.trackId;
	}
	return OK;
}

// ---- ripple delete / gaps -------------------------------------------------

/**
 * Remove the selection and close the vacated span across ALL tracks.
 * Aborts if the selection span contains unselected clips, or if any clip
 * that must shift (or straddles the span end) is locked.
 */
export function rippleDelete(project: TimelineProject, clipIds: string[]): OpResult {
	const selection = clipIds
		.map((id) => clipById(project, id))
		.filter((c): c is TimelineClip => !!c);
	if (selection.length === 0) return fail('invalid');
	if (selection.some((c) => isClipLocked(project, c))) return fail('locked');

	const ids = new Set(selection.map((c) => c.id));
	const spanStart = Math.min(...selection.map((c) => c.startF));
	const spanEnd = Math.max(...selection.map((c) => clipEndF(c)));
	const spanLen = spanEnd - spanStart;

	// Unselected clips overlapping the span block the ripple (the span must
	// be contiguous selection-owned space).
	const blockers = project.clips.filter(
		(c) => !ids.has(c.id) && c.startF < spanEnd && clipEndF(c) > spanStart
	);
	if (blockers.length > 0) return fail('not-contiguous');

	const shifting = project.clips.filter((c) => !ids.has(c.id) && c.startF >= spanEnd);
	if (shifting.some((c) => isClipLocked(project, c))) return fail('locked');

	project.clips = project.clips.filter((c) => !ids.has(c.id));
	for (const clip of project.clips) {
		if (clip.startF >= spanEnd) clip.startF -= spanLen;
	}
	return OK;
}

export type Gap = { trackId: string; startF: number; endF: number };

/** The gap (empty span) on a track containing the given frame, if any. */
export function gapAt(project: TimelineProject, trackId: string, frame: number): Gap | null {
	const clips = trackClipsSorted(project, trackId);
	let prevEnd = 0;
	for (const clip of clips) {
		if (frame >= prevEnd && frame < clip.startF) {
			return { trackId, startF: prevEnd, endF: clip.startF };
		}
		prevEnd = Math.max(prevEnd, clipEndF(clip));
		if (frame < prevEnd) return null;
	}
	return null; // trailing space is not a closable gap
}

/**
 * Close a gap. Single-track: shift that track's suffix left by the gap
 * length. All-tracks: shift every clip starting at/after the gap end on all
 * tracks, clamped so nothing collides with stationary clips; aborts if a
 * locked clip must shift or no room exists.
 */
export function closeGap(project: TimelineProject, gap: Gap, allTracks: boolean): OpResult {
	const gapLen = gap.endF - gap.startF;
	if (gapLen <= 0) return fail('invalid');

	const shifting = project.clips.filter(
		(c) => (allTracks || c.trackId === gap.trackId) && c.startF >= gap.endF
	);
	if (shifting.length === 0) return fail('invalid');
	if (shifting.some((c) => isClipLocked(project, c))) return fail('locked');
	const shiftingTracks = allTracks ? [...new Set(shifting.map((c) => c.trackId))] : [gap.trackId];
	if (shiftingTracks.some((tid) => trackById(project, tid)?.locked)) return fail('locked');

	// Per shifted track, room = first shifted clip's start − last stationary
	// clip's end before it (stationary = startF < gap.endF on that track).
	let shift = gapLen;
	for (const trackId of shiftingTracks) {
		const firstShifted = Math.min(
			...shifting.filter((c) => c.trackId === trackId).map((c) => c.startF)
		);
		const stationaryEnd = Math.max(
			gap.trackId === trackId ? gap.startF : 0,
			...project.clips
				.filter((c) => c.trackId === trackId && c.startF < gap.endF)
				.map((c) => clipEndF(c))
		);
		shift = Math.min(shift, firstShifted - stationaryEnd);
	}
	if (shift <= 0) return fail('occupied');

	for (const clip of shifting) clip.startF -= shift;
	return OK;
}

/** Range ripple delete: clear [inF, outF) on all tracks, then close it. */
export function rangeDelete(
	project: TimelineProject,
	inF: number,
	outF: number,
	idgen: IdGen = defaultIdGen
): OpResult {
	if (outF <= inF) return fail('invalid');
	const none = new Set<string>();
	const intersecting = project.clips.filter((c) => c.startF < outF && clipEndF(c) > inF);
	if (intersecting.some((c) => isClipLocked(project, c))) return fail('locked');
	const shifting = project.clips.filter((c) => c.startF >= outF);
	if (shifting.some((c) => isClipLocked(project, c))) return fail('locked');

	for (const track of project.tracks) {
		const result = resolveOverwrite(project, track.id, inF, outF, none, idgen);
		if (!result.ok) return result;
	}
	for (const clip of project.clips) {
		if (clip.startF >= outF) clip.startF -= outF - inF;
	}
	return OK;
}

// ---- trim (with neighbor clamping + link propagation) ----------------------

export type TrimResult = OpResult & { appliedF?: number };

/**
 * Set a clip edge to an absolute frame, clamped to: min duration, source
 * bounds (media), and adjacent clips on the same track (no-overlap
 * invariant). Optionally propagates the same delta to a linked partner —
 * if the partner can't apply the full delta, both clamp together.
 */
export function trimClip(
	project: TimelineProject,
	clipId: string,
	edge: 'left' | 'right',
	targetF: number,
	propagateLink = true
): TrimResult {
	const clip = clipById(project, clipId);
	if (!clip) return fail('invalid');
	if (isClipLocked(project, clip)) return fail('locked');
	const partner = propagateLink ? linkedPartner(project, clip) : null;
	if (partner && isClipLocked(project, partner)) return fail('locked');

	const deltaFor = (c: TimelineClip): { min: number; max: number } => {
		const neighbors = trackClipsSorted(project, c.trackId).filter(
			(n) => n.id !== c.id && (!partner || n.id !== partner.id)
		);
		if (edge === 'left') {
			const prevEnd = Math.max(
				0,
				...neighbors.filter((n) => clipEndF(n) <= c.startF).map((n) => clipEndF(n))
			);
			let min = prevEnd - c.startF; // most it can extend left
			if (isMediaClip(c) && c.sourceDurationF !== null) min = Math.max(min, -c.trimInF);
			const max = c.durationF - CLIP_MIN_FRAMES; // most it can shrink
			return { min, max };
		}
		const nextStart = Math.min(
			...neighbors.filter((n) => n.startF >= clipEndF(c)).map((n) => n.startF),
			Number.POSITIVE_INFINITY
		);
		let max = nextStart - clipEndF(c); // most it can extend right
		if (isMediaClip(c) && c.sourceDurationF !== null)
			max = Math.min(max, c.sourceDurationF - c.trimInF - c.durationF);
		const min = CLIP_MIN_FRAMES - c.durationF; // most it can shrink
		return { min, max };
	};

	const desired = edge === 'left' ? targetF - clip.startF : targetF - clipEndF(clip);
	let bounds = deltaFor(clip);
	if (partner) {
		const pb = deltaFor(partner);
		bounds = { min: Math.max(bounds.min, pb.min), max: Math.min(bounds.max, pb.max) };
	}
	const applied = Math.min(Math.max(desired, bounds.min), bounds.max);
	if (applied === 0) return { ok: true, appliedF: 0 };

	const apply = (c: TimelineClip) => {
		if (edge === 'left') {
			c.startF += applied;
			c.durationF -= applied;
			if (isMediaClip(c)) {
				if (c.sourceDurationF !== null) c.trimInF += applied;
				c.fadeInF = Math.min(c.fadeInF, c.durationF);
			}
		} else {
			c.durationF += applied;
			if (isMediaClip(c)) c.fadeOutF = Math.min(c.fadeOutF, c.durationF);
		}
	};
	apply(clip);
	if (partner) apply(partner);
	return { ok: true, appliedF: applied };
}

// ---- roll / slip -----------------------------------------------------------

/**
 * Roll the edit point between two exactly-adjacent clips on one track: the
 * left clip's out and right clip's in move together; total length constant.
 * Returns the applied (clamped) delta.
 */
export function rollEdit(
	project: TimelineProject,
	leftId: string,
	rightId: string,
	deltaF: number
): TrimResult {
	const left = clipById(project, leftId);
	const right = clipById(project, rightId);
	if (!left || !right || left.trackId !== right.trackId) return fail('invalid');
	if (clipEndF(left) !== right.startF) return fail('invalid');
	if (isClipLocked(project, left) || isClipLocked(project, right)) return fail('locked');

	let min = CLIP_MIN_FRAMES - left.durationF; // shrink left
	let max = right.durationF - CLIP_MIN_FRAMES; // shrink right
	if (isMediaClip(left) && left.sourceDurationF !== null)
		max = Math.min(max, left.sourceDurationF - left.trimInF - left.durationF);
	if (isMediaClip(right) && right.sourceDurationF !== null) min = Math.max(min, -right.trimInF);

	const applied = Math.min(Math.max(deltaF, min), max);
	if (applied === 0) return { ok: true, appliedF: 0 };

	left.durationF += applied;
	right.startF += applied;
	right.durationF -= applied;
	if (isMediaClip(right) && right.sourceDurationF !== null) right.trimInF += applied;
	if (isMediaClip(left)) left.fadeOutF = Math.min(left.fadeOutF, left.durationF);
	if (isMediaClip(right)) right.fadeInF = Math.min(right.fadeInF, right.durationF);
	return { ok: true, appliedF: applied };
}

/**
 * Slip: slide the source content under a fixed timeline window. Only for
 * media with known source length longer than the clip.
 */
export function slipEdit(project: TimelineProject, clipId: string, deltaF: number): TrimResult {
	const clip = clipById(project, clipId);
	if (!clip || !isMediaClip(clip) || clip.sourceDurationF === null) return fail('invalid');
	if (isClipLocked(project, clip)) return fail('locked');
	const maxTrim = clip.sourceDurationF - clip.durationF;
	if (maxTrim <= 0) return fail('invalid');
	const next = Math.min(Math.max(clip.trimInF + deltaF, 0), maxTrim);
	const applied = next - clip.trimInF;
	clip.trimInF = next;
	return { ok: true, appliedF: applied };
}

// ---- clipboard ------------------------------------------------------------

/**
 * Track placement fallback shared by paste/duplicate: original track if every
 * span fits, else the nearest track by index distance (tie → above), else a
 * brand-new track appended on top. Clips from the same source track relocate
 * together (relative layout preserved).
 */
function placeTrackSets(
	project: TimelineProject,
	sets: Map<string, { clip: TimelineClip; startF: number }[]>,
	idgen: IdGen
): Map<string, string> | null {
	const assignment = new Map<string, string>();
	for (const [originalTrackId, entries] of sets) {
		const fits = (trackId: string): boolean => {
			const track = trackById(project, trackId);
			if (!track || track.locked) return false;
			return entries.every((e) =>
				spanFree(project, trackId, e.startF, e.startF + e.clip.durationF, new Set())
			);
		};
		if (fits(originalTrackId)) {
			assignment.set(originalTrackId, originalTrackId);
			continue;
		}
		const originalIndex = Math.max(
			0,
			project.tracks.findIndex((t) => t.id === originalTrackId)
		);
		const candidates = project.tracks
			.map((t, index) => ({ t, index }))
			.filter(({ t }) => t.id !== originalTrackId)
			.sort(
				(a, b) =>
					Math.abs(a.index - originalIndex) - Math.abs(b.index - originalIndex) || b.index - a.index // tie → above (higher index)
			);
		const found = candidates.find(({ t }) => fits(t.id));
		if (found) {
			assignment.set(originalTrackId, found.t.id);
		} else {
			const fresh = createTrackWith(idgen, `Track ${project.tracks.length + 1}`);
			project.tracks.push(fresh);
			assignment.set(originalTrackId, fresh.id);
		}
	}
	return assignment;
}

function createTrackWith(idgen: IdGen, name: string): TimelineTrack {
	const track = createTrack(name);
	return { ...track, id: idgen() };
}

export type PasteResult = { ok: true; newIds: string[] } | { ok: false; reason: OpFailReason };

/**
 * Paste clipboard clips with their lead edge at targetF. Group ids and link
 * ids are re-minted (pairs stay paired, but distinct from the source).
 */
export function pasteClips(
	project: TimelineProject,
	payload: TimelineClip[],
	targetF: number,
	idgen: IdGen = defaultIdGen
): PasteResult {
	if (payload.length === 0) return { ok: false, reason: 'invalid' };
	const minStart = Math.min(...payload.map((c) => c.startF));
	const offset = targetF - minStart;

	const groupMap = new Map<string, string>();
	const linkMap = new Map<string, string>();
	const incoming = payload.map((source) => {
		const clip = structuredClone(toPlainClip(source));
		clip.id = idgen();
		clip.startF = source.startF + offset;
		if (clip.groupId) {
			if (!groupMap.has(clip.groupId)) groupMap.set(clip.groupId, idgen());
			clip.groupId = groupMap.get(clip.groupId) ?? null;
		}
		if (isMediaClip(clip) && clip.linkId) {
			// Only keep a link when BOTH ends of the pair are in the payload.
			const pairPresent = payload.some(
				(p) => p.id !== source.id && isMediaClip(p) && p.linkId === clip.linkId
			);
			if (pairPresent) {
				if (!linkMap.has(clip.linkId)) linkMap.set(clip.linkId, idgen());
				clip.linkId = linkMap.get(clip.linkId) ?? null;
			} else {
				clip.linkId = null;
			}
		}
		return { clip, originalTrackId: source.trackId };
	});

	const sets = new Map<string, { clip: TimelineClip; startF: number }[]>();
	for (const e of incoming) {
		const list = sets.get(e.originalTrackId) ?? [];
		list.push({ clip: e.clip, startF: e.clip.startF });
		sets.set(e.originalTrackId, list);
	}
	const assignment = placeTrackSets(project, sets, idgen);
	if (!assignment) return { ok: false, reason: 'occupied' };

	for (const e of incoming) {
		e.clip.trackId = assignment.get(e.originalTrackId) ?? e.originalTrackId;
		project.clips.push(e.clip);
	}
	return { ok: true, newIds: incoming.map((e) => e.clip.id) };
}

function toPlainClip(clip: TimelineClip): TimelineClip {
	return JSON.parse(JSON.stringify(clip)) as TimelineClip;
}

/**
 * Deep-copy clips with fresh ids; group ids and (complete) link pairs are
 * re-minted so the copies stay grouped/linked together but independently of
 * the source. Does NOT insert into a project.
 */
export function cloneClipsPayload(
	clips: TimelineClip[],
	idgen: IdGen = defaultIdGen
): TimelineClip[] {
	const groupMap = new Map<string, string>();
	const linkMap = new Map<string, string>();
	return clips.map((source) => {
		const clip = toPlainClip(source);
		clip.id = idgen();
		if (clip.groupId) {
			if (!groupMap.has(clip.groupId)) groupMap.set(clip.groupId, idgen());
			clip.groupId = groupMap.get(clip.groupId) ?? null;
		}
		if (isMediaClip(clip) && clip.linkId) {
			const pairPresent = clips.some(
				(p) => p.id !== source.id && isMediaClip(p) && p.linkId === clip.linkId
			);
			if (pairPresent) {
				if (!linkMap.has(clip.linkId)) linkMap.set(clip.linkId, idgen());
				clip.linkId = linkMap.get(clip.linkId) ?? null;
			} else {
				clip.linkId = null;
			}
		}
		return clip;
	});
}

/** ⌘D: copies placed immediately after the selection's end, same tracks. */
export function duplicateClips(
	project: TimelineProject,
	clipIds: string[],
	idgen: IdGen = defaultIdGen
): PasteResult {
	const selection = clipIds
		.map((id) => clipById(project, id))
		.filter((c): c is TimelineClip => !!c);
	if (selection.length === 0) return { ok: false, reason: 'invalid' };
	const maxEnd = Math.max(...selection.map((c) => clipEndF(c)));
	return pasteClips(project, selection.map(toPlainClip), maxEnd, idgen) as PasteResult;
	// lead edge at maxEnd ⇒ every copy sits exactly (maxEnd − minStart) later.
}

// ---- detach / link ---------------------------------------------------------

/**
 * Detach a video clip's audio into a real audio clip on the nearest track
 * (after the source, by index) with a free span — or a new track. The pair
 * shares a fresh linkId; the video plays muted from then on.
 */
export function detachAudio(
	project: TimelineProject,
	clipId: string,
	idgen: IdGen = defaultIdGen
): OpResult & { audioClipId?: string } {
	const clip = clipById(project, clipId);
	if (!clip || !isMediaClip(clip) || clip.kind !== 'video') return fail('invalid');
	if (clip.audioDetached) return fail('no-audio');
	if (isClipLocked(project, clip)) return fail('locked');

	const sourceIndex = project.tracks.findIndex((t) => t.id === clip.trackId);
	const target = project.tracks.find(
		(t, index) =>
			index > sourceIndex &&
			!t.locked &&
			spanFree(project, t.id, clip.startF, clipEndF(clip), new Set())
	);
	let trackId: string;
	if (target) {
		trackId = target.id;
	} else {
		const fresh = createTrackWith(idgen, `Track ${project.tracks.length + 1}`);
		project.tracks.push(fresh);
		trackId = fresh.id;
	}

	const linkId = idgen();
	const audioClip: MediaClip = {
		id: idgen(),
		trackId,
		startF: clip.startF,
		durationF: clip.durationF,
		groupId: null,
		locked: false,
		name: clip.name,
		kind: 'audio',
		url: clip.url,
		assetId: clip.assetId,
		trimInF: clip.trimInF,
		sourceDurationF: clip.sourceDurationF,
		volume: clip.volume,
		fadeInF: 0,
		fadeOutF: 0,
		linkId
	};
	clip.linkId = linkId;
	clip.audioDetached = true;
	project.clips.push(audioClip);
	return { ok: true, audioClipId: audioClip.id };
}

export function unlinkClip(project: TimelineProject, clipId: string): OpResult {
	const clip = clipById(project, clipId);
	if (!clip || !isMediaClip(clip) || !clip.linkId) return fail('invalid');
	const partner = linkedPartner(project, clip);
	clip.linkId = null;
	if (partner) partner.linkId = null;
	return OK;
}

// ---- replace in place -------------------------------------------------------

/**
 * Swap a media clip's source keeping position/duration/fades; clamps the
 * source window when the new media is shorter.
 */
export function replaceClipSource(
	project: TimelineProject,
	clipId: string,
	item: BinItem,
	fps: number
): OpResult & { clamped?: boolean } {
	const clip = clipById(project, clipId);
	if (!clip || !isMediaClip(clip)) return fail('invalid');
	if (isClipLocked(project, clip)) return fail('locked');
	const newKind = clipKindForMediaType(item.mediaType);
	if (newKind !== clip.kind) return fail('invalid');

	const newSourceF = item.duration === null ? null : secToFrame(item.duration, fps);
	clip.url = item.url;
	clip.assetId = item.assetId;
	clip.name = item.name;
	clip.attribution = item.attribution;
	clip.sourceDurationF = newSourceF;

	let clamped = false;
	if (newSourceF !== null && clip.trimInF + clip.durationF > newSourceF) {
		clip.trimInF = 0;
		clip.durationF = Math.min(clip.durationF, newSourceF);
		clip.fadeInF = Math.min(clip.fadeInF, clip.durationF);
		clip.fadeOutF = Math.min(clip.fadeOutF, clip.durationF);
		clamped = true;
	}
	return { ok: true, clamped };
}

// ---- magnetic main track -----------------------------------------------------

/** Pack a track's clips back-to-back from frame 0 (CapCut main-track mode). */
export function magneticPack(project: TimelineProject, trackId: string): void {
	const clips = trackClipsSorted(project, trackId);
	let cursor = 0;
	for (const clip of clips) {
		clip.startF = cursor;
		cursor += clip.durationF;
	}
}
