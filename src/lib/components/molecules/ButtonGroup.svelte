<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export type ButtonGroupOption = {
		value: string;
		/** Text label; optional when an `icon` is supplied. */
		label?: string;
		/** Icon snippet rendered before the label (or alone, for icon-only tabs). */
		icon?: Snippet;
		/** Accessible name — required when the option is icon-only. */
		ariaLabel?: string;
		disabled?: boolean;
	};
</script>

<script lang="ts">
	import { Button } from '../atoms/index.js';
	import { cn } from '../../utils.js';

	type Props = {
		value: string;
		options: ButtonGroupOption[];
		orientation?: 'horizontal' | 'vertical';
		size?: 'sm' | 'default' | 'lg' | 'icon';
		/** Make every button share equal width (1/n of the group). */
		equalWidth?: boolean;
		onValueChange?: (value: string) => void;
		class?: string;
	};

	let {
		value,
		options,
		orientation = 'horizontal',
		size = 'sm',
		equalWidth = false,
		onValueChange,
		class: className
	}: Props = $props();
</script>

<div
	role="group"
	class={cn(
		'inline-flex isolate',
		orientation === 'vertical' ? 'flex-col' : 'flex-row',
		// collapse the seam between adjacent buttons
		orientation === 'vertical'
			? '[&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none'
			: '[&>*:not(:first-child)]:-ml-px [&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none',
		className
	)}
>
	{#each options as opt (opt.value)}
		<Button
			variant={value === opt.value ? 'default' : 'outline'}
			{size}
			class={cn(
				equalWidth ? 'flex-1 basis-0 px-0' : opt.icon && !opt.label && 'aspect-square px-0'
			)}
			disabled={opt.disabled}
			aria-label={opt.ariaLabel}
			onclick={() => onValueChange?.(opt.value)}
		>
			{@render opt.icon?.()}
			{#if opt.label}{opt.label}{/if}
		</Button>
	{/each}
</div>
