<script lang="ts" module>
	// Resolved-URL cache shared across all StageMedia instances for the session.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain URL cache, must not trigger renders
	const resolvedUrls = new Map<string, string>();
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { cn } from '../../utils.js';
	import type { MediaClip } from '../../types/timeline.js';
	import { clipAnimStyle } from '../../core/animation.js';
	import { isClipActive, mediaClipCss, toCssText } from '../../core/render.js';
	import { useEditorHost } from '../../core/host.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';

	// One stable instance per staged clip (keyed by clip.id in PreviewStage).
	// Registration happens in onMount — exactly once per instance — instead of
	// an inline {@attach}, which is fully reactive and would re-run on every
	// playhead tick (destroying/re-registering the element 60×/s caused the
	// playback stutter).
	type Props = {
		clip: MediaClip;
		zIndex: number;
	};

	let { clip, zIndex }: Props = $props();

	const editor = useTimelineEditor();
	const host = useEditorHost();
	const visible = $derived(isClipActive(clip, editor.playhead, editor.project.fps));
	const anim = $derived(clipAnimStyle(clip, editor.playhead, editor.project.fps));
	const css = $derived(`z-index: ${zIndex}; ${toCssText(mediaClipCss(anim))}`);

	let src = $state(clip.assetId ? (resolvedUrls.get(clip.assetId) ?? clip.url) : clip.url);
	let mediaEl = $state<HTMLVideoElement | HTMLAudioElement | null>(null);

	onMount(() => {
		// Hosts may serve fresher URLs (e.g. signed storage links) per assetId;
		// the stored url is the fallback.
		if (clip.assetId && !resolvedUrls.has(clip.assetId)) {
			const assetId = clip.assetId;
			host
				.resolveAsset(assetId)
				.then((resolved) => {
					resolvedUrls.set(assetId, resolved.url);
					src = resolved.url;
				})
				.catch(() => {});
		}
		if (mediaEl) editor.engine.register(clip.id, mediaEl);
		return () => editor.engine.unregister(clip.id);
	});
</script>

{#if clip.kind === 'video'}
	<video
		bind:this={mediaEl}
		{src}
		class={cn(!visible && 'hidden')}
		style={css}
		playsinline
		preload="auto"
		muted
	></video>
{:else if clip.kind === 'audio'}
	<audio bind:this={mediaEl} {src} preload="auto" class="hidden"></audio>
{:else}
	<img {src} alt={clip.name} class={cn(!visible && 'hidden')} style={css} draggable="false" />
{/if}
