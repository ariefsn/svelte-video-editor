<script lang="ts" module>
	// Minimal zero-dependency toast for the demo (no svelte-sonner).
	import type { NotifyKind } from '$lib/index.js';

	type Toast = { id: number; message: string; kind: NotifyKind };
	let items = $state<Toast[]>([]);
	let seq = 0;

	export function pushToast(message: string, kind: NotifyKind = 'info'): void {
		const id = ++seq;
		items = [...items, { id, message, kind }];
		setTimeout(() => {
			items = items.filter((t) => t.id !== id);
		}, 3500);
	}
</script>

<script lang="ts">
	const color: Record<NotifyKind, string> = {
		info: 'border-l-sky-500',
		success: 'border-l-emerald-500',
		warning: 'border-l-amber-500',
		error: 'border-l-red-500'
	};
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col gap-2">
	{#each items as toast (toast.id)}
		<div
			class="pointer-events-auto rounded-md border border-l-4 bg-background px-3 py-2 text-sm text-foreground shadow-lg {color[
				toast.kind
			]}"
		>
			{toast.message}
		</div>
	{/each}
</div>
