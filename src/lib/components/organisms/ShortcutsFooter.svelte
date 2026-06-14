<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';

	const t = useMessages();

	const hints = $derived([
		{ keys: 'Space', label: t.shortcut_play_pause },
		{ keys: '⌘Click', label: t.shortcut_multi_select },
		{ keys: 'S / ⇧S', label: t.shortcut_split },
		{ keys: '⌘G / ⌘⇧G', label: t.shortcut_group },
		{ keys: '⌘C/X/V/D', label: t.shortcut_clipboard },
		{ keys: '⇧⌫', label: t.ripple_delete },
		{ keys: 'I / O', label: t.shortcut_range },
		{ keys: 'M', label: t.marker },
		{ keys: '⌥L', label: t.unlink },
		{ keys: '⌥drag', label: t.shortcut_alt_drag },
		{ keys: '⌘drop', label: t.shortcut_insert },
		{ keys: '⌘⌥drag', label: t.shortcut_slip },
		{ keys: '⇧drag', label: t.shortcut_no_snap }
	]);
</script>

<div
	class="flex items-center gap-3 overflow-x-auto border-t px-3 py-1 text-[10px] whitespace-nowrap text-muted-foreground"
>
	{#each hints as hint (hint.keys)}
		<span>
			<kbd class="rounded border bg-muted px-1 font-sans">{hint.keys}</kbd>
			{hint.label}
		</span>
	{/each}
</div>
