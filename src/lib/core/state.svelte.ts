import { getContext, setContext } from 'svelte';
import { SvelteSet } from 'svelte/reactivity';
import {
	clipEndF,
	clipKindForMediaType,
	createTrack,
	defaultTextClipStyle,
	frameToSec,
	isMediaClip,
	secToFrame,
	MARKER_COLORS,
	TRACK_HEIGHT_MAX,
	TRACK_HEIGHT_MIN,
	ZOOM_MAX,
	ZOOM_MIN,
	type BinItem,
	type ClipTransition,
	type MediaClip,
	type ProjectBackground,
	type TextClip,
	type TextClipStyle,
	type TimelineAspectRatio,
	type TimelineClip,
	type TimelineFps,
	type TimelineMarker,
	type TimelineProject,
	type TimelineTrack
} from '../types/timeline.js';
import { uid } from '../utils.js';
import { PlaybackEngine } from './playback.js';
import {
	cloneClipsPayload,
	closeGap,
	detachAudio,
	duplicateClips,
	gapAt,
	insertGap,
	linkedPartner,
	pasteClips,
	placeClips,
	rangeDelete,
	replaceClipSource,
	resolveOverwrite,
	rippleDelete,
	rollEdit,
	slipEdit,
	splitAllAt,
	splitClips,
	trimClip,
	unlinkClip,
	magneticPack,
	isClipLocked,
	type Gap,
	type OpFailReason
} from './ops.js';

export type TimelineEditorDeps = {
	/** Debounced project-out; the host owns persistence. */
	emitChange: (project: TimelineProject) => void;
	/** Surface an aborted operation (toast etc.). */
	notify?: (reason: OpFailReason) => void;
	/** CapCut-style magnetic first track (host/prop controlled). */
	magneticMainTrack?: () => boolean;
	/** Debounce window (ms) for emitChange; 0 fires synchronously. */
	emitDebounceMs?: () => number;
};

export type DragState = {
	clipIds: string[];
	primaryId: string;
	/** Snapped horizontal delta, frames. */
	dxF: number;
	/** Cosmetic vertical float, px. */
	dyPx: number;
	targetTrackId: string | null;
	insert: boolean;
	duplicate: boolean;
};

const DEFAULT_EMIT_DEBOUNCE_MS = 800;
const UNDO_STACK_CAP = 100;
const IMAGE_DEFAULT_SECONDS = 4;
const TEXT_DEFAULT_SECONDS = 3;

// Module-level so the clipboard survives project switches within the session.
let clipboard: TimelineClip[] = [];

export class TimelineEditorStore {
	project = $state<TimelineProject>() as TimelineProject;
	/** Float seconds for smooth playback; quantized to frames at every edit. */
	playhead = $state(0);
	playing = $state(false);
	snapping = $state(true);
	loopRange = $state(false);
	followPlayhead = $state(true);
	selectedClipIds = new SvelteSet<string>();
	activeClipId = $state<string | null>(null);
	selectedGap = $state<Gap | null>(null);
	dragState = $state<DragState | null>(null);
	/** Bumped when the user explicitly asks to see a clip's options (e.g. taps a
	 * clip without dragging on mobile). The host editor watches this to open the
	 * inspector sheet — decoupled from selection so a drag doesn't trigger it. */
	inspectorRequestSeq = $state(0);
	canUndo = $state(false);
	canRedo = $state(false);

