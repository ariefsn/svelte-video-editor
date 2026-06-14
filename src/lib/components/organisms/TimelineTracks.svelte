<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { onDestroy } from 'svelte';
	import { useNotify } from '../../core/notify.js';
	import { Slider, Tooltip } from '../atoms/index.js';
	import { ZoomIn, ZoomOut } from '@lucide/svelte';
	import { clipEndF, ZOOM_MAX, ZOOM_MIN, type TimelineClip } from '../../types/timeline.js';
	import {
		frameToPx,
		pxToFrame,
		pxToTime,
		timeToPx,
		BIN_ITEM_MIME_PREFIX,
		TRACK_HEADER_W
	} from '../../core/geometry.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
	import EditorIconButton from './EditorIconButton.svelte';
	import TimelineMinimap from './TimelineMinimap.svelte';
	import TimelineRuler from './TimelineRuler.svelte';
	import TimelineTrackRow from './TimelineTrackRow.svelte';

	const t = useMessages();
	const notify = useNotify();

	type Props = {
		onRequestDelete: () => void;
	};

	let { onRequestDelete }: Props = $props();

	const editor = useTimelineEditor();
	const fps = $derived(editor.project.fps);
	const zoom = $derived(editor.project.zoom);
	const contentDuration = $derived(editor.duration + 60);
	const contentWidth = $derived(timeToPx(contentDuration, zoom));

	let scrollEl = $state<HTMLElement | null>(null);
	let scrollLeft = $state(0);
	let containerW = $state(0);
	const viewportW = $derived(Math.max(0, containerW - TRACK_HEADER_W));
	const laneEls = new Map<string, HTMLElement>();

	// Virtualization window (±1 viewport of buffer either side).
	const visibleStartPx = $derived(scrollLeft - viewportW);
	const visibleEndPx = $derived(scrollLeft + viewportW * 2);

	// Playhead is hidden while it sits behind the sticky header column — its
	// content px must have scrolled past the current scroll offset to be in the
	// lane area (its `left` already adds TRACK_HEADER_W, so compare without it).
	const playheadPx = $derived(frameToPx(editor.playheadF, fps, zoom));
	const playheadVisible = $derived(playheadPx >= scrollLeft);

	function registerLane(trackId: string, el: HTMLElement | null) {
		if (el) laneEls.set(trackId, el);
		else laneEls.delete(trackId);
	}

	function findTrackAt(clientY: number, _clip: TimelineClip): string | null {
		for (const [trackId, el] of laneEls) {
			const rect = el.getBoundingClientRect();
			if (clientY < rect.top || clientY > rect.bottom) continue;
			const track = editor.project.tracks.find((t) => t.id === trackId);
			return track && !track.locked ? trackId : null;
		}
		return null;
	}

	function findTrackIndexAt(clientY: number): number | null {
		for (const [trackId, el] of laneEls) {
			const rect = el.getBoundingClientRect();
			if (clientY < rect.top || clientY > rect.bottom) continue;
			const index = editor.project.tracks.findIndex((t) => t.id === trackId);
			return index >= 0 ? index : null;
		}
		return null;
	}

	function onDropBinItem(trackId: string, e: DragEvent) {
		const type = e.dataTransfer?.types.find((t) => t.startsWith(BIN_ITEM_MIME_PREFIX));
		if (!type) return;
		const itemId = e.dataTransfer?.getData(type);
		const item = editor.project.bin.find((b) => b.id === itemId);
		const lane = laneEls.get(trackId);
		if (!item || !lane) return;
		const atF = pxToFrame(e.clientX - lane.getBoundingClientRect().left, fps, zoom);

		// Alt-drop onto an existing clip = replace in place.
		if (e.altKey) {
			const target = editor.project.clips.find(
				(c) => c.trackId === trackId && c.startF <= atF && atF < clipEndF(c)
			);
			if (target) {
				const clamped = editor.replaceClipFromBin(target.id, item);
				if (clamped) notify(t.replace_clamped, 'warning');
				return;
			}
		}
		editor.addClipFromBin(item, trackId, atF, e.metaKey || e.ctrlKey);
	}

	// Zoom anchored at the cursor: keep the time under the pointer stationary.
	function onWheel(e: WheelEvent) {
		if (!(e.ctrlKey || e.metaKey) || !scrollEl) return;
		e.preventDefault();
		const rect = scrollEl.getBoundingClientRect();
		const cursorX = e.clientX - rect.left - TRACK_HEADER_W;
		const anchorTime = pxToTime(scrollEl.scrollLeft + cursorX, zoom);
		const factor = Math.exp(-e.deltaY * 0.002);
		editor.setZoom(zoom * factor);
		scrollEl.scrollLeft = timeToPx(anchorTime, editor.project.zoom) - cursorX;
	}

	function onScroll() {
		if (!scrollEl) return;
		scrollLeft = scrollEl.scrollLeft;
	}

	// ---- follow playhead during playback (page-jump, not continuous scroll) ----
	// A cheap always-on interval (guarded internally) avoids any $effect: when
	// the playhead exits the viewport during playback, jump so it sits near the
	// left edge — page-scroll style, no motion sickness.
	const followTimer = setInterval(() => {
		if (!editor.followPlayhead || !editor.playing || !scrollEl) return;
		const playheadPx = timeToPx(editor.playhead, editor.project.zoom);
		const viewStart = scrollEl.scrollLeft;
		const viewW = scrollEl.clientWidth - TRACK_HEADER_W;
		if (playheadPx < viewStart || playheadPx > viewStart + viewW) {
			scrollEl.scrollLeft = Math.max(0, playheadPx - viewW * 0.1);
		}
	}, 200);

	onDestroy(() => clearInterval(followTimer));

	// ---- edge auto-scroll during clip drags --------------------------------------
	const EDGE_ZONE = 48;
	let edgeRafId: number | null = null;

	function edgeTick() {
		edgeRafId = null;
		if (!scrollEl || !editor.dragState) return;
		// Speed ∝ proximity is applied via the last pointer position captured
		// in onDragPointerMove below.
		if (edgeSpeed !== 0) {
			scrollEl.scrollLeft += edgeSpeed;
			edgeRafId = requestAnimationFrame(edgeTick);
		}
	}

	let edgeSpeed = 0;

	function onPointerMoveCapture(e: PointerEvent) {
		if (!editor.dragState || !scrollEl) {
			edgeSpeed = 0;
			return;
		}
		const rect = scrollEl.getBoundingClientRect();
		const leftEdge = rect.left + TRACK_HEADER_W;
		const rightEdge = rect.right;
		if (e.clientX < leftEdge + EDGE_ZONE) {
			edgeSpeed = -Math.ceil((leftEdge + EDGE_ZONE - e.clientX) / 8);
		} else if (e.clientX > rightEdge - EDGE_ZONE) {
			edgeSpeed = Math.ceil((e.clientX - (rightEdge - EDGE_ZONE)) / 8);
		} else {
			edgeSpeed = 0;
		}
		if (edgeSpeed !== 0 && edgeRafId === null) edgeRafId = requestAnimationFrame(edgeTick);
	}

	function onPointerUpCapture() {
		edgeSpeed = 0;
	}
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div
		bind:this={scrollEl}
		bind:clientWidth={containerW}
		id="timeline-scroll"
		class="relative min-h-0 flex-1 overflow-auto"
		onwheel={onWheel}
		onscroll={onScroll}
		onpointermovecapture={onPointerMoveCapture}
		onpointerupcapture={onPointerUpCapture}
	>
		<div class="relative min-w-full" style="width: {TRACK_HEADER_W + contentWidth}px;">
			<TimelineRuler {contentWidth} {contentDuration} />
			{#each editor.project.tracks as track (track.id)}
				<TimelineTrackRow
					{track}
					clips={editor.clipsByTrack.get(track.id) ?? []}
					{contentWidth}
					{visibleStartPx}
					{visibleEndPx}
					{registerLane}
					{findTrackAt}
					{findTrackIndexAt}
					{onDropBinItem}
					{onRequestDelete}
				/>
			{/each}
			{#if playheadVisible}
				<div
					class="pointer-events-none absolute top-0 bottom-0 z-20 w-0.5 -translate-x-1/2 bg-red-500"
					style="left: {TRACK_HEADER_W + playheadPx}px;"
				>
					<!-- playhead handle: downward triangle at the top -->
					<div
						class="absolute -top-px left-1/2 size-0 -translate-x-1/2 border-x-[5px] border-t-[7px] border-x-transparent border-t-red-500"
					></div>
				</div>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-3 border-t px-2 py-1">
		<div class="min-w-0 flex-1">
			<TimelineMinimap
				viewStartSec={pxToTime(scrollLeft, zoom)}
				viewEndSec={pxToTime(scrollLeft + Math.max(0, viewportW), zoom)}
				totalSec={contentDuration}
				onPan={(startSec) => {
					if (scrollEl) scrollEl.scrollLeft = Math.max(0, timeToPx(startSec, zoom));
				}}
			/>
		</div>
		<div class="flex shrink-0 items-center gap-1">
			<EditorIconButton label={t.zoom_out} onclick={() => editor.setZoom(zoom / 1.25)}>
				<ZoomOut class="size-3.5" />
			</EditorIconButton>
			<Tooltip text={t.zoom}>
				{#snippet child({ props })}
					<div {...props}>
						<Slider
							value={zoom}
							min={ZOOM_MIN}
							max={ZOOM_MAX}
							step={1}
							class="w-32"
							ariaLabel={t.zoom}
							onchange={(v) => editor.setZoom(v)}
						/>
					</div>
				{/snippet}
			</Tooltip>
			<EditorIconButton label={t.zoom_in} onclick={() => editor.setZoom(zoom * 1.25)}>
				<ZoomIn class="size-3.5" />
			</EditorIconButton>
		</div>
	</div>
</div>
