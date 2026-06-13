<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '../../utils.js';

	let {
		for: htmlFor,
		class: className,
		children
	}: { for?: string; class?: string; children?: Snippet } = $props();
</script>

<label
	for={htmlFor}
	class={cn('text-sm leading-none font-medium select-none', className)}
>
	{@render children?.()}
</label>
