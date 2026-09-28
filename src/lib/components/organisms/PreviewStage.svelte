<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { Clapperboard } from '@lucide/svelte';
	import {
		clipEndF,
		frameToSec,
		isMediaClip,
		isTextClip,
		type MediaClip,
		type TextClip
	} from '../../types/timeline.js';
	import { PRELOAD_LOOKAHEAD } from '../../core/playback.js';
	import { backgroundCss } from '../../core/background.js';
	import { fitStage, isClipActive, layeredClips } from '../../core/render.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
	import StageMedia from './StageMedia.svelte';
	import TextOverlayView from './TextOverlayView.svelte';

	const t = useMessages();

	const editor = useTimelineEditor();

	let containerWidth = $state(0);
	let containerHeight = $state(0);

	// Largest stage that fits the container while keeping the aspect ratio.
	const stage = $derived(fitStage(editor.project.aspectRatio, containerWidth, containerHeight));
	const stageWidth = $derived(stage.width);
	const stageHeight = $derived(stage.height);

	// Staged = mounted in the DOM. Includes clips within the lookahead window
	// so their media is fetched/decoded before they become visible — avoids a
	// hiccup at every clip boundary. Entries carry only stable values (the
	// clip proxy + a primitive zIndex): the keyed each below then produces
	// zero prop changes frame-to-frame, so StageMedia instances are never
	// touched by the playhead. Visibility is derived inside StageMedia.
	const stagedClips = $derived.by(() => {
		const fps = editor.project.fps;
		return layeredClips(editor.project).filter(
			({ clip }) =>
				editor.playhead >= frameToSec(clip.startF, fps) - PRELOAD_LOOKAHEAD &&
				editor.playhead < frameToSec(clipEndF(clip), fps)
		);
	});
	const mediaClips = $derived(stagedClips.filter((e) => isMediaClip(e.clip)));
	const textClips = $derived(
		stagedClips.filter(
			(e) => isTextClip(e.clip) && isClipActive(e.clip, editor.playhead, editor.project.fps)
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
				<p class="text-sm font-medium">{t.previewEmptyTitle}</p>
				<p class="mt-1 max-w-52 text-xs">{t.previewEmptyHint}</p>
			</div>
		</div>
	{:else}
		<div
			role="presentation"
			class="relative overflow-hidden rounded-md shadow-sm"
			style="width: {stageWidth}px; height: {stageHeight}px; background: {backgroundCss(
				editor.project.background
			)};"
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
