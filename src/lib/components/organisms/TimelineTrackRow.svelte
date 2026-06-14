<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { cn } from '../../utils.js';
	import {
		Eye,
		EyeOff,
		Headphones,
		Layers,
		Lock,
		LockOpen,
		Trash2,
		Volume2,
		VolumeX
	} from '@lucide/svelte';
	import { ContextMenu } from '../atoms/index.js';
	import { InputText } from '../molecules/index.js';
	import { useConfirm } from '../../core/confirm.svelte.js';
	import {
		clipEndF,
		TRACK_HEIGHT_MAX,
		TRACK_HEIGHT_MIN,
		type TimelineClip,
		type TimelineTrack
	} from '../../types/timeline.js';
	import {
		frameToPx,
		pxToFrame,
		BIN_ITEM_MIME_PREFIX,
		TRACK_HEADER_W
	} from '../../core/geometry.js';
	import { gapAt, type Gap } from '../../core/ops.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
	import EditorIconButton from './EditorIconButton.svelte';
	import TimelineClipView from './TimelineClipView.svelte';

	const t = useMessages();

	type Props = {
		track: TimelineTrack;
		clips: TimelineClip[];
		contentWidth: number;
		/** Visible px window for clip virtualization (already buffered). */
		visibleStartPx: number;
		visibleEndPx: number;
		registerLane: (trackId: string, el: HTMLElement | null) => void;
		findTrackAt: (clientY: number, clip: TimelineClip) => string | null;
		findTrackIndexAt: (clientY: number) => number | null;
		onDropBinItem: (trackId: string, e: DragEvent) => void;
		onRequestDelete: () => void;
	};

	let {
		track,
		clips,
		contentWidth,
		visibleStartPx,
		visibleEndPx,
		registerLane,
		findTrackAt,
		findTrackIndexAt,
		onDropBinItem,
		onRequestDelete
	}: Props = $props();

	const editor = useTimelineEditor();
	const { requestConfirm } = useConfirm();
	const fps = $derived(editor.project.fps);
	const zoom = $derived(editor.project.zoom);
	// Silenced because another track is soloed — dim the volume icon as a hint.
	const soloElsewhere = $derived(!track.solo && editor.project.tracks.some((t) => t.solo));

	async function requestDeleteTrack() {
		const ok = await requestConfirm({
			title: t.delete_track,
			message: t.delete_track_confirm({ name: track.name })
		});
		if (ok) editor.removeTrack(track.id);
	}

	let dragOver = $state(false);
	let renaming = $state(false);
	let renameValue = $state('');
	let headerDyPx = $state(0);
	let ctxGap = $state<Gap | null>(null);
	let resizing = false;
	let reordering = $state(false);
	let reorderOriginY = 0;
	let originY = 0;
	let originHeight = 0;

	// Virtualize: only mount clips intersecting the (buffered) viewport;
	// selected and mid-drag clips always stay mounted.
	const visibleClips = $derived(
		clips.filter((clip) => {
			if (editor.selectedClipIds.has(clip.id)) return true;
			if (editor.dragState?.clipIds.includes(clip.id)) return true;
			const left = frameToPx(clip.startF, fps, zoom);
			const right = left + frameToPx(clip.durationF, fps, zoom);
			return left < visibleEndPx && right > visibleStartPx;
		})
	);

	function prevAdjacentId(clip: TimelineClip): string | null {
		const prev = clips.find((c) => c.id !== clip.id && clipEndF(c) === clip.startF);
		return prev ? prev.id : null;
	}

	const selectedGap = $derived(
		editor.selectedGap?.trackId === track.id ? editor.selectedGap : null
	);

	function acceptsDrag(e: DragEvent): boolean {
		if (track.locked) return false;
		const types = e.dataTransfer?.types ?? [];
		return types.some((t) => t.startsWith(BIN_ITEM_MIME_PREFIX));
	}

	function onDragOver(e: DragEvent) {
		if (!acceptsDrag(e)) return;
		e.preventDefault();
		dragOver = true;
	}

	function onDrop(e: DragEvent) {
		dragOver = false;
		if (!acceptsDrag(e)) return;
		e.preventDefault();
		onDropBinItem(track.id, e);
	}

	function laneFrameAt(e: { clientX: number; currentTarget: EventTarget | null }): number {
		const el = e.currentTarget as HTMLElement;
		return pxToFrame(e.clientX - el.getBoundingClientRect().left, fps, zoom);
	}

	function onLanePointerDown(e: PointerEvent) {
		if (e.target !== e.currentTarget) return;
		editor.selectGap(track.id, laneFrameAt(e));
	}

	function onLaneContextMenu(e: MouseEvent) {
		if (e.target !== e.currentTarget) return;
		ctxGap = gapAt(editor.project, track.id, laneFrameAt(e));
	}

	// ---- header: rename / reorder ------------------------------------------

	function startRename() {
		renameValue = track.name;
		renaming = true;
	}

	function commitRename() {
		renaming = false;
		editor.renameTrack(track.id, renameValue);
	}

	function onHeaderPointerDown(e: PointerEvent) {
		if (e.button !== 0 || renaming) return;
		// Capturing here would steal the click from the action buttons (capture
		// retargets pointerup, so their onclick never fires) — let those through.
		if (e.target instanceof Element && e.target.closest('button, input')) return;
		reordering = true;
		reorderOriginY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onHeaderPointerMove(e: PointerEvent) {
		if (!reordering) return;
		headerDyPx = e.clientY - reorderOriginY;
	}

	function onHeaderPointerUp(e: PointerEvent) {
		if (!reordering) return;
		reordering = false;
		const moved = Math.abs(headerDyPx) > 8;
		headerDyPx = 0;
		if (!moved) return;
		const toIndex = findTrackIndexAt(e.clientY);
		if (toIndex !== null) editor.moveTrack(track.id, toIndex);
	}

	// ---- height resize --------------------------------------------------------

	function onResizePointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		resizing = true;
		originY = e.clientY;
		originHeight = track.height;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		editor.beginGesture();
	}

	function onResizePointerMove(e: PointerEvent) {
		if (!resizing) return;
		editor.setTrackHeight(track.id, originHeight + (e.clientY - originY));
	}

	function onResizePointerUp() {
		if (!resizing) return;
		resizing = false;
		editor.endGesture();
	}

	// Stable identity so the attachment never re-runs from template updates.
	function attachLane(el: HTMLElement) {
		registerLane(track.id, el);
		return () => registerLane(track.id, null);
	}
