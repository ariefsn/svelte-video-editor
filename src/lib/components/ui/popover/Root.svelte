<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setPopoverCtx } from './context.js';

	let { open = $bindable(false), children }: { open?: boolean; children?: Snippet } = $props();

	const contentId = `ts-popover-${Math.random().toString(36).slice(2)}`;

	setPopoverCtx({
		get open() {
			return open;
		},
		set open(v: boolean) {
			open = v;
		},
		contentId
	});
</script>

<span class="relative inline-flex">
	{@render children?.()}
</span>
