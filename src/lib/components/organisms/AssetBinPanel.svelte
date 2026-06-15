<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { clipKindForMediaType, type BinItem, type MediaClipKind } from '../../types/timeline.js';
	import { useEditorHost } from '../../core/host.js';
	import { useConfirm } from '../../core/confirm.svelte.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
	import { Film, Image as ImageIcon, Music } from '@lucide/svelte';
	import { ButtonGroup, type ButtonGroupOption } from '../molecules/index.js';
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

	// Media-type filter. Items bucket by clip kind (gif → image), matching how a
	// clip is created from the item, so the filter labels line up with playback.
	type BinFilter = 'all' | MediaClipKind;
	let binFilter = $state<BinFilter>('all');

	const bin = $derived(editor.project.bin);
	const presentKinds = $derived(new Set(bin.map((i) => clipKindForMediaType(i.mediaType))));
	const filteredBin = $derived(
		binFilter === 'all' ? bin : bin.filter((i) => clipKindForMediaType(i.mediaType) === binFilter)
	);
	// Drop back to "all" if the selected type no longer has any items.
	$effect(() => {
		if (binFilter !== 'all' && !presentKinds.has(binFilter)) binFilter = 'all';
	});

	const filterOptions = $derived.by<ButtonGroupOption[]>(() => {
		const opts: ButtonGroupOption[] = [{ value: 'all', label: t.binFilterAll }];
		if (presentKinds.has('video'))
			opts.push({ value: 'video', icon: videoIcon, ariaLabel: t.binFilterVideos });
		if (presentKinds.has('image'))
			opts.push({ value: 'image', icon: imageIcon, ariaLabel: t.binFilterImages });
		if (presentKinds.has('audio'))
			opts.push({ value: 'audio', icon: audioIcon, ariaLabel: t.binFilterAudios });
		return opts;
	});

	async function requestRemove(item: BinItem) {
		const ok = await requestConfirm({
			title: t.removeFromBin,
			message: t.removeBinConfirm({ name: item.name })
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

{#snippet videoIcon()}<Film class="size-3.5" />{/snippet}
{#snippet imageIcon()}<ImageIcon class="size-3.5" />{/snippet}
{#snippet audioIcon()}<Music class="size-3.5" />{/snippet}

<div class="@container flex h-full min-h-0 flex-col gap-2 p-3">
	{#if binImport}
		{@render binImport({ addItems })}
	{/if}

	{#if bin.length === 0}
		<p class="mt-4 text-center text-xs text-muted-foreground">{t.binEmpty}</p>
	{:else}
		{#if presentKinds.size > 1}
			<ButtonGroup
				class="flex w-full"
				equalWidth
				value={binFilter}
				options={filterOptions}
				onValueChange={(v) => (binFilter = v as BinFilter)}
			/>
		{/if}
		{#if filteredBin.length === 0}
			<p class="mt-4 text-center text-xs text-muted-foreground">{t.binFilterEmpty}</p>
		{:else}
			<!-- Columns track the panel's own width (container queries), so the grid
			     adds columns as the resizable bin gets wider — not the viewport. -->
			<div
				role="list"
				class="grid min-h-0 grid-cols-2 gap-2 overflow-y-auto @md:grid-cols-3 @lg:grid-cols-4"
			>
				{#each filteredBin as item (item.id)}
					<BinItemCard {item} thumbUrl={thumbUrls[item.id]} onRemove={() => requestRemove(item)} />
				{/each}
			</div>
		{/if}
	{/if}
</div>
