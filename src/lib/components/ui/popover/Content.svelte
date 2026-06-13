<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '../../../utils.js';
	import { usePopoverCtx } from './context.js';

	type Props = {
		class?: string;
		side?: 'top' | 'bottom' | 'left' | 'right';
		align?: 'start' | 'center' | 'end';
		children?: Snippet;
	};

	let { class: className, side = 'bottom', align = 'center', children }: Props = $props();

	const ctx = usePopoverCtx();

	let panel = $state<HTMLDivElement | null>(null);

	// Outside-dismiss via CAPTURE phase — triggers (e.g. the marker flag) call
	// stopPropagation on pointerdown, so a bubbling listener never sees the
	// click. Capture runs first. Clicking the trigger itself (same .relative
	// root) toggles via its own handler, so we ignore clicks inside that root.
	$effect(() => {
		if (!ctx.open) return;
		const onDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (panel && !panel.contains(target)) {
				const root = panel.closest('.relative');
				if (root && root.contains(target)) return;
				ctx.open = false;
			}
		};
		const raf = requestAnimationFrame(() => {
			document.addEventListener('pointerdown', onDown, true);
		});
		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener('pointerdown', onDown, true);
		};
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && ctx.open) ctx.open = false;
	}

	const sideClass = $derived(
		{
			top: 'bottom-full mb-2',
			bottom: 'top-full mt-2',
			left: 'right-full mr-2',
			right: 'left-full ml-2'
		}[side]
	);
	const alignClass = $derived(
		side === 'top' || side === 'bottom'
			? { start: 'left-0', center: 'left-1/2 -translate-x-1/2', end: 'right-0' }[align]
			: { start: 'top-0', center: 'top-1/2 -translate-y-1/2', end: 'bottom-0' }[align]
	);
</script>

<svelte:window onkeydown={onKeydown} />

{#if ctx.open}
	<div
		bind:this={panel}
		id={ctx.contentId}
		role="dialog"
		class={cn(
			'absolute z-50 rounded-md border bg-background p-4 text-foreground shadow-md outline-none',
			sideClass,
			alignClass,
			className
		)}
	>
		{@render children?.()}
	</div>
{/if}
