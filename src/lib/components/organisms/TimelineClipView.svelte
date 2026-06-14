<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { cn } from '../../utils.js';
	import {
		Copy,
		Film,
		Image as ImageIcon,
		Link2,
		Lock,
		LockOpen,
		Music,
		Scissors,
		SplitSquareHorizontal,
		Trash2,
		Type,
		Unlink,
		Volume1
	} from '@lucide/svelte';
	import { ContextMenu } from '../atoms/index.js';
	import {
		clipEndF,
		clipHasAudio,
		isMediaClip,
		type TimelineClip,
		type TimelineTrack
	} from '../../types/timeline.js';
	import {
		formatTimecode,
		frameToPx,
		groupColor,
		pxToFrame,
		SNAP_PX
	} from '../../core/geometry.js';
	import { linkedPartner, isClipLocked } from '../../core/ops.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';

	const t = useMessages();

	type Props = {
		clip: TimelineClip;
		track: TimelineTrack;
		/** Previous clip on this track whose end exactly touches this start. */
		prevAdjacentId: string | null;
		findTrackAt: (clientY: number, clip: TimelineClip) => string | null;
		onRequestDelete: () => void;
	};

	let { clip, track, prevAdjacentId, findTrackAt, onRequestDelete }: Props = $props();

	const editor = useTimelineEditor();
	const fps = $derived(editor.project.fps);
	const zoom = $derived(editor.project.zoom);
	const selected = $derived(editor.selectedClipIds.has(clip.id));
	const linkedHighlight = $derived(editor.linkedHighlightIds.has(clip.id));
	const locked = $derived(clip.locked || track.locked);
	const partner = $derived(isMediaClip(clip) ? linkedPartner(editor.project, clip) : null);
	const linkBroken = $derived(isMediaClip(clip) && clip.linkId !== null && partner === null);
	const hasAudio = $derived(clipHasAudio(clip));

	const drag = $derived(editor.dragState);
	const inDrag = $derived(drag?.clipIds.includes(clip.id) ?? false);
	const isDragPrimary = $derived(drag?.primaryId === clip.id);
	const dragDxPx = $derived(inDrag && drag ? frameToPx(drag.dxF, fps, zoom) : 0);
	const dragDyPx = $derived(isDragPrimary && drag ? drag.dyPx : 0);

	const kindClasses: Record<TimelineClip['kind'], string> = {
		video: 'bg-indigo-500/60 border-indigo-400/70',
		image: 'bg-sky-500/60 border-sky-400/70',
		audio: 'bg-emerald-500/60 border-emerald-400/70',
		text: 'bg-amber-500/60 border-amber-400/70'
	};

	type DragMode = 'move' | 'trim-left' | 'trim-right' | 'slip' | 'roll' | 'fade-in' | 'fade-out';
	let dragMode: DragMode | null = null;
	let originX = 0;
	let originClientY = 0;
	let originStartF = 0;
	let originEndF = 0;
	let lastX = 0;
	let excludeIds = new Set<string>();
	let slipping = $state(false);

	function snappedF(targetF: number, bypass: boolean): number {
		if (!editor.snapping || bypass) return Math.round(targetF);
		const candidates = editor.snapCandidatesF(excludeIds);
		const thresholdF = pxToFrame(SNAP_PX, fps, zoom);
		let best = Math.round(targetF);
		let bestDist = thresholdF;
		for (const c of candidates) {
			const d = Math.abs(c - targetF);
			if (d < bestDist) {
				best = c;
				bestDist = d;
			}
		}
		return best;
	}

	// Try snapping the start edge first; if it doesn't bite, try the end edge.
	function snappedMoveDeltaF(rawDeltaF: number, bypass: boolean): number {
		const target = Math.max(0, originStartF + rawDeltaF);
		if (!editor.snapping || bypass) return Math.round(target) - originStartF;
		const byStart = snappedF(target, false);
		if (byStart !== Math.round(target)) return byStart - originStartF;
		const end = target + clip.durationF;
		const byEnd = snappedF(end, false);
		if (byEnd !== Math.round(end)) return byEnd - clip.durationF - originStartF;
		return Math.round(target) - originStartF;
	}

	function capture(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function dragMembers(): Set<string> {
		const ids = new Set(
			clip.groupId
				? editor.project.clips.filter((c) => c.groupId === clip.groupId).map((c) => c.id)
				: [clip.id]
		);
		if (partner) ids.add(partner.id);
		return ids;
	}

	function onBodyPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.stopPropagation();
		const meta = e.metaKey || e.ctrlKey;
		if (meta && e.altKey) {
			// ⌘⌥-drag = slip (media with spare source only)
			if (!selected) editor.selectClip(clip.id, false);
			if (locked || !isMediaClip(clip) || clip.sourceDurationF === null) return;
			if (clip.sourceDurationF <= clip.durationF) return;
			dragMode = 'slip';
			slipping = true;
			lastX = e.clientX;
			capture(e);
			editor.beginGesture();
			return;
		}
		if (meta) {
			editor.selectClip(clip.id, true);
			return;
		}
		if (!selected) editor.selectClip(clip.id, false);
		else editor.activeClipId = clip.id;
		if (locked) return;
		dragMode = 'move';
		originX = e.clientX;
		originClientY = e.clientY;
		originStartF = clip.startF;
		excludeIds = dragMembers();
		capture(e);
		editor.beginDrag(clip.id, e.altKey);
	}

	function onTrimPointerDown(e: PointerEvent, mode: 'trim-left' | 'trim-right') {
		if (e.button !== 0 || locked) return;
		e.stopPropagation();
		if (!selected) editor.selectClip(clip.id, false);
		dragMode = mode;
		originX = e.clientX;
		originStartF = clip.startF;
		originEndF = clipEndF(clip);
		excludeIds = new Set([clip.id, ...(partner ? [partner.id] : [])]);
		capture(e);
		editor.beginGesture();
	}

	function onRollPointerDown(e: PointerEvent) {
		if (e.button !== 0 || locked || !prevAdjacentId) return;
		e.stopPropagation();
		dragMode = 'roll';
		lastX = e.clientX;
		capture(e);
		editor.beginGesture();
	}

	function onFadePointerDown(e: PointerEvent, mode: 'fade-in' | 'fade-out') {
		if (e.button !== 0 || locked) return;
		e.stopPropagation();
		dragMode = mode;
		capture(e);
		editor.beginGesture();
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragMode) return;
		const rawDeltaF = pxToFrame(e.clientX - originX, fps, zoom);
		if (dragMode === 'move') {
			const dxF = snappedMoveDeltaF(rawDeltaF, e.shiftKey);
			const hovered = findTrackAt(e.clientY, clip);
			editor.updateDrag({
				dxF,
				dyPx: e.clientY - originClientY,
				targetTrackId: hovered && hovered !== clip.trackId ? hovered : null,
				insert: e.metaKey || e.ctrlKey
			});
		} else if (dragMode === 'trim-left') {
			editor.trimClip(clip.id, 'left', snappedF(originStartF + rawDeltaF, e.shiftKey));
		} else if (dragMode === 'trim-right') {
			editor.trimClip(clip.id, 'right', snappedF(originEndF + rawDeltaF, e.shiftKey));
		} else if (dragMode === 'slip') {
			const stepF = pxToFrame(e.clientX - lastX, fps, zoom);
			if (stepF !== 0) {
				editor.slipEdit(clip.id, stepF);
				lastX = e.clientX;
			}
		} else if (dragMode === 'roll' && prevAdjacentId) {
			const stepF = pxToFrame(e.clientX - lastX, fps, zoom);
			if (stepF !== 0) {
				editor.rollEdit(prevAdjacentId, clip.id, stepF);
				lastX = e.clientX;
			}
		} else if (dragMode === 'fade-in' || dragMode === 'fade-out') {
			const rect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();
			if (!rect) return;
			const frames =
				dragMode === 'fade-in'
					? pxToFrame(e.clientX - rect.left, fps, zoom)
					: pxToFrame(rect.right - e.clientX, fps, zoom);
			editor.setClipFade(clip.id, dragMode === 'fade-in' ? 'in' : 'out', frames);
		}
	}

	function onPointerUp() {
		if (!dragMode) return;
		const mode = dragMode;
		dragMode = null;
		slipping = false;
		if (mode === 'move') editor.commitDrag();
		else editor.endGesture();
	}

	const fadeInPx = $derived(
		isMediaClip(clip) && clip.fadeInF > 0 ? frameToPx(clip.fadeInF, fps, zoom) : 0
	);
	const fadeOutPx = $derived(
		isMediaClip(clip) && clip.fadeOutF > 0 ? frameToPx(clip.fadeOutF, fps, zoom) : 0
	);
	const nextAdjacent = $derived.by(() => {
		const end = clipEndF(clip);
		return editor.project.clips.find((c) => c.trackId === clip.trackId && c.startF === end) ?? null;
	});

	function contextSplit() {
		editor.selectClip(clip.id, false);
		editor.seekFrame(Math.round(clip.startF + clip.durationF / 2));
		editor.splitAtPlayhead();
	}
