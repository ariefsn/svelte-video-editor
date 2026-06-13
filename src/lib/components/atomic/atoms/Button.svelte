<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button, { type ButtonProps } from '../../ui/Button.svelte';
	import { cn } from '../../../utils.js';

	type Props = ButtonProps & {
		fullWidthMobile?: boolean;
		block?: boolean;
		children?: Snippet;
	};

	let {
		variant = 'default',
		size = 'default',
		fullWidthMobile = false,
		class: className,
		block = false,
		children,
		...restProps
	}: Props = $props();
</script>

<Button
	{variant}
	{size}
	class={cn(fullWidthMobile && 'w-full md:w-auto', block && 'w-full', className)}
	{...restProps}
>
	{@render children?.()}
</Button>
