import { describe, expect, it } from 'vitest';
import type { MediaClip, TimelineProject, TimelineTrack } from '../types/timeline.js';
import {
	closeGap,
	detachAudio,
	duplicateClips,
	gapAt,
	pasteClips,
	placeClips,
	rangeDelete,
	rippleDelete,
	rollEdit,
	slipEdit,
	splitAllAt,
	trimClip,
	unlinkClip
} from './ops.js';

let nextId = 0;
const idgen = () => `id-${++nextId}`;

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

function clip(
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

function project(tracks: TimelineTrack[], clips: MediaClip[]): TimelineProject {
	return {
		schemaVersion: 2,
		id: 'p',
		workspaceId: 'w',
		name: 'p',
		aspectRatio: '16:9',
		fps: 30,
		tracks,
		clips,
		markers: [],
		range: null,
		bin: [],
		zoom: 50,
		createdAt: 0,
		updatedAt: 0
	};
}

// All fixtures in this suite are media clips.
const byId = (p: TimelineProject, id: string) =>
	p.clips.find((c) => c.id === id) as MediaClip | undefined;

describe('rippleDelete', () => {
	it('shifts clips left across ALL tracks by the deleted span', () => {
		const p = project(
			[track('t1'), track('t2')],
			[clip('a', 't1', 0, 100), clip('b', 't1', 100, 50), clip('c', 't2', 200, 30)]
		);
		expect(rippleDelete(p, ['b'])).toEqual({ ok: true });
		expect(byId(p, 'b')).toBeUndefined();
		expect(byId(p, 'a')?.startF).toBe(0);
		expect(byId(p, 'c')?.startF).toBe(150); // shifted on the OTHER track too
	});

	it('aborts when an unselected clip overlaps the span', () => {
		const p = project(
			[track('t1'), track('t2')],
			[clip('a', 't1', 100, 50), clip('x', 't2', 120, 10)]
		);
		expect(rippleDelete(p, ['a'])).toEqual({ ok: false, reason: 'not-contiguous' });
		expect(byId(p, 'a')).toBeDefined(); // nothing applied
	});

	it('aborts when a locked clip would need to shift', () => {
		const p = project(
			[track('t1')],
			[clip('a', 't1', 0, 50), clip('b', 't1', 100, 50, { locked: true })]
		);
		expect(rippleDelete(p, ['a'])).toEqual({ ok: false, reason: 'locked' });
		expect(byId(p, 'b')?.startF).toBe(100);
	});
});

describe('gaps', () => {
	it('finds the gap containing a frame', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 50), clip('b', 't1', 80, 20)]);
		expect(gapAt(p, 't1', 60)).toEqual({ trackId: 't1', startF: 50, endF: 80 });
		expect(gapAt(p, 't1', 30)).toBeNull(); // inside a clip
		expect(gapAt(p, 't1', 200)).toBeNull(); // trailing space
	});

	it('closes a gap on a single track', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 50), clip('b', 't1', 80, 20)]);
		expect(closeGap(p, { trackId: 't1', startF: 50, endF: 80 }, false)).toEqual({ ok: true });
		expect(byId(p, 'b')?.startF).toBe(50);
	});

	it('closing across all tracks clamps to available room on other tracks', () => {
		const p = project(
			[track('t1'), track('t2')],
			[
				clip('a', 't1', 0, 50),
				clip('b', 't1', 80, 20),
				clip('x', 't2', 0, 70), // only 10 frames of room before t2's shifted clip
				clip('y', 't2', 80, 10)
			]
		);
		expect(closeGap(p, { trackId: 't1', startF: 50, endF: 80 }, true)).toEqual({ ok: true });
		expect(byId(p, 'b')?.startF).toBe(70); // clamped shift of 10
		expect(byId(p, 'y')?.startF).toBe(70);
	});

	it('aborts when a stationary clip leaves no room', () => {
		const p = project(
			[track('t1'), track('t2')],
			[
				clip('a', 't1', 0, 50),
				clip('b', 't1', 80, 20),
				clip('x', 't2', 0, 85), // spans the gap end
				clip('y', 't2', 85, 10)
			]
		);
		expect(closeGap(p, { trackId: 't1', startF: 50, endF: 80 }, true)).toEqual({
			ok: false,
			reason: 'occupied'
		});
	});
});

