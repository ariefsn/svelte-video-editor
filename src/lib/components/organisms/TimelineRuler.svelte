<script lang="ts">
	import { cn } from '../../utils.js';
	import { clipEndF, isMediaClip, secToFrame, type MediaClip } from '../../types/timeline.js';
	import {
		formatTimecode,
		frameToPx,
		pxToFrame,
		pxToTime,
		rulerInterval,
		TRACK_HEADER_W
	} from '../../core/geometry.js';
	import { useEditorHost } from '../../core/host.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
	import MarkerFlag from './MarkerFlag.svelte';

	type Props = {
		contentWidth: number;
		contentDuration: number;
	};

	let { contentWidth, contentDuration }: Props = $props();

	const editor = useTimelineEditor();
	const host = useEditorHost();
	const fps = $derived(editor.project.fps);
	const zoom = $derived(editor.project.zoom);
	const interval = $derived(rulerInterval(zoom));
	const ticks = $derived(
		Array.from({ length: Math.ceil(contentDuration / interval) + 1 }, (_, i) => i * interval)
	);
	const range = $derived(editor.project.range);

	let scrubbing = false;
	let wasPlaying = false;

	// ---- hover scrub thumbnail -------------------------------------------------
	const thumbCache = new Map<string, string>();
	let hoverX = $state<number | null>(null);
	let hoverThumb = $state<string | null>(null);
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;

	function topVideoClipAt(frame: number): MediaClip | null {
		for (let i = editor.project.tracks.length - 1; i >= 0; i--) {
			const track = editor.project.tracks[i];
			if (track.hidden) continue;
			const clip = editor.project.clips.find(
				(c) =>
					c.trackId === track.id &&
					isMediaClip(c) &&
					c.kind === 'video' &&
					c.startF <= frame &&
					frame < clipEndF(c)
			);
			if (clip) return clip as MediaClip;
		}
		return null;
	}

	function onHover(e: PointerEvent) {
		if (scrubbing) return;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		hoverX = x;
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => {
			const frame = pxToFrame(x, fps, zoom);
			const clip = topVideoClipAt(frame);
			if (!clip) {
				hoverThumb = null;
				return;
			}
			// Host contract: thumbnail frames use a fixed 30fps reference timebase.
			const sourceFrame30 = Math.round(((frame - clip.startF + clip.trimInF) / fps) * 30);
			const key = `${clip.assetId ?? clip.url}:${Math.floor(sourceFrame30 / 30)}`;
			const cached = thumbCache.get(key);
			if (cached) {
				hoverThumb = cached;
				return;
			}
			host
				.generateThumbnail(clip.assetId ?? clip.url, sourceFrame30)
				.then((url) => {
					thumbCache.set(key, url);
					hoverThumb = url;
				})
				.catch(() => (hoverThumb = null));
		}, 150);
	}

	function onHoverLeave() {
		hoverX = null;
		hoverThumb = null;
		if (hoverTimer) clearTimeout(hoverTimer);
	}

	// ---- scrubbing ----------------------------------------------------------------

	function seekFromEvent(e: PointerEvent) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		editor.seek(pxToTime(e.clientX - rect.left, zoom));
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		scrubbing = true;
		wasPlaying = editor.playing;
		if (wasPlaying) editor.pause();
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		seekFromEvent(e);
	}

	function onPointerMove(e: PointerEvent) {
		if (scrubbing) seekFromEvent(e);
		else onHover(e);
	}

	function onPointerUp() {
		if (!scrubbing) return;
		scrubbing = false;
		if (wasPlaying) editor.play();
	}
</script>

<div class="sticky top-0 z-30 flex h-7 w-full overflow-x-clip border-b bg-background">
	<div
		class="sticky left-0 z-10 h-full shrink-0 border-r bg-background"
		style="width: {TRACK_HEADER_W}px;"
	></div>
	<div
		role="slider"
		aria-label="timeline"
		aria-valuenow={editor.playheadF}
		tabindex="-1"
		class="relative h-full flex-1 cursor-col-resize touch-none"
		style="min-width: {contentWidth}px;"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onpointerleave={onHoverLeave}
	>
		{#if range}
			<div
				class="pointer-events-none absolute inset-y-0 bg-primary/20"
				style="left: {frameToPx(range.inFrame, fps, zoom)}px; width: {frameToPx(
					range.outFrame - range.inFrame,
					fps,
					zoom
				)}px;"
			></div>
		{/if}

		{#each ticks as tick (tick)}
			<div
				class="pointer-events-none absolute bottom-0 flex h-full flex-col justify-end"
				style="left: {tick * zoom}px;"
			>
				<span class="pl-1 text-[10px] leading-none text-muted-foreground select-none">
					{formatTimecode(secToFrame(tick, fps), fps)}
				</span>
				<div class="h-1.5 w-px bg-border"></div>
			</div>
		{/each}

		{#each editor.project.markers as marker (marker.id)}
			<MarkerFlag {marker} />
		{/each}

		{#if hoverX !== null && hoverThumb}
			<div
				class={cn(
					'pointer-events-none absolute bottom-full z-40 mb-1 -translate-x-1/2 overflow-hidden rounded border bg-black shadow-lg'
				)}
				style="left: {hoverX}px;"
			>
				<img src={hoverThumb} alt="" class="h-auto w-40" />
			</div>
		{/if}
	</div>
</div>
