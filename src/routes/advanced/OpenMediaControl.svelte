<script lang="ts">
	import { registerLocalFile } from '../demo-host.js';
	import type { BinItem, NotifyKind } from '$lib/index.js';

	// Host-owned import UI. The library ships none on purpose — it never touches
	// files, so opening local media is the host's job, done here through the
	// `binImport` snippet's addItems callback.
	type Props = {
		addItems: (items: BinItem[]) => void;
		onNotify?: (message: string, kind: NotifyKind) => void;
	};

	let { addItems, onNotify }: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let dragging = $state(false);
	let busy = $state(false);

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		busy = true;
		try {
			const results = await Promise.all(Array.from(files).map(registerLocalFile));
			const items = results.filter((i): i is BinItem => i !== null);
			const skipped = results.length - items.length;

			if (items.length > 0) addItems(items);
			if (skipped > 0) {
				onNotify?.(
					`Skipped ${skipped} unsupported file${skipped > 1 ? 's' : ''}.`,
					items.length > 0 ? 'info' : 'error'
				);
			}
		} finally {
			busy = false;
		}
	}

	function onPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		void handleFiles(input.files);
		// Reset so picking the same file again still fires `change`.
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		void handleFiles(e.dataTransfer?.files ?? null);
	}

	// Without preventDefault on dragover the browser navigates to the dropped
	// file and the whole editor is replaced by a bare video player.
	function onDragOver(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
		dragging = true;
	}
</script>

<div
	role="region"
	aria-label="Open media"
	class="flex flex-col items-center gap-1 rounded border border-dashed p-2 text-center transition-colors {dragging
		? 'border-primary bg-primary/10'
		: 'border-border'}"
	ondragover={onDragOver}
	ondragenter={onDragOver}
	ondragleave={() => (dragging = false)}
	ondrop={onDrop}
>
	<input
		bind:this={fileInput}
		type="file"
		multiple
		accept="video/*,audio/*,image/*"
		class="hidden"
		onchange={onPick}
	/>
	<button
		type="button"
		class="w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-60"
		disabled={busy}
		onclick={() => fileInput?.click()}
	>
		{busy ? 'Opening…' : 'Open media'}
	</button>
	<p class="text-[10px] leading-tight text-muted-foreground">
		or drop files here — local files last for this session only
	</p>
</div>
