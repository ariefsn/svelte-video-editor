<script lang="ts">
	import { cn } from '../../utils.js';
	import { clipEndF } from '../../types/timeline.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';

	// Whole-project overview with a draggable viewport window.
	type Props = {
		/** Visible window in seconds + total scroll width, supplied by TimelineTracks. */
		viewStartSec: number;
		viewEndSec: number;
		totalSec: number;
		onPan: (startSec: number) => void;
	};

	let { viewStartSec, viewEndSec, totalSec, onPan }: Props = $props();

	const editor = useTimelineEditor();
	const fps = $derived(editor.project.fps);

	const kindColors: Record<string, string> = {
		video: '#6366f1',
		image: '#0ea5e9',
		audio: '#10b981',
		text: '#f59e0b'
	};

	let barEl = $state<HTMLElement | null>(null);
	let dragging = false;

	function panFromEvent(e: PointerEvent) {
		if (!barEl || totalSec <= 0) return;
		const rect = barEl.getBoundingClientRect();
		const frac = Math.min(Math.max(0, (e.clientX - rect.left) / rect.width), 1);
		const windowSec = viewEndSec - viewStartSec;
		onPan(frac * totalSec - windowSec / 2);
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		dragging = true;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		panFromEvent(e);
	}
</script>

<div
	bind:this={barEl}
	role="scrollbar"
	aria-controls="timeline-scroll"
	aria-valuenow={Math.round(viewStartSec)}
	tabindex="-1"
	class="relative h-4 w-full cursor-pointer touch-none overflow-hidden rounded bg-muted/60"
	onpointerdown={onPointerDown}
	onpointermove={(e) => dragging && panFromEvent(e)}
	onpointerup={() => (dragging = false)}
	onpointercancel={() => (dragging = false)}
>
	{#if totalSec > 0}
		{#each editor.project.tracks as track, index (track.id)}
			{#each editor.project.clips.filter((c) => c.trackId === track.id) as clip (clip.id)}
				<div
					class="absolute"
					style="
						left: {(clip.startF / fps / totalSec) * 100}%;
						width: {Math.max(0.4, ((clipEndF(clip) - clip.startF) / fps / totalSec) * 100)}%;
						top: {(index / Math.max(1, editor.project.tracks.length)) * 100}%;
						height: {100 / Math.max(1, editor.project.tracks.length)}%;
						background-color: {kindColors[clip.kind] ?? '#888'};
					"
				></div>
			{/each}
		{/each}
		<div
			class={cn('absolute inset-y-0 rounded border border-primary/70 bg-primary/15')}
			style="left: {(viewStartSec / totalSec) * 100}%; width: {Math.min(
				100,
				((viewEndSec - viewStartSec) / totalSec) * 100
			)}%;"
		></div>
	{/if}
</div>
