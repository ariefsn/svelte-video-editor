<script lang="ts" module>
	export type ButtonGroupOption = {
		value: string;
		label: string;
		disabled?: boolean;
	};
</script>

<script lang="ts">
	import Button from './Button.svelte';
	import { cn } from '../../../utils.js';

	type Props = {
		value: string;
		options: ButtonGroupOption[];
		orientation?: 'horizontal' | 'vertical';
		size?: 'sm' | 'default' | 'lg' | 'icon';
		onValueChange?: (value: string) => void;
		class?: string;
	};

	let {
		value,
		options,
		orientation = 'horizontal',
		size = 'sm',
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
			disabled={opt.disabled}
			onclick={() => onValueChange?.(opt.value)}
		>
			{opt.label}
		</Button>
	{/each}
</div>
