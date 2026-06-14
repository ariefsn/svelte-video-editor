<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '../../utils.js';

	let {
		value = $bindable(),
		class: className,
		...restProps
	}: HTMLInputAttributes & { class?: string } = $props();
</script>

<input
	bind:value
	class={cn(
		'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm transition-colors',
		'placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
		'aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...restProps}
/>
