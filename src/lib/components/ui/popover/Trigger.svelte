<script lang="ts">
	import type { Snippet } from 'svelte';
	import { usePopoverCtx } from './context.js';

	type TriggerProps = {
		onclick: (e: MouseEvent) => void;
		'aria-haspopup': 'dialog';
		'aria-expanded': boolean;
		'aria-controls': string;
	};

	let { children, child }: { children?: Snippet; child?: Snippet<[{ props: TriggerProps }]> } =
		$props();

	const ctx = usePopoverCtx();

	const triggerProps: TriggerProps = {
		onclick: () => {
			ctx.open = !ctx.open;
		},
		'aria-haspopup': 'dialog',
		get 'aria-expanded'() {
			return ctx.open;
		},
		'aria-controls': ctx.contentId
	};
</script>

{#if child}
	{@render child({ props: triggerProps })}
{:else}
	<button type="button" {...triggerProps}>
		{@render children?.()}
	</button>
{/if}