	readonly fps = $derived(this.project.fps);
	readonly playheadF = $derived(Math.round(this.playhead * this.project.fps));
	readonly durationF = $derived(
		this.project.clips.reduce((max, clip) => Math.max(max, clipEndF(clip)), 0)
	);
	readonly duration = $derived(frameToSec(this.durationF, this.project.fps));
	readonly clipsByTrack = $derived.by(() => {
		const map = new Map<string, TimelineClip[]>();
		for (const track of this.project.tracks) map.set(track.id, []);
		for (const clip of this.project.clips) map.get(clip.trackId)?.push(clip);
		for (const clips of map.values()) clips.sort((a, b) => a.startF - b.startF);
		return map;
	});
	readonly activeClip = $derived(
		this.activeClipId ? (this.project.clips.find((c) => c.id === this.activeClipId) ?? null) : null
	);
	readonly selectedClips = $derived(
		this.project.clips.filter((c) => this.selectedClipIds.has(c.id))
	);
	/** Link partners of the selection — highlighted but NOT selected. */
	readonly linkedHighlightIds = $derived.by(() => {
		const ids = new Set<string>();
		for (const clip of this.selectedClips) {
			const partner = linkedPartner(this.project, clip);
			if (partner && !this.selectedClipIds.has(partner.id)) ids.add(partner.id);
		}
		return ids;
	});
	readonly hasClipboard = $derived(clipboard.length > 0);

