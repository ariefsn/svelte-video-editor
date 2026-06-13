<script lang="ts" module>
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export type ButtonVariant =
		| 'default'
		| 'ghost'
		| 'outline'
		| 'secondary'
		| 'destructive'
		| 'link';
	export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

	export type ButtonProps = HTMLButtonAttributes & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	};

	const VARIANTS: Record<ButtonVariant, string> = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/90',
		ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
		outline:
			'border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		link: 'text-primary underline-offset-4 hover:underline'
	};

	const SIZES: Record<ButtonSize, string> = {
		default: 'h-9 px-4 py-2',
		sm: 'h-8 rounded-md px-3 text-xs',
		lg: 'h-10 rounded-md px-6',
		icon: 'h-9 w-9'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '../../utils.js';

	let {
		variant = 'default',
		size = 'default',
		class: className,
		type = 'button',
		children,
		...restProps
	}: ButtonProps & { children?: Snippet } = $props();
</script>

<button
	{type}
	class={cn(
		'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
		VARIANTS[variant],
		SIZES[size],
		className
	)}
	{...restProps}
>
	{@render children?.()}
</button>
