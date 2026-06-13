<script lang="ts">
	import { useMessages } from '../../../i18n/messages.js';
	import { Clapperboard } from '@lucide/svelte';
	import {
		clipEndF,
		frameToSec,
		isMediaClip,
		isTextClip,
		type MediaClip,
		type TextClip
	} from '../../../types/timeline.js';
	import { PRELOAD_LOOKAHEAD } from '../../../core/playback.js';
	import { useTimelineEditor } from '../../../core/state.svelte.js';
	import StageMedia from './StageMedia.svelte';
	import TextOverlayView from './TextOverlayView.svelte';

	const t = useMessages();

	const editor = useTimelineEditor();

	let containerWidth = $state(0);
	let containerHeight = $state(0);

	const aspect = $derived.by(() => {
		const [w, h] = editor.project.aspectRatio.split(':').map(Number);
		return w / h;
	});
	// Largest stage that fits the container while keeping the aspect ratio.
	const stageWidth = $derived(Math.max(0, Math.min(containerWidth, containerHeight * aspect)));
	const stageHeight = $derived(aspect > 0 ? stageWidth / aspect : 0);

	// Staged = mounted in the DOM. Includes clips within the lookahead window
	// so their media is fetched/decoded before they become visible — avoids a
	// hiccup at every clip boundary. Entries carry only stable values (the
	// clip proxy + a primitive zIndex): the keyed each below then produces
	// zero prop changes frame-to-frame, so StageMedia instances are never
	// touched by the playhead. Visibility is derived inside StageMedia.
	const stagedClips = $derived.by(() => {
		const fps = editor.project.fps;
		const result: { clip: MediaClip | TextClip; zIndex: number }[] = [];
		editor.project.tracks.forEach((track, index) => {
			if (track.hidden) return;
			for (const clip of editor.project.clips) {
				if (clip.trackId !== track.id) continue;
				if (
					editor.playhead < frameToSec(clip.startF, fps) - PRELOAD_LOOKAHEAD ||
					editor.playhead >= frameToSec(clipEndF(clip), fps)
				)
					continue;
				result.push({ clip, zIndex: index });
			}
		});
		return result;
	});
	const mediaClips = $derived(stagedClips.filter((e) => isMediaClip(e.clip)));
	const textClips = $derived(
		stagedClips.filter(
			(e) =>
				isTextClip(e.clip) &&
				editor.playhead >= frameToSec(e.clip.startF, editor.project.fps) &&
				editor.playhead < frameToSec(clipEndF(e.clip), editor.project.fps)
		)
	);
	const hasContent = $derived(editor.project.clips.length > 0);
</script>

<div
	class="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-muted/30 p-3"
	bind:clientWidth={containerWidth}
	bind:clientHeight={containerHeight}
>
	{#if !hasContent}
		<div class="flex flex-col items-center gap-3 text-center text-muted-foreground">
			<div class="rounded-xl border p-3">
				<Clapperboard class="size-6" />
			</div>
			<div>
				<p class="text-sm font-medium">{t.preview_empty_title}</p>
				<p class="mt-1 max-w-52 text-xs">{t.preview_empty_hint}</p>
			</div>
		</div>
	{:else}
		<div
			role="presentation"
			class="relative overflow-hidden rounded-md bg-black shadow-sm"
			style="width: {stageWidth}px; height: {stageHeight}px;"
			onpointerdown={(e) => {
				if (e.target === e.currentTarget) editor.clearSelection();
			}}
		>
			{#each mediaClips as entry (entry.clip.id)}
				<StageMedia clip={entry.clip as MediaClip} zIndex={entry.zIndex} />
			{/each}

			{#each textClips as entry (entry.clip.id)}
				<div
					class="pointer-events-none absolute inset-0 *:pointer-events-auto"
					style="z-index: {entry.zIndex};"
				>
					<TextOverlayView clip={entry.clip as TextClip} {stageWidth} {stageHeight} />
				</div>
			{/each}
		</div>
	{/if}
</div>