	readonly engine: PlaybackEngine;
	#deps: TimelineEditorDeps;
	#undoStack: string[] = [];
	#redoStack: string[] = [];
	#gestureSnapshot: string | null = null;
	#saveTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(project: TimelineProject, deps: TimelineEditorDeps) {
		this.project = project;
		this.#deps = deps;
		this.engine = new PlaybackEngine({
			getProject: () => this.project,
			getPlayhead: () => this.playhead,
			setPlayhead: (t) => (this.playhead = t),
			getDuration: () => this.duration,
			getLoopRange: () =>
				this.loopRange && this.project.range
					? {
							inSec: frameToSec(this.project.range.inFrame, this.project.fps),
							outSec: frameToSec(this.project.range.outFrame, this.project.fps)
						}
					: null,
			onEnded: () => (this.playing = false)
		});
	}

	destroy(): void {
		this.flush();
		this.engine.destroy();
	}

	// ---- transport -----------------------------------------------------

	seek(t: number): void {
		this.engine.seek(Math.min(Math.max(0, t), this.duration));
	}

	seekFrame(frame: number): void {
		this.seek(frameToSec(frame, this.project.fps));
	}

	stepFrames(delta: number): void {
		this.seekFrame(this.playheadF + delta);
	}

	play(): void {
		if (this.durationF <= 0) return;
		if (this.playhead >= this.duration) this.seek(0);
		this.playing = true;
		this.engine.play();
	}

	pause(): void {
		this.playing = false;
		this.engine.pause();
	}

	togglePlay(): void {
		if (this.playing) this.pause();
		else this.play();
	}

	// ---- selection -----------------------------------------------------

	selectClip(clipId: string, additive: boolean): void {
		this.selectedGap = null;
		const ids = this.#groupMemberIds(clipId);
		if (additive) {
			const allSelected = ids.every((id) => this.selectedClipIds.has(id));
			for (const id of ids) {
				if (allSelected) this.selectedClipIds.delete(id);
				else this.selectedClipIds.add(id);
			}
			this.activeClipId = allSelected ? null : clipId;
		} else {
			this.selectedClipIds.clear();
			for (const id of ids) this.selectedClipIds.add(id);
			this.activeClipId = clipId;
		}
	}

	selectGap(trackId: string, frame: number): void {
		const gap = gapAt(this.project, trackId, frame);
		this.selectedClipIds.clear();
		this.activeClipId = null;
		this.selectedGap = gap;
	}

	clearSelection(): void {
		this.selectedClipIds.clear();
		this.activeClipId = null;
		this.selectedGap = null;
	}

	/** Signal that the active clip's options should be shown (mobile sheet). */
	requestInspector(): void {
		this.inspectorRequestSeq++;
	}

	// ---- track mutations -------------------------------------------------

	addTrack(name: string): void {
		this.#mutate(() => {
			this.project.tracks.push(createTrack(name));
		});
	}

	removeTrack(trackId: string): void {
		this.#mutate(() => {
			this.project.tracks = this.project.tracks.filter((t) => t.id !== trackId);
			this.project.clips = this.project.clips.filter((c) => c.trackId !== trackId);
		});
		this.#pruneSelection();
	}

	renameTrack(trackId: string, name: string): void {
		const track = this.#track(trackId);
		const trimmed = name.trim();
		if (!track || !trimmed) return;
		this.#mutate(() => {
			track.name = trimmed;
		});
	}

	moveTrack(trackId: string, toIndex: number): void {
		const fromIndex = this.project.tracks.findIndex((t) => t.id === trackId);
		const clamped = Math.min(Math.max(0, toIndex), this.project.tracks.length - 1);
		if (fromIndex < 0 || fromIndex === clamped) return;
		this.#mutate(() => {
			const [track] = this.project.tracks.splice(fromIndex, 1);
			this.project.tracks.splice(clamped, 0, track);
		});
	}

	setTrackHeight(trackId: string, height: number): void {
		const track = this.#track(trackId);
		if (!track) return;
		this.#mutate(() => {
			track.height = Math.min(Math.max(TRACK_HEIGHT_MIN, Math.round(height)), TRACK_HEIGHT_MAX);
		});
	}

	toggleTrackMuted(trackId: string): void {
		this.#toggleTrack(trackId, 'muted');
		this.engine.refresh();
	}

	toggleTrackSolo(trackId: string): void {
		this.#toggleTrack(trackId, 'solo');
		this.engine.refresh();
	}

	toggleTrackHidden(trackId: string): void {
		this.#toggleTrack(trackId, 'hidden');
	}

	toggleTrackLocked(trackId: string): void {
		this.#toggleTrack(trackId, 'locked');
	}

	#toggleTrack(trackId: string, key: 'muted' | 'solo' | 'hidden' | 'locked'): void {
		const track = this.#track(trackId);
		if (!track) return;
		this.#mutate(() => {
			track[key] = !track[key];
		});
	}

	// ---- bin -----------------------------------------------------------

	addBinItems(items: BinItem[]): void {
		if (items.length === 0) return;
		this.#mutate(() => {
			this.project.bin.push(...items);
		});
	}

	removeBinItem(itemId: string): void {
		this.#mutate(() => {
			this.project.bin = this.project.bin.filter((b) => b.id !== itemId);
		});
	}

	// ---- clip creation ---------------------------------------------------

	#binItemToClip(item: BinItem, trackId: string, startF: number): MediaClip {
		const fps = this.project.fps;
		const durationF =
			item.duration === null
				? secToFrame(IMAGE_DEFAULT_SECONDS, fps)
				: secToFrame(item.duration, fps);
		return {
			id: uid(),
			trackId,
			startF: Math.max(0, startF),
			durationF,
			groupId: null,
			locked: false,
			name: item.name,
			kind: clipKindForMediaType(item.mediaType),
			url: item.url,
			assetId: item.assetId,
			trimInF: 0,
			sourceDurationF: item.duration === null ? null : secToFrame(item.duration, fps),
			volume: 1,
			fadeInF: 0,
			fadeOutF: 0,
			linkId: null,
			attribution: item.attribution
		};
	}

	addClipFromBin(item: BinItem, trackId: string, atF: number, insert: boolean): void {
		const clip = this.#binItemToClip(item, trackId, Math.round(atF));
		this.#op(() => {
			const result = insert
				? insertGap(this.project, clip.startF, clip.durationF, new Set(), undefined)
				: resolveOverwrite(
						this.project,
						trackId,
						clip.startF,
						clip.startF + clip.durationF,
						new Set()
					);
			if (!result.ok) return result;
			this.project.clips.push(clip);
			return { ok: true };
		});
		this.selectClip(clip.id, false);
	}

	addTextClip(trackId: string, atF: number, text: string): void {
		const clip: TextClip = {
			id: uid(),
			trackId,
			startF: Math.max(0, Math.round(atF)),
			durationF: secToFrame(TEXT_DEFAULT_SECONDS, this.project.fps),
			groupId: null,
			locked: false,
			name: text,
			kind: 'text',
			text,
			style: defaultTextClipStyle()
		};
		this.#op(() => {
			const result = resolveOverwrite(
				this.project,
				trackId,
				clip.startF,
				clip.startF + clip.durationF,
				new Set()
			);
			if (!result.ok) return result;
			this.project.clips.push(clip);
			return { ok: true };
		});
		this.selectClip(clip.id, false);
	}

	replaceClipFromBin(clipId: string, item: BinItem): boolean {
		let clamped = false;
		const ok = this.#op(() => {
			const result = replaceClipSource(this.project, clipId, item, this.project.fps);
			clamped = result.ok && result.clamped === true;
			return result;
		});
		return ok && clamped;
	}

	// ---- drag (visual-only; committed on drop) ----------------------------

	beginDrag(primaryId: string, duplicate: boolean): void {
		const ids = [...this.#groupMemberIds(primaryId)];
		// Linked partners follow the drag (and must be free to move).
		for (const id of [...ids]) {
			const clip = this.#clip(id);
			const partner = clip ? linkedPartner(this.project, clip) : null;
			if (partner && !ids.includes(partner.id)) ids.push(partner.id);
		}
		this.dragState = {
			clipIds: ids,
			primaryId,
			dxF: 0,
			dyPx: 0,
			targetTrackId: null,
			insert: false,
			duplicate
		};
		this.beginGesture();
	}

	updateDrag(patch: Partial<Omit<DragState, 'clipIds' | 'primaryId'>>): void {
		if (!this.dragState) return;
		Object.assign(this.dragState, patch);
	}

	commitDrag(): void {
		const drag = this.dragState;
		this.dragState = null;
		if (!drag) return;
		if (drag.dxF === 0 && !drag.targetTrackId && !drag.duplicate) {
			this.endGesture();
			return;
		}

		const sources = drag.clipIds.map((id) => this.#clip(id)).filter((c): c is TimelineClip => !!c);
		const targetOf = (sourceId: string, trackId: string): string =>
			sourceId === drag.primaryId && drag.targetTrackId ? drag.targetTrackId : trackId;

		let placedIds: string[] = [];
		this.#op(() => {
			if (drag.duplicate) {
				// Clones materialize directly at their destination via placeClips;
				// on failure they're removed again so nothing leaks mid-gesture.
				const clones = cloneClipsPayload($state.snapshot(sources) as TimelineClip[]);
				this.project.clips.push(...clones);
				const result = placeClips(
					this.project,
					clones.map((clone, i) => ({
						clipId: clone.id,
						startF: Math.max(0, sources[i].startF + drag.dxF),
						trackId: targetOf(sources[i].id, sources[i].trackId)
					})),
					drag.insert ? 'insert' : 'overwrite'
				);
				if (!result.ok) {
					const cloneIds = new Set(clones.map((c) => c.id));
					this.project.clips = this.project.clips.filter((c) => !cloneIds.has(c.id));
					return result;
				}
				placedIds = clones.map((c) => c.id);
				return result;
			}
			return placeClips(
				this.project,
				sources.map((clip) => ({
					clipId: clip.id,
					startF: Math.max(0, clip.startF + drag.dxF),
					trackId: targetOf(clip.id, clip.trackId)
				})),
				drag.insert ? 'insert' : 'overwrite'
			);
		});

		if (drag.duplicate && placedIds.length > 0) {
			this.selectedClipIds.clear();
			for (const id of placedIds) this.selectedClipIds.add(id);
			this.activeClipId = placedIds[0] ?? null;
		}
		this.endGesture();
		this.#pruneSelection();
	}

	/** Shift all selected (unlocked) clips by delta frames, clamped at 0. */
	nudgeSelected(deltaF: number): void {
		const clips = this.selectedClips.filter((c) => !isClipLocked(this.project, c));
		if (clips.length === 0) return;
		const minStart = Math.min(...clips.map((c) => c.startF));
		const applied = Math.max(deltaF, -minStart);
		if (applied === 0) return;
		this.#op(() =>
			placeClips(
				this.project,
				clips.map((c) => ({ clipId: c.id, startF: c.startF + applied, trackId: c.trackId })),
				'overwrite'
			)
		);
	}

	// ---- trim / roll / slip ------------------------------------------------

	trimClip(clipId: string, edge: 'left' | 'right', targetF: number): void {
		this.#op(() => trimClip(this.project, clipId, edge, Math.round(targetF)));
	}

	rollEdit(leftId: string, rightId: string, deltaF: number): void {
		this.#op(() => rollEdit(this.project, leftId, rightId, Math.round(deltaF)));
	}

	slipEdit(clipId: string, deltaF: number): void {
		this.#op(() => slipEdit(this.project, clipId, Math.round(deltaF)));
	}

	// ---- split / delete -----------------------------------------------------

	splitAtPlayhead(): void {
		const atF = this.playheadF;
		const ids =
			this.selectedClipIds.size > 0
				? [...this.selectedClipIds]
				: this.project.clips.filter((c) => c.startF < atF && atF < clipEndF(c)).map((c) => c.id);
		if (ids.length === 0) return;
		this.#op(() => splitClips(this.project, ids, atF));
	}

	splitAllAtPlayhead(): void {
		this.#op(() => splitAllAt(this.project, this.playheadF));
	}

	deleteSelected(): void {
		const removable = this.selectedClips.filter((c) => !isClipLocked(this.project, c));
		if (removable.length === 0) return;
		const ids = new Set(removable.map((c) => c.id));
		this.#mutate(() => {
			this.project.clips = this.project.clips.filter((c) => !ids.has(c.id));
		});
		this.#pruneSelection();
	}

	rippleDeleteSelected(): void {
		if (this.selectedClipIds.size === 0) return;
		this.#op(() => rippleDelete(this.project, [...this.selectedClipIds]));
		this.#pruneSelection();
	}

	closeSelectedGap(allTracks: boolean): void {
		const gap = this.selectedGap;
		if (!gap) return;
		const ok = this.#op(() => closeGap(this.project, gap, allTracks));
		if (ok) this.selectedGap = null;
	}

	deleteRange(): void {
		const range = this.project.range;
		if (!range) return;
		const ok = this.#op(() => rangeDelete(this.project, range.inFrame, range.outFrame));
		if (ok) {
			this.#mutateSilent(() => {
				this.project.range = null;
			});
			this.#pruneSelection();
		}
	}

	// ---- clipboard -----------------------------------------------------------

	copySelection(): void {
		if (this.selectedClips.length === 0) return;
		clipboard = JSON.parse(JSON.stringify(this.selectedClips)) as TimelineClip[];
	}

	cutSelection(): void {
		if (this.selectedClips.length === 0) return;
		this.copySelection();
		this.deleteSelected();
	}

	paste(): void {
		if (clipboard.length === 0) return;
		let newIds: string[] = [];
		const ok = this.#op(() => {
			const result = pasteClips(this.project, clipboard, this.playheadF);
			if (result.ok) newIds = result.newIds;
			return result;
		});
		if (ok && newIds.length > 0) {
			this.selectedClipIds.clear();
			for (const id of newIds) this.selectedClipIds.add(id);
			this.activeClipId = newIds[0];
		}
	}

	duplicateSelected(): void {
		if (this.selectedClipIds.size === 0) return;
		let newIds: string[] = [];
		const ok = this.#op(() => {
			const result = duplicateClips(this.project, [...this.selectedClipIds]);
			if (result.ok) newIds = result.newIds;
			return result;
		});
		if (ok && newIds.length > 0) {
			this.selectedClipIds.clear();
			for (const id of newIds) this.selectedClipIds.add(id);
			this.activeClipId = newIds[0];
		}
	}

	// ---- linked audio -----------------------------------------------------

	detachAudio(clipId: string): void {
		this.#op(() => detachAudio(this.project, clipId));
		this.engine.refresh();
	}

	toggleLink(clipId: string): void {
		const clip = this.#clip(clipId);
		if (!clip || !isMediaClip(clip) || !clip.linkId) return;
		this.#op(() => unlinkClip(this.project, clipId));
	}

	// ---- grouping / locking --------------------------------------------------

	groupSelection(): void {
		if (this.selectedClipIds.size < 2) return;
		// Toggle: if the whole selection is already one group, ungroup it instead
		// of re-grouping (which would just reassign a fresh id and recolor it).
		const selected = this.selectedClips;
		const firstGroup = selected[0]?.groupId ?? null;
		const alreadyOneGroup = firstGroup !== null && selected.every((c) => c.groupId === firstGroup);
		if (alreadyOneGroup) {
			this.ungroupSelection();
			return;
		}
		const groupId = uid();
		this.#mutate(() => {
			for (const clip of this.selectedClips) clip.groupId = groupId;
		});
	}

	ungroupSelection(): void {
		this.#mutate(() => {
			for (const clip of this.selectedClips) clip.groupId = null;
		});
	}

	toggleClipLock(clipId: string): void {
		const clip = this.#clip(clipId);
		if (!clip) return;
		const locked = !clip.locked;
		this.#mutate(() => {
			for (const id of this.#groupMemberIds(clipId)) {
				const member = this.#clip(id);
				if (member) member.locked = locked;
			}
		});
	}

	setClipVolume(clipId: string, volume: number): void {
		const clip = this.#clip(clipId);
		if (!clip || !isMediaClip(clip)) return;
		this.#mutate(() => {
			clip.volume = Math.min(Math.max(0, volume), 1);
		});
		this.engine.refresh();
	}

	setClipFade(clipId: string, edge: 'in' | 'out', frames: number): void {
		const clip = this.#clip(clipId);
		if (!clip || !isMediaClip(clip) || isClipLocked(this.project, clip)) return;
		this.#mutate(() => {
			const clamped = Math.min(Math.max(0, Math.round(frames)), clip.durationF);
			if (edge === 'in') clip.fadeInF = clamped;
			else clip.fadeOutF = clamped;
		});
	}

	/** Set or clear one side of a clip's enter/exit transition (media or text).
	 * Pass `null` to remove that side; clearing both drops `animation` entirely. */
	setClipAnimation(clipId: string, side: 'in' | 'out', transition: ClipTransition | null): void {
		const clip = this.#clip(clipId);
		if (!clip || isClipLocked(this.project, clip)) return;
		this.#mutate(() => {
			const anim = { ...(clip.animation ?? {}) };
			if (transition) {
				anim[side] = {
					...transition,
					durationF: Math.min(Math.max(1, Math.round(transition.durationF)), clip.durationF)
				};
			} else {
				delete anim[side];
			}
			clip.animation = anim.in || anim.out ? anim : undefined;
		});
	}

	addCrossfade(leftId: string, rightId: string): void {
		const left = this.#clip(leftId);
		const right = this.#clip(rightId);
		if (!left || !right || !isMediaClip(left) || !isMediaClip(right)) return;
		if (clipEndF(left) !== right.startF) return;
		const frames = Math.min(15, Math.floor(left.durationF / 2), Math.floor(right.durationF / 2));
		this.#mutate(() => {
			left.fadeOutF = frames;
			right.fadeInF = frames;
		});
	}

	updateTextClip(clipId: string, patch: { text?: string; style?: Partial<TextClipStyle> }): void {
		const clip = this.#clip(clipId);
		if (!clip || clip.kind !== 'text') return;
		this.#mutate(() => {
			if (patch.text !== undefined) {
				clip.text = patch.text;
				clip.name = patch.text;
			}
			if (patch.style) Object.assign(clip.style, patch.style);
		});
	}

	// ---- markers ---------------------------------------------------------------

	addMarkerAtPlayhead(): void {
		const marker: TimelineMarker = {
			id: uid(),
			frame: this.playheadF,
			color: MARKER_COLORS[this.project.markers.length % MARKER_COLORS.length],
			label: ''
		};
		this.#mutate(() => {
			this.project.markers.push(marker);
		});
	}

	updateMarker(id: string, patch: Partial<Omit<TimelineMarker, 'id'>>): void {
		const marker = this.project.markers.find((m) => m.id === id);
		if (!marker) return;
		this.#mutate(() => {
			Object.assign(marker, patch);
			if (patch.frame !== undefined) marker.frame = Math.max(0, Math.round(patch.frame));
		});
	}

	removeMarker(id: string): void {
		this.#mutate(() => {
			this.project.markers = this.project.markers.filter((m) => m.id !== id);
		});
	}

	jumpToMarker(direction: 1 | -1): void {
		const sorted = [...this.project.markers].sort((a, b) => a.frame - b.frame);
		const current = this.playheadF;
		const target =
			direction === 1
				? sorted.find((m) => m.frame > current)
				: [...sorted].reverse().find((m) => m.frame < current);
		if (target) this.seekFrame(target.frame);
	}

	// ---- in/out range ------------------------------------------------------------

	setRangeIn(): void {
		const inFrame = this.playheadF;
		this.#mutateSilent(() => {
			const out = this.project.range?.outFrame ?? Math.max(inFrame + 1, this.durationF);
			this.project.range = { inFrame, outFrame: Math.max(out, inFrame + 1) };
		});
	}

	setRangeOut(): void {
		const outFrame = this.playheadF;
		this.#mutateSilent(() => {
			const inF = Math.min(this.project.range?.inFrame ?? 0, Math.max(0, outFrame - 1));
			this.project.range = { inFrame: inF, outFrame: Math.max(outFrame, inF + 1) };
		});
	}

	clearRange(): void {
		this.#mutateSilent(() => {
			this.project.range = null;
		});
	}

	// ---- project settings ---------------------------------------------------------

	setAspectRatio(aspectRatio: TimelineAspectRatio): void {
		this.#mutate(() => {
			this.project.aspectRatio = aspectRatio;
		});
	}

	setFps(fps: TimelineFps): void {
		if (this.project.clips.length > 0) return; // locked once clips exist
		this.#mutate(() => {
			this.project.fps = fps;
		});
	}

	// `null` = transparent (no background). Safe to change anytime, like aspect
	// ratio (unlike fps, which changes the timebase).
	setBackground(background: ProjectBackground | null): void {
		this.#mutate(() => {
			this.project.background = background;
		});
	}

	setZoom(pxPerSecond: number): void {
		// View preference — persisted, but not undo-worthy.
		this.project.zoom = Math.min(Math.max(ZOOM_MIN, pxPerSecond), ZOOM_MAX);
		this.#scheduleEmit();
	}

	renameProject(name: string): void {
		const trimmed = name.trim();
		if (!trimmed) return;
		this.#mutate(() => {
			this.project.name = trimmed;
		});
	}

	// ---- snapping ---------------------------------------------------------------

	/** Candidate snap frames: clip edges, markers, the playhead, and 0. */
	snapCandidatesF(excludeIds: ReadonlySet<string>): number[] {
		const candidates = [0, this.playheadF];
		for (const clip of this.project.clips) {
			if (excludeIds.has(clip.id)) continue;
			candidates.push(clip.startF, clipEndF(clip));
		}
		for (const marker of this.project.markers) candidates.push(marker.frame);
		if (this.project.range) {
			candidates.push(this.project.range.inFrame, this.project.range.outFrame);
		}
		return candidates;
	}

	// ---- undo / redo -----------------------------------------------------------

	undo(): void {
		const snapshot = this.#undoStack.pop();
		if (snapshot === undefined) return;
		this.#redoStack.push(JSON.stringify(this.project));
		this.project = JSON.parse(snapshot) as TimelineProject;
		this.#afterRestore();
	}

	redo(): void {
		const snapshot = this.#redoStack.pop();
		if (snapshot === undefined) return;
		this.#undoStack.push(JSON.stringify(this.project));
		this.project = JSON.parse(snapshot) as TimelineProject;
		this.#afterRestore();
	}

	beginGesture(): void {
		if (this.#gestureSnapshot !== null) return;
		this.#gestureSnapshot = JSON.stringify(this.project);
	}

	endGesture(): void {
		if (this.#gestureSnapshot === null) return;
		const before = this.#gestureSnapshot;
		this.#gestureSnapshot = null;
		if (before !== JSON.stringify(this.project)) {
			this.#pushUndo(before);
			this.flush();
		}
	}

	flush(): void {
		if (this.#saveTimer !== null) {
			clearTimeout(this.#saveTimer);
			this.#saveTimer = null;
		}
		this.#deps.emitChange($state.snapshot(this.project));
	}

	// ---- internals -----------------------------------------------------------

	/** Plain mutation — always succeeds, one undo entry (unless mid-gesture). */
	#mutate(fn: () => void): void {
		if (this.#gestureSnapshot === null) this.#pushUndo(JSON.stringify(this.project));
		fn();
		this.#afterApply();
	}

	/** Mutation that's persisted but NOT undo-worthy (range markers etc.). */
	#mutateSilent(fn: () => void): void {
		fn();
		this.project.updatedAt = Date.now();
		this.#scheduleEmit();
	}

	/** Run a fallible op; push undo only when it applied. */
	#op(fn: () => { ok: boolean; reason?: OpFailReason }): boolean {
		if (this.#gestureSnapshot !== null) {
			const result = fn();
			if (!result.ok && result.reason) this.#deps.notify?.(result.reason);
			else this.#afterApply();
			return result.ok;
		}
		const snapshot = JSON.stringify(this.project);
		const result = fn();
		if (!result.ok) {
			if (result.reason) this.#deps.notify?.(result.reason);
			return false;
		}
		this.#pushUndo(snapshot);
		this.#afterApply();
		return true;
	}

	#afterApply(): void {
		if (this.#deps.magneticMainTrack?.() && this.project.tracks.length > 0) {
			magneticPack(this.project, this.project.tracks[0].id);
		}
		this.project.updatedAt = Date.now();
		this.#scheduleEmit();
	}

	#pushUndo(snapshot: string): void {
		this.#undoStack.push(snapshot);
		if (this.#undoStack.length > UNDO_STACK_CAP) this.#undoStack.shift();
		this.#redoStack = [];
		this.#syncUndoFlags();
	}

	#afterRestore(): void {
		this.#pruneSelection();
		this.#syncUndoFlags();
		this.seek(this.playhead);
		this.#scheduleEmit();
	}

	#syncUndoFlags(): void {
		this.canUndo = this.#undoStack.length > 0;
		this.canRedo = this.#redoStack.length > 0;
	}

	#scheduleEmit(): void {
		if (this.#saveTimer !== null) clearTimeout(this.#saveTimer);
		const debounce = this.#deps.emitDebounceMs?.() ?? DEFAULT_EMIT_DEBOUNCE_MS;
		if (debounce <= 0) {
			this.#deps.emitChange($state.snapshot(this.project));
			return;
		}
		this.#saveTimer = setTimeout(() => {
			this.#saveTimer = null;
			this.#deps.emitChange($state.snapshot(this.project));
		}, debounce);
	}

	#pruneSelection(): void {
		const existing = new Set(this.project.clips.map((c) => c.id));
		for (const id of [...this.selectedClipIds]) {
			if (!existing.has(id)) this.selectedClipIds.delete(id);
		}
		if (this.activeClipId && !existing.has(this.activeClipId)) this.activeClipId = null;
	}

	#clip(clipId: string): TimelineClip | undefined {
		return this.project.clips.find((c) => c.id === clipId);
	}

	#track(trackId: string): TimelineTrack | undefined {
		return this.project.tracks.find((t) => t.id === trackId);
	}

	#groupMemberIds(clipId: string): string[] {
		const clip = this.#clip(clipId);
		if (!clip) return [];
		if (!clip.groupId) return [clipId];
		const groupId = clip.groupId;
		return this.project.clips.filter((c) => c.groupId === groupId).map((c) => c.id);
	}
}

const KEY = Symbol.for('svelte-video-editor-editor');

export function setTimelineEditor(store: TimelineEditorStore): TimelineEditorStore {
	return setContext(KEY, store);
}

export function useTimelineEditor(): TimelineEditorStore {
	return getContext<TimelineEditorStore>(KEY);
}
