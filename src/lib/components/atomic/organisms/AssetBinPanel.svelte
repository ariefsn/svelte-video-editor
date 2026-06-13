<script lang="ts">
	import { useMessages } from '../../../i18n/messages.js';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { BinItem } from '../../../types/timeline.js';
	import { useEditorHost } from '../../../core/host.js';
	import { useConfirm } from '../../../core/confirm.svelte.js';
	import { useTimelineEditor } from '../../../core/state.svelte.js';
	import BinItemCard from './BinItemCard.svelte';

	const t = useMessages();
	const { requestConfirm } = useConfirm();

	// Host-agnostic: all import UI (upload, library, stock pickers) is supplied
	// by the host through the binImport snippet; thumbnails come from the
	// host's generateThumbnail callback. No fetching happens in here.
	type Props = {
		binImport?: Snippet<[{ addItems: (items: BinItem[]) => void }]>;
	};

	let { binImport }: Props = $props();

	const editor = useTimelineEditor();
	const host = useEditorHost();

	let thumbUrls = $state<Record<string, string>>({});

	async function requestRemove(item: BinItem) {
		const ok = await requestConfirm({
			title: t.remove_from_bin,
			message: t.remove_bin_confirm({ name: item.name })
		});
		if (ok) editor.removeBinItem(item.id);
	}

	function loadThumb(item: BinItem) {
		if (item.mediaType !== 'video' || thumbUrls[item.id]) return;
		host
			.generateThumbnail(item.assetId ?? item.url, 0)
			.then((url) => {
				thumbUrls = { ...thumbUrls, [item.id]: url };
			})
			.catch(() => {});
	}

	onMount(() => {
		for (const item of editor.project.bin) loadThumb(item);
	});

	function addItems(items: BinItem[]) {
		editor.addBinItems(items);
		for (const item of items) loadThumb(item);
	}
</script>

<div class="flex h-full min-h-0 flex-col gap-2 p-3">
	{#if binImport}
		{@render binImport({ addItems })}
	{/if}

	{#if editor.project.bin.length === 0}
		<p class="mt-4 text-center text-xs text-muted-foreground">{t.bin_empty}</p>
	{:else}
		<div role="list" class="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto">
			{#each editor.project.bin as item (item.id)}
				<BinItemCard {item} thumbUrl={thumbUrls[item.id]} onRemove={() => requestRemove(item)} />
			{/each}
		</div>
	{/if}
</div>
