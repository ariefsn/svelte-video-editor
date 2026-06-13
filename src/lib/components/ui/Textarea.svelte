<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';
	import { cn } from '../../utils.js';

	let {
		value = $bindable(),
		class: className,
		...restProps
	}: HTMLTextareaAttributes & { class?: string } = $props();
</script>

<textarea
	bind:value
	class={cn(
		'flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
		'placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
		'aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
	{...restProps}
></textarea>
