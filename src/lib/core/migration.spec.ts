import { describe, expect, it } from 'vitest';
import { migrateProject } from './migration.js';

function v1Project(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: 1,
		id: 'p1',
		workspaceId: 'ws1',
		name: 'Test',
		aspectRatio: '16:9',
		tracks: [
			{
				id: 't1',
				kind: 'video',
				name: 'Track 1',
				muted: false,
				hidden: false,
				locked: false,
				height: 56
			}
		],
		clips: [
			{
				id: 'c1',
				trackId: 't1',
				timelineStart: 1.5,
				duration: 4.25,
				groupId: null,
				locked: false,
				name: 'clip',
				kind: 'video',
				url: 'https://x/v.mp4',
				trimIn: 0.5,
				sourceDuration: 10,
				volume: 1
			}
		],
		bin: [],
		zoom: 50,
		createdAt: 1,
		updatedAt: 2,
		...overrides
	};
}

describe('migrateProject v1 → v2', () => {
	it('converts seconds to frames at fps 30 with rounding', () => {
		const p = migrateProject(v1Project());
		expect(p.schemaVersion).toBe(2);
		expect(p.fps).toBe(30);
		const clip = p.clips[0];
		expect(clip.startF).toBe(45); // 1.5 * 30
		expect(clip.durationF).toBe(128); // round(4.25 * 30)
		expect('trimInF' in clip && clip.trimInF).toBe(15);
		expect('sourceDurationF' in clip && clip.sourceDurationF).toBe(300);
	});

	it('adds v2 defaults: solo, fades, linkId, markers, range', () => {
		const p = migrateProject(v1Project());
		expect(p.tracks[0].solo).toBe(false);
		expect(p.markers).toEqual([]);
		expect(p.range).toBeNull();
		const clip = p.clips[0];
		if (clip.kind !== 'text') {
			expect(clip.fadeInF).toBe(0);
			expect(clip.fadeOutF).toBe(0);
			expect(clip.linkId).toBeNull();
		}
	});

	it('drops the legacy track kind field', () => {
		const p = migrateProject(v1Project());
		expect('kind' in p.tracks[0]).toBe(false);
	});

	it('normalizes same-track overlaps by head-trimming the later clip', () => {
		const p = migrateProject(
			v1Project({
				clips: [
					{
						id: 'a',
						trackId: 't1',
						timelineStart: 0,
						duration: 5,
						groupId: null,
						locked: false,
						name: 'a',
						kind: 'video',
						url: 'u',
						trimIn: 0,
						sourceDuration: 10,
						volume: 1
					},
					{
						id: 'b',
						trackId: 't1',
						timelineStart: 3,
						duration: 5,
						groupId: null,
						locked: false,
						name: 'b',
						kind: 'video',
						url: 'u',
						trimIn: 0,
						sourceDuration: 10,
						volume: 1
					}
				]
			})
		);
		const a = p.clips.find((c) => c.id === 'a');
		const b = p.clips.find((c) => c.id === 'b');
		expect(a?.startF).toBe(0);
		expect(a?.durationF).toBe(150);
		expect(b?.startF).toBe(150); // trimmed to a's end
		expect(b?.durationF).toBe(90); // 240 - 150
		if (b && b.kind !== 'text') expect(b.trimInF).toBe(60); // head trim advances source in
	});

	it('drops clips fully swallowed by an overlap', () => {
		const p = migrateProject(
			v1Project({
				clips: [
					{
						id: 'a',
						trackId: 't1',
						timelineStart: 0,
						duration: 10,
						groupId: null,
						locked: false,
						name: 'a',
						kind: 'image',
						url: 'u',
						trimIn: 0,
						sourceDuration: null,
						volume: 1
					},
					{
						id: 'b',
						trackId: 't1',
						timelineStart: 2,
						duration: 3,
						groupId: null,
						locked: false,
						name: 'b',
						kind: 'image',
						url: 'u',
						trimIn: 0,
						sourceDuration: null,
						volume: 1
					}
				]
			})
		);
		expect(p.clips.map((c) => c.id)).toEqual(['a']);
	});

	it('drops clips on missing tracks', () => {
		const p = migrateProject(
			v1Project({
				clips: [
					{
						id: 'orphan',
						trackId: 'gone',
						timelineStart: 0,
						duration: 1,
						groupId: null,
						locked: false,
						name: 'x',
						kind: 'image',
						url: 'u',
						trimIn: 0,
						sourceDuration: null,
						volume: 1
					}
				]
			})
		);
		expect(p.clips).toEqual([]);
	});

	it('is idempotent on v2 input (frames preserved, no double conversion)', () => {
		const v2 = migrateProject(v1Project());
		const again = migrateProject(JSON.parse(JSON.stringify(v2)));
		expect(again).toEqual(v2);
	});

	it('migrates text clips', () => {
		const p = migrateProject(
			v1Project({
				clips: [
					{
						id: 'txt',
						trackId: 't1',
						timelineStart: 2,
						duration: 3,
						groupId: null,
						locked: false,
						name: 'Hello',
						kind: 'text',
						text: 'Hello',
						style: { fontSizePct: 6 }
					}
				]
			})
		);
		const clip = p.clips[0];
		expect(clip.kind).toBe('text');
		expect(clip.startF).toBe(60);
		expect(clip.durationF).toBe(90);
	});
});
