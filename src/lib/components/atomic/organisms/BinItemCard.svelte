<script lang="ts">
	import { useMessages } from '../../../i18n/messages.js';
	import { cn } from '../../../utils.js';
	import { Film, Image as ImageIcon, Music, X } from '@lucide/svelte';
	import type { BinItem } from '../../../types/timeline.js';
	import { Button, Tooltip } from '../atoms/index.js';
	import { formatDuration, BIN_ITEM_MIME_PREFIX } from '../../../core/geometry.js';

	const t = useMessages();

	type Props = {
		item: BinItem;
		thumbUrl?: string;
		onRemove: (itemId: string) => void;
	};

	let { item, thumbUrl, onRemove }: Props = $props();

	function onDragStart(e: DragEvent) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(`${BIN_ITEM_MIME_PREFIX}${item.mediaType}`, item.id);
		e.dataTransfer.effectAllowed = 'copy';
	}
</script>

<div
	role="listitem"
	draggable="true"
	class="group relative cursor-grab overflow-hidden rounded-md border bg-muted/40 active:cursor-grabbing"
	ondragstart={onDragStart}
>
	<div class="pointer-events-none absolute top-1 left-1 z-10 rounded bg-black/60 p-0.5 text-white">
		{#if item.mediaType === 'video'}
			<Film class="size-3" />
		{:else if item.mediaType === 'audio'}
			<Music class="size-3" />
		{:else}
			<ImageIcon class="size-3" />
		{/if}
	</div>
	<div class="flex aspect-video items-center justify-center overflow-hidden">
		{#if item.mediaType === 'audio'}
			<Music class="size-5 text-muted-foreground" />
		{:else if item.mediaType === 'video' && !thumbUrl}
			<Film class="size-5 text-muted-foreground" />
		{:else}
			<img
				src={thumbUrl ?? item.url}
				alt={item.name}
				class="h-full w-full object-cover"
				loading="lazy"
				draggable="false"
			/>
		{/if}
	</div>
	<div class="flex items-center gap-1 px-1.5 py-1">
		<span class="truncate text-[10px] text-muted-foreground">{item.name}</span>
		{#if item.duration !== null}
			<span
				class={cn(
					'ml-auto shrink-0 rounded bg-background/80 px-1 text-[10px] tabular-nums',
					'text-muted-foreground'
				)}
			>
				{formatDuration(item.duration)}
			</span>
		{/if}
	</div>
	<Tooltip text={t.remove_from_bin}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="secondary"
				size="icon"
				class="absolute top-1 right-1 size-5 opacity-0 transition-opacity group-hover:opacity-100"
				aria-label={t.remove_from_bin}
				onclick={() => onRemove(item.id)}
			>
				<X class="size-3" />
			</Button>
		{/snippet}
	</Tooltip>
</div>
