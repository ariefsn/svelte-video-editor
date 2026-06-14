<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { Keyboard, LocateFixed, Pause, Play, Repeat } from '@lucide/svelte';
	import { formatTimecode } from '../../core/geometry.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
	import { useViewport } from '../../core/viewport.svelte.js';
	import Sheet from '../molecules/Sheet.svelte';
	import EditorIconButton from './EditorIconButton.svelte';
	import { shortcutHints } from './ShortcutsFooter.svelte';

	const t = useMessages();

	const editor = useTimelineEditor();
	const fps = $derived(editor.project.fps);

	const viewport = useViewport();
	const isMobile = $derived(viewport.isMobile);
	const hints = $derived(shortcutHints(t));
	let shortcutsOpen = $state(false);
</script>

<div class="flex items-center justify-center gap-2 border-t px-2 py-1">
	<EditorIconButton
		label={editor.playing ? t.pause : t.play}
		disabled={editor.durationF <= 0}
		onclick={() => editor.togglePlay()}
	>
		{#if editor.playing}
			<Pause class="size-4" />
		{:else}
			<Play class="size-4" />
		{/if}
	</EditorIconButton>
	<span class="font-mono text-xs text-muted-foreground tabular-nums">
		{formatTimecode(editor.playheadF, fps)} / {formatTimecode(editor.durationF, fps)}
	</span>
	<EditorIconButton
		label={t.loop_range}
		active={editor.loopRange}
		disabled={!editor.project.range}
		onclick={() => (editor.loopRange = !editor.loopRange)}
	>
		<Repeat class="size-3.5" />
	</EditorIconButton>
	<EditorIconButton
		label={t.follow_playhead}
		active={editor.followPlayhead}
		onclick={() => (editor.followPlayhead = !editor.followPlayhead)}
	>
		<LocateFixed class="size-3.5" />
	</EditorIconButton>
	{#if isMobile}
		<EditorIconButton label={t.shortcuts_title} onclick={() => (shortcutsOpen = true)}>
			<Keyboard class="size-3.5" />
		</EditorIconButton>
	{/if}
</div>

{#if isMobile}
	<Sheet bind:open={shortcutsOpen}>
		{#snippet title()}{t.shortcuts_title}{/snippet}
		<ul class="flex flex-col gap-1.5 text-sm">
			{#each hints as hint (hint.keys)}
				<li class="flex items-center justify-between gap-3">
					<span class="text-muted-foreground">{hint.label}</span>
					<kbd class="shrink-0 rounded border bg-muted px-1.5 py-0.5 font-sans text-xs">
						{hint.keys}
					</kbd>
				</li>
			{/each}
		</ul>
	</Sheet>
{/if}