</script>

<div
	class={cn('relative flex w-full border-b', reordering && 'z-30')}
	style="height: {track.height}px; {headerDyPx !== 0
		? `transform: translateY(${headerDyPx}px); opacity: 0.85;`
		: ''}"
>
	<div
		role="presentation"
		class="sticky left-0 z-20 flex shrink-0 cursor-grab flex-col justify-center gap-0.5 overflow-hidden border-r bg-background px-2 active:cursor-grabbing"
		style="width: {TRACK_HEADER_W}px;"
		onpointerdown={onHeaderPointerDown}
		onpointermove={onHeaderPointerMove}
		onpointerup={onHeaderPointerUp}
		onpointercancel={onHeaderPointerUp}
	>
		<div class="flex items-center gap-1 text-xs text-muted-foreground">
			<Layers class="size-3 shrink-0" />
			{#if renaming}
				<InputText
					class="h-5 px-1 text-xs"
					value={renameValue}
					oninput={(e: Event) => (renameValue = (e.currentTarget as HTMLInputElement).value)}
					onblur={commitRename}
					onkeydown={(e: KeyboardEvent) => {
						if (e.key === 'Enter') commitRename();
						if (e.key === 'Escape') renaming = false;
						e.stopPropagation();
					}}
					onpointerdown={(e: PointerEvent) => e.stopPropagation()}
				/>
			{:else}
				<span role="presentation" class="truncate" ondblclick={startRename}>
					{track.name}
				</span>
			{/if}
		</div>
		{#if track.height >= TRACK_HEIGHT_MIN + 8}
			<div class="flex items-center">
				<EditorIconButton
					label={track.muted ? t.unmute : t.mute}
					active={track.muted}
					onclick={() => editor.toggleTrackMuted(track.id)}
				>
					{#if track.muted}
						<VolumeX class="size-3.5" />
					{:else}
						<Volume2 class={cn('size-3.5', soloElsewhere && 'opacity-40')} />
					{/if}
				</EditorIconButton>
				<EditorIconButton
					label={t.solo}
					active={track.solo}
					onclick={() => editor.toggleTrackSolo(track.id)}
				>
					<Headphones class="size-3.5" />
				</EditorIconButton>
				<EditorIconButton
					label={track.hidden ? t.show : t.hide}
					active={track.hidden}
					onclick={() => editor.toggleTrackHidden(track.id)}
				>
					{#if track.hidden}
						<EyeOff class="size-3.5" />
					{:else}
						<Eye class="size-3.5" />
					{/if}
				</EditorIconButton>
				<EditorIconButton
					label={track.locked ? t.unlock : t.lock}
					active={track.locked}
					onclick={() => editor.toggleTrackLocked(track.id)}
				>
					{#if track.locked}
						<Lock class="size-3.5" />
					{:else}
						<LockOpen class="size-3.5" />
					{/if}
				</EditorIconButton>
				<EditorIconButton label={t.delete_track} onclick={requestDeleteTrack}>
					<Trash2 class="size-3.5" />
				</EditorIconButton>
			</div>
		{/if}
	</div>

	<ContextMenu>
		{#snippet trigger({ props })}
			<div
				{...props}
				role="list"
				aria-label={track.name}
				class={cn(
					'relative h-full flex-1',
					dragOver && 'bg-primary/10',
					track.hidden && 'opacity-50'
				)}
				style="min-width: {contentWidth}px;"
				{@attach attachLane}
				ondragover={onDragOver}
				ondragleave={() => (dragOver = false)}
				ondrop={onDrop}
				onpointerdown={onLanePointerDown}
				oncontextmenu={(e) => {
					onLaneContextMenu(e);
					props.oncontextmenu(e);
				}}
			>
				{#if selectedGap}
					<div
						class="pointer-events-none absolute inset-y-1 rounded border-2 border-dashed border-primary/70 bg-primary/10"
						style="left: {frameToPx(selectedGap.startF, fps, zoom)}px; width: {frameToPx(
							selectedGap.endF - selectedGap.startF,
							fps,
							zoom
						)}px;"
					></div>
				{/if}
				{#each visibleClips as clip (clip.id)}
					<TimelineClipView
						{clip}
						{track}
						prevAdjacentId={prevAdjacentId(clip)}
						{findTrackAt}
						{onRequestDelete}
					/>
				{/each}
			</div>
		{/snippet}
		{#snippet content({ item })}
			{#if ctxGap}
				{@const gap = ctxGap}
				{#snippet closeGap()}{t.close_gap}{/snippet}
				{@render item({
					children: closeGap,
					onclick: () => {
						editor.selectGap(track.id, gap.startF);
						editor.closeSelectedGap(false);
					}
				})}
				{#snippet closeGapAll()}{t.close_gap_all}{/snippet}
				{@render item({
					children: closeGapAll,
					onclick: () => {
						editor.selectGap(track.id, gap.startF);
						editor.closeSelectedGap(true);
					}
				})}
			{:else}
				{#snippet noGap()}{t.no_gap_here}{/snippet}
				{@render item({ children: noGap, disabled: true })}
			{/if}
		{/snippet}
	</ContextMenu>

	<div
		role="presentation"
		class={cn(
			'absolute right-0 bottom-0 left-0 z-20 h-1 cursor-row-resize',
			track.height >= TRACK_HEIGHT_MAX && 'cursor-row-resize'
		)}
		onpointerdown={onResizePointerDown}
		onpointermove={onResizePointerMove}
		onpointerup={onResizePointerUp}
		onpointercancel={onResizePointerUp}
	></div>
</div>