describe('placeClips — overwrite vs insert', () => {
	it('overwrite trims the head of an overlapped clip', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 100), clip('m', 't1', 200, 50)]);
		expect(placeClips(p, [{ clipId: 'm', startF: 80, trackId: 't1' }], 'overwrite', idgen)).toEqual(
			{ ok: true }
		);
		expect(byId(p, 'm')?.startF).toBe(80);
		expect(byId(p, 'a')?.durationF).toBe(80); // tail trimmed to the incoming head
	});

	it('overwrite splits a clip fully straddled by the incoming one', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 200), clip('m', 't1', 300, 50)]);
		expect(placeClips(p, [{ clipId: 'm', startF: 50, trackId: 't1' }], 'overwrite', idgen)).toEqual(
			{ ok: true }
		);
		const pieces = p.clips
			.filter((c) => c.id !== 'm')
			.sort((a, b) => a.startF - b.startF) as MediaClip[];
		expect(pieces).toHaveLength(2);
		expect(pieces[0].startF).toBe(0);
		expect(pieces[0].durationF).toBe(50);
		expect(pieces[1].startF).toBe(100);
		expect(pieces[1].durationF).toBe(100);
		expect(pieces[1].trimInF).toBe(100); // head cut advances source in-point
	});

	it('overwrite removes fully covered clips', () => {
		const p = project([track('t1')], [clip('a', 't1', 20, 10), clip('m', 't1', 200, 100)]);
		expect(placeClips(p, [{ clipId: 'm', startF: 0, trackId: 't1' }], 'overwrite', idgen)).toEqual({
			ok: true
		});
		expect(byId(p, 'a')).toBeUndefined();
	});

	it('overwrite aborts on locked victims without mutating', () => {
		const p = project(
			[track('t1')],
			[clip('a', 't1', 0, 100, { locked: true }), clip('m', 't1', 200, 50)]
		);
		expect(placeClips(p, [{ clipId: 'm', startF: 50, trackId: 't1' }], 'overwrite', idgen)).toEqual(
			{ ok: false, reason: 'locked' }
		);
		expect(byId(p, 'm')?.startF).toBe(200);
		expect(byId(p, 'a')?.durationF).toBe(100);
	});

	it('insert splits at the drop point and ripples all tracks right', () => {
		const p = project(
			[track('t1'), track('t2')],
			[clip('a', 't1', 0, 100), clip('x', 't2', 50, 100), clip('m', 't2', 500, 60)]
		);
		expect(placeClips(p, [{ clipId: 'm', startF: 40, trackId: 't1' }], 'insert', idgen)).toEqual({
			ok: true
		});
		expect(byId(p, 'm')?.startF).toBe(40);
		expect(byId(p, 'm')?.trackId).toBe('t1');
		// a was split at 40; its tail shifted right by m's duration (60)
		const aTail = p.clips.find((c) => c.id !== 'a' && c.trackId === 't1' && c.id !== 'm');
		expect(byId(p, 'a')?.durationF).toBe(40);
		expect(aTail?.startF).toBe(100);
		expect(aTail && 'trimInF' in aTail && aTail.trimInF).toBe(40);
		// x starts after the drop point → not split, just shifted right by 60
		expect(byId(p, 'x')?.startF).toBe(110);
		expect(byId(p, 'x')?.durationF).toBe(100);
	});
});

