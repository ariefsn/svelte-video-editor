<script lang="ts">
	import { useMessages } from '../../../i18n/messages.js';
	import * as Popover from '../../ui/popover/index.js';
	import { Button, InputText, Tooltip } from '../atoms/index.js';
	import { Trash2 } from '@lucide/svelte';
	import { MARKER_COLORS, type TimelineMarker } from '../../../types/timeline.js';
	import { frameToPx, pxToFrame } from '../../../core/geometry.js';
	import { useTimelineEditor } from '../../../core/state.svelte.js';

	const t = useMessages();

	type Props = {
		marker: TimelineMarker;
	};

	let { marker }: Props = $props();

	const editor = useTimelineEditor();
	const fps = $derived(editor.project.fps);
	const zoom = $derived(editor.project.zoom);

	let open = $state(false);
	let dragging = false;
	let moved = false;
	let originX = 0;
	let originFrame = 0;

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.stopPropagation();
		dragging = true;
		moved = false;
		originX = e.clientX;
		originFrame = marker.frame;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		editor.beginGesture();
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const deltaF = pxToFrame(e.clientX - originX, fps, zoom);
		if (deltaF !== 0) moved = true;
		editor.updateMarker(marker.id, { frame: originFrame + deltaF });
	}

	function onPointerUp() {
		if (!dragging) return;
		dragging = false;
		editor.endGesture();
		if (!moved) {
			editor.seekFrame(marker.frame);
			open = true;
		}
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger>
		{#snippet child({ props })}
			<div
				{...props}
				role="button"
				tabindex="-1"
				aria-label={marker.label || t.marker}
				class="absolute top-0 z-20 h-full w-2 -translate-x-1/2 cursor-pointer touch-none"
				style="left: {frameToPx(marker.frame, fps, zoom)}px;"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
			>
				<div class="mx-auto h-2.5 w-2 rounded-b-sm" style="background-color: {marker.color};"></div>
			</div>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-56 p-3">
		<div class="flex flex-col gap-2">
			<InputText
				placeholder={t.marker_label}
				value={marker.label}
				oninput={(e: Event) =>
					editor.updateMarker(marker.id, { label: (e.currentTarget as HTMLInputElement).value })}
			/>
			<div class="flex items-center gap-1">
				{#each MARKER_COLORS as color (color)}
					<Tooltip text={color}>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								size="icon"
								class="size-6"
								aria-label={color}
								onclick={() => editor.updateMarker(marker.id, { color })}
							>
								<span
									class="size-4 rounded-full border"
									style="background-color: {color}; {marker.color === color
										? 'outline: 2px solid var(--primary);'
										: ''}"
								></span>
							</Button>
						{/snippet}
					</Tooltip>
				{/each}
				<Tooltip text={t.delete_marker}>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon"
							class="ml-auto size-6"
							aria-label={t.delete_marker}
							onclick={() => {
								open = false;
								editor.removeMarker(marker.id);
							}}
						>
							<Trash2 class="size-3.5" />
						</Button>
					{/snippet}
				</Tooltip>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
