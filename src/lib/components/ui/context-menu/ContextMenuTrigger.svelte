<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useContextMenuCtx } from './context.js';

	type TriggerProps = {
		oncontextmenu: (e: MouseEvent) => void;
	};

	let { children, child }: { children?: Snippet; child?: Snippet<[{ props: TriggerProps }]> } =
		$props();

	const ctx = useContextMenuCtx();

	const triggerProps: TriggerProps = {
		oncontextmenu: (e: MouseEvent) => {
			e.preventDefault();
			ctx.openAt(e.clientX, e.clientY);
		}
	};
</script>

{#if child}
	{@render child({ props: triggerProps })}
{:else}
	<span {...triggerProps}>
		{@render children?.()}
	</span>
{/if}