describe('trimClip', () => {
	it('clamps right-edge extension at the next clip (no overlap)', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 50), clip('b', 't1', 80, 20)]);
		const r = trimClip(p, 'a', 'right', 200);
		expect(r.ok).toBe(true);
		expect(byId(p, 'a')?.durationF).toBe(80); // stopped at b's start
	});

	it('clamps left-edge extension at source head and previous clip', () => {
		const p = project(
			[track('t1')],
			[clip('a', 't1', 0, 30), clip('b', 't1', 50, 50, { trimInF: 10 })]
		);
		const r = trimClip(p, 'b', 'left', 0);
		expect(r.ok).toBe(true);
		// b can extend left by min(trimIn=10, gap to a's end=20) = 10
		expect(byId(p, 'b')?.startF).toBe(40);
		expect(byId(p, 'b')?.trimInF).toBe(0);
	});

	it('propagates trim to a linked partner and clamps jointly', () => {
		const p = project(
			[track('t1'), track('t2')],
			[
				clip('v', 't1', 0, 100, { linkId: 'L' }),
				clip('aud', 't2', 0, 100, { kind: 'audio', linkId: 'L', trimInF: 0, sourceDurationF: 120 })
			]
		);
		const r = trimClip(p, 'v', 'right', 300);
		expect(r.ok).toBe(true);
		// joint clamp: audio source allows only +20
		expect(byId(p, 'v')?.durationF).toBe(120);
		expect(byId(p, 'aud')?.durationF).toBe(120);
	});

	it('aborts when the linked partner is locked', () => {
		const p = project(
			[track('t1'), track('t2')],
			[
				clip('v', 't1', 0, 100, { linkId: 'L' }),
				clip('aud', 't2', 0, 100, { kind: 'audio', linkId: 'L', locked: true })
			]
		);
		expect(trimClip(p, 'v', 'right', 150)).toEqual({ ok: false, reason: 'locked' });
		expect(byId(p, 'v')?.durationF).toBe(100);
	});
});

describe('roll / slip', () => {
	it('rolls the edit point keeping total duration constant', () => {
		const p = project(
			[track('t1')],
			[clip('a', 't1', 0, 100), clip('b', 't1', 100, 100, { trimInF: 50 })]
		);
		const r = rollEdit(p, 'a', 'b', 30);
		expect(r).toEqual({ ok: true, appliedF: 30 });
		expect(byId(p, 'a')?.durationF).toBe(130);
		expect(byId(p, 'b')?.startF).toBe(130);
		expect(byId(p, 'b')?.durationF).toBe(70);
		expect(byId(p, 'b')?.trimInF).toBe(80);
	});

	it('clamps roll by the left clip source length', () => {
		const p = project(
			[track('t1')],
			[clip('a', 't1', 0, 100, { sourceDurationF: 110 }), clip('b', 't1', 100, 100)]
		);
		const r = rollEdit(p, 'a', 'b', 50);
		expect(r).toEqual({ ok: true, appliedF: 10 });
	});

	it('rejects roll on non-adjacent clips', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 90), clip('b', 't1', 100, 100)]);
		expect(rollEdit(p, 'a', 'b', 10)).toEqual({ ok: false, reason: 'invalid' });
	});

	it('slips source in/out within bounds', () => {
		const p = project(
			[track('t1')],
			[clip('a', 't1', 0, 100, { trimInF: 20, sourceDurationF: 150 })]
		);
		expect(slipEdit(p, 'a', 100)).toEqual({ ok: true, appliedF: 30 }); // clamp at 50
		expect(byId(p, 'a')?.trimInF).toBe(50);
		expect(byId(p, 'a')?.startF).toBe(0); // timeline window unchanged
		expect(byId(p, 'a')?.durationF).toBe(100);
	});
});

describe('clipboard placement', () => {
	it('pastes at the playhead on original tracks when free', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 50)]);
		const r = pasteClips(p, [structuredClone(byId(p, 'a'))!], 100, idgen);
		expect(r.ok).toBe(true);
		const pasted = p.clips.find((c) => c.id !== 'a');
		expect(pasted?.startF).toBe(100);
		expect(pasted?.trackId).toBe('t1');
	});

	it('falls back to the nearest free track (tie → above)', () => {
		const p = project(
			[track('t1'), track('t2'), track('t3')],
			[clip('a', 't2', 0, 50), clip('blockA', 't2', 90, 50)]
		);
		const r = pasteClips(p, [structuredClone(byId(p, 'a'))!], 100, idgen);
		expect(r.ok).toBe(true);
		const pasted = p.clips.find((c) => !['a', 'blockA'].includes(c.id));
		expect(pasted?.trackId).toBe('t3'); // tie between t1/t3 → above wins
	});

	it('creates a new track when nothing fits', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 50), clip('block', 't1', 60, 100)]);
		const r = pasteClips(p, [structuredClone(byId(p, 'a'))!], 80, idgen);
		expect(r.ok).toBe(true);
		expect(p.tracks).toHaveLength(2);
		const pasted = p.clips.find((c) => !['a', 'block'].includes(c.id));
		expect(pasted?.trackId).toBe(p.tracks[1].id);
	});

	it('re-mints group ids keeping pasted clips grouped together', () => {
		const p = project(
			[track('t1'), track('t2')],
			[clip('a', 't1', 0, 50, { groupId: 'g' }), clip('b', 't2', 0, 50, { groupId: 'g' })]
		);
		const payload = [structuredClone(byId(p, 'a'))!, structuredClone(byId(p, 'b'))!];
		const r = pasteClips(p, payload, 100, idgen);
		expect(r.ok).toBe(true);
		const pasted = p.clips.filter((c) => !['a', 'b'].includes(c.id));
		expect(pasted[0].groupId).toBe(pasted[1].groupId);
		expect(pasted[0].groupId).not.toBe('g');
	});

	it('duplicates immediately after the selection end', () => {
		const p = project([track('t1')], [clip('a', 't1', 10, 50)]);
		const r = duplicateClips(p, ['a'], idgen);
		expect(r.ok).toBe(true);
		const dup = p.clips.find((c) => c.id !== 'a');
		expect(dup?.startF).toBe(60);
	});
});