</script>

<ContextMenu>
	{#snippet trigger({ props })}
		<div
			{...props}
			role="button"
			tabindex="-1"
			aria-label={clip.name}
			class={cn(
				'absolute inset-y-0.5 flex touch-none items-center gap-1 overflow-hidden rounded-md border px-1.5 text-xs text-white select-none',
				kindClasses[clip.kind],
				selected && 'ring-2 ring-primary',
				linkedHighlight && 'ring-1 ring-cyan-400/80',
				inDrag && 'z-50 opacity-80',
				isDragPrimary && drag?.insert && 'ring-2 ring-orange-400',
				locked ? 'cursor-not-allowed opacity-70' : 'cursor-grab active:cursor-grabbing'
			)}
			style="left: {frameToPx(clip.startF, fps, zoom)}px; width: {Math.max(
				4,
				frameToPx(clip.durationF, fps, zoom)
			)}px; transform: translate({dragDxPx}px, {dragDyPx}px); {clip.groupId
				? `box-shadow: inset 0 0 0 2px ${groupColor(clip.groupId)};`
				: ''}"
			onpointerdown={onBodyPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			{#if fadeInPx > 0}
				<div
					class="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-black/50 to-transparent"
					style="width: {Math.min(fadeInPx, frameToPx(clip.durationF, fps, zoom))}px;"
				></div>
			{/if}
			{#if fadeOutPx > 0}
				<div
					class="pointer-events-none absolute inset-y-0 right-0 bg-gradient-to-l from-black/50 to-transparent"
					style="width: {Math.min(fadeOutPx, frameToPx(clip.durationF, fps, zoom))}px;"
				></div>
			{/if}

			{#if clip.kind === 'video'}
				<Film class="size-3 shrink-0" />
			{:else if clip.kind === 'image'}
				<ImageIcon class="size-3 shrink-0" />
			{:else if clip.kind === 'audio'}
				<Music class="size-3 shrink-0" />
			{:else}
				<Type class="size-3 shrink-0" />
			{/if}
			<span class="truncate">{isMediaClip(clip) ? clip.name : clip.text}</span>
			{#if isMediaClip(clip) && clip.linkId}
				<Link2
					class={cn('ml-auto size-3 shrink-0', linkBroken && 'text-red-300')}
					style={!linkBroken ? 'color: #22d3ee;' : ''}
				/>
			{/if}
			{#if clip.groupId && !(isMediaClip(clip) && clip.linkId)}
				<Link2 class="ml-auto size-3 shrink-0" style="color: {groupColor(clip.groupId)};" />
			{/if}
			{#if clip.locked}
				<Lock class="size-3 shrink-0 opacity-80" />
			{/if}

			{#if slipping && isMediaClip(clip)}
				<div
					class="absolute top-0 left-1/2 z-10 -translate-x-1/2 rounded bg-black/80 px-1 font-mono text-[9px] whitespace-nowrap"
				>
					{formatTimecode(clip.trimInF, fps)} → {formatTimecode(clip.trimInF + clip.durationF, fps)}
				</div>
			{/if}

			{#if selected && !locked}
				<div
					role="presentation"
					class="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-md bg-primary/90"
					onpointerdown={(e) => onTrimPointerDown(e, 'trim-left')}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerUp}
				></div>
				<div
					role="presentation"
					class="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-md bg-primary/90"
					onpointerdown={(e) => onTrimPointerDown(e, 'trim-right')}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerUp}
				></div>
				{#if hasAudio}
					<div
						role="presentation"
						title={t.fade_in}
						class="absolute top-0 size-2.5 -translate-x-1/2 cursor-ew-resize rounded-full border border-white bg-black/70"
						style="left: {Math.max(5, fadeInPx)}px;"
						onpointerdown={(e) => onFadePointerDown(e, 'fade-in')}
						onpointermove={onPointerMove}
						onpointerup={onPointerUp}
						onpointercancel={onPointerUp}
					></div>
					<div
						role="presentation"
						title={t.fade_out}
						class="absolute top-0 size-2.5 translate-x-1/2 cursor-ew-resize rounded-full border border-white bg-black/70"
						style="right: {Math.max(5, fadeOutPx)}px;"
						onpointerdown={(e) => onFadePointerDown(e, 'fade-out')}
						onpointermove={onPointerMove}
						onpointerup={onPointerUp}
						onpointercancel={onPointerUp}
					></div>
				{/if}
			{/if}

			{#if prevAdjacentId && !locked}
				<div
					role="presentation"
					title={t.roll_edit}
					class="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize bg-transparent hover:bg-cyan-400/60"
					onpointerdown={onRollPointerDown}
					onpointermove={onPointerMove}
					onpointerup={onPointerUp}
					onpointercancel={onPointerUp}
				></div>
			{/if}
		</div>
	{/snippet}
	{#snippet content({ item, separator })}
		{#snippet cutLabel()}<Scissors class="size-4" />{t.cut}{/snippet}
		{@render item({
			children: cutLabel,
			onclick: () => (editor.selectClip(clip.id, false), editor.cutSelection())
		})}
		{#snippet copyLabel()}<Copy class="size-4" />{t.copy}{/snippet}
		{@render item({
			children: copyLabel,
			onclick: () => (editor.selectClip(clip.id, false), editor.copySelection())
		})}
		{#snippet duplicateLabel()}<Copy class="size-4" />{t.duplicate}{/snippet}
		{@render item({
			children: duplicateLabel,
			onclick: () => (editor.selectClip(clip.id, false), editor.duplicateSelected())
		})}
		{#snippet splitLabel()}<SplitSquareHorizontal class="size-4" />{t.split}{/snippet}
		{@render item({ children: splitLabel, onclick: contextSplit })}
		{@render separator()}
		{#if isMediaClip(clip) && clip.kind === 'video' && !clip.audioDetached}
			{#snippet detachLabel()}<Volume1 class="size-4" />{t.detach_audio}{/snippet}
			{@render item({ children: detachLabel, onclick: () => editor.detachAudio(clip.id) })}
		{/if}
		{#if isMediaClip(clip) && clip.linkId}
			{#snippet unlinkLabel()}<Unlink class="size-4" />{t.unlink}{/snippet}
			{@render item({ children: unlinkLabel, onclick: () => editor.toggleLink(clip.id) })}
		{/if}
		{#if hasAudio && nextAdjacent && clipHasAudio(nextAdjacent)}
			{#snippet crossfadeLabel()}<Volume1 class="size-4" />{t.add_crossfade}{/snippet}
			{@render item({
				children: crossfadeLabel,
				onclick: () => nextAdjacent && editor.addCrossfade(clip.id, nextAdjacent.id)
			})}
		{/if}
		{#snippet lockLabel()}{#if clip.locked}<LockOpen class="size-4" />{t.unlock}{:else}<Lock
					class="size-4"
				/>{t.lock}{/if}{/snippet}
		{@render item({ children: lockLabel, onclick: () => editor.toggleClipLock(clip.id) })}
		{@render separator()}
		{#snippet deleteLabel()}<Trash2 class="size-4" />{t.delete_clips}{/snippet}
		{@render item({
			children: deleteLabel,
			variant: 'destructive',
			onclick: () => (editor.selectClip(clip.id, false), onRequestDelete())
		})}
		{#snippet rippleLabel()}<Trash2 class="size-4" />{t.ripple_delete}{/snippet}
		{@render item({
			children: rippleLabel,
			variant: 'destructive',
			disabled: isClipLocked(editor.project, clip),
			onclick: () => (editor.selectClip(clip.id, false), editor.rippleDeleteSelected())
		})}
	{/snippet}
</ContextMenu>
