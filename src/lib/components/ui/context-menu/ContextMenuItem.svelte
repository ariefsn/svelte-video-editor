<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '../../../utils.js';
	import { useContextMenuCtx } from './context.js';

	type Props = {
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		variant?: 'default' | 'destructive';
		class?: string;
		children?: Snippet;
	};

	let { onclick, disabled = false, variant = 'default', class: className, children }: Props =
		$props();

	const ctx = useContextMenuCtx();

	function handle(e: MouseEvent) {
		if (disabled) return;
		onclick?.(e);
		ctx.close();
	}
</script>

<button
	type="button"
	role="menuitem"
	{disabled}
	aria-disabled={disabled}
	onclick={handle}
	class={cn(
		'flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none select-none',
		'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent',
		'disabled:pointer-events-none disabled:opacity-50',
		variant === 'destructive' && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
		className
	)}
>
	{@render children?.()}
</button>