describe('rangeDelete', () => {
	it('removes the range and closes it across all tracks', () => {
		const p = project(
			[track('t1'), track('t2')],
			[clip('a', 't1', 0, 200), clip('x', 't2', 150, 100)]
		);
		expect(rangeDelete(p, 50, 100, idgen)).toEqual({ ok: true });
		// a was split: head [0,50), tail starts at 50 after shift
		const t1 = p.clips
			.filter((c) => c.trackId === 't1')
			.sort((a, b) => a.startF - b.startF) as MediaClip[];
		expect(t1[0].durationF).toBe(50);
		expect(t1[1].startF).toBe(50);
		expect(t1[1].trimInF).toBe(100);
		expect(byId(p, 'x')?.startF).toBe(100); // shifted left by 50
	});

	it('aborts on locked intersecting clips', () => {
		const p = project([track('t1')], [clip('a', 't1', 0, 200, { locked: true })]);
		expect(rangeDelete(p, 50, 100, idgen)).toEqual({ ok: false, reason: 'locked' });
	});
});

describe('detach / link', () => {
	it('detaches audio to the next free track and links the pair', () => {
		const p = project([track('t1'), track('t2')], [clip('v', 't1', 30, 100)]);
		const r = detachAudio(p, 'v', idgen);
		expect(r.ok).toBe(true);
		const audio = p.clips.find((c) => c.kind === 'audio') as MediaClip | undefined;
		expect(audio?.trackId).toBe('t2');
		expect(audio?.startF).toBe(30);
		expect(audio?.durationF).toBe(100);
		const v = byId(p, 'v');
		expect(v?.audioDetached).toBe(true);
		expect(v?.linkId).toBe(audio?.linkId);
	});

	it('creates a new track when no free span exists below', () => {
		const p = project(
			[track('t1'), track('t2')],
			[clip('v', 't1', 0, 100), clip('x', 't2', 50, 100)]
		);
		expect(detachAudio(p, 'v', idgen).ok).toBe(true);
		expect(p.tracks).toHaveLength(3);
	});

	it('unlink clears both ends', () => {
		const p = project(
			[track('t1'), track('t2')],
			[
				clip('v', 't1', 0, 100, { linkId: 'L' }),
				clip('aud', 't2', 0, 100, { kind: 'audio', linkId: 'L' })
			]
		);
		expect(unlinkClip(p, 'v')).toEqual({ ok: true });
		expect(byId(p, 'v')?.linkId).toBeNull();
		expect(byId(p, 'aud')?.linkId).toBeNull();
	});
});

describe('splitAllAt', () => {
	it('splits every unlocked clip under the playhead', () => {
		const p = project(
			[track('t1'), track('t2'), track('t3', { locked: true })],
			[
				clip('a', 't1', 0, 100),
				clip('b', 't2', 50, 100),
				clip('c', 't2', 200, 50), // not under playhead
				clip('d', 't3', 0, 100) // locked track
			]
		);
		const r = splitAllAt(p, 80, idgen);
		expect(r.newIds).toHaveLength(2);
		expect(byId(p, 'a')?.durationF).toBe(80);
		expect(byId(p, 'b')?.durationF).toBe(30);
		expect(byId(p, 'c')?.durationF).toBe(50);
		expect(byId(p, 'd')?.durationF).toBe(100);
	});
});
