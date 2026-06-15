<script lang="ts" module>
	import type { Messages } from '../../i18n/messages.js';

	/** Single source of truth for the shortcut list — reused by the mobile
	 * shortcuts sheet (TransportBar) so the two never drift. */
	export function shortcutHints(t: Messages): { keys: string; label: string }[] {
		return [
			{ keys: 'Space', label: t.shortcutPlayPause },
			{ keys: '⌘Click', label: t.shortcutMultiSelect },
			{ keys: 'S / ⇧S', label: t.shortcutSplit },
			{ keys: '⌘G / ⌘⇧G', label: `${t.shortcutGroup} / ${t.shortcutUngroup}` },
			{ keys: '⌘C/X/V/D', label: t.shortcutClipboard },
			{ keys: '⇧⌫', label: t.rippleDelete },
			{ keys: 'I / O', label: t.shortcutRange },
			{ keys: 'M', label: t.marker },
			{ keys: '⌥L', label: t.unlink },
			{ keys: '⌥drag', label: t.shortcutAltDrag },
			{ keys: '⌘drop', label: t.shortcutInsert },
			{ keys: '⌘⌥drag', label: t.shortcutSlip },
			{ keys: '⇧drag', label: t.shortcutNoSnap }
		];
	}
</script>

<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';

	const t = useMessages();
	const hints = $derived(shortcutHints(t));
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
