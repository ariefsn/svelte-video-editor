<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { LocateFixed, Pause, Play, Repeat } from '@lucide/svelte';
	import { formatTimecode } from '../../core/geometry.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
	import EditorIconButton from './EditorIconButton.svelte';

	const t = useMessages();

	const editor = useTimelineEditor();
	const fps = $derived(editor.project.fps);
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
</div>
