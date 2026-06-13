<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '../../../utils.js';
	import { useContextMenuCtx } from './context.js';

	let { class: className, children }: { class?: string; children?: Snippet } = $props();

	const ctx = useContextMenuCtx();
	let panel = $state<HTMLDivElement | null>(null);

	// Clamp the menu inside the viewport once it has a measured size.
	let pos = $state({ x: 0, y: 0 });
	$effect(() => {
		if (!ctx.open || !panel) return;
		const rect = panel.getBoundingClientRect();
		const maxX = window.innerWidth - rect.width - 8;
		const maxY = window.innerHeight - rect.height - 8;
		pos = { x: Math.min(ctx.x, Math.max(8, maxX)), y: Math.min(ctx.y, Math.max(8, maxY)) };
	});

	// Outside-dismiss with CAPTURE-phase listeners: clips/tracks call
	// stopPropagation on their pointer handlers, so a bubbling window listener
	// would never see the click. Capture runs before those handlers.
	$effect(() => {
		if (!ctx.open) return;

		const onDown = (e: PointerEvent) => {
			if (panel && !panel.contains(e.target as Node)) ctx.close();
		};
		const onScroll = () => ctx.close();
		const onCtx = (e: MouseEvent) => {
			// A right-click elsewhere closes this menu (the new trigger reopens it).
			if (panel && !panel.contains(e.target as Node)) ctx.close();
		};

		// Defer attaching until after the opening event finishes, so the very
		// click/contextmenu that opened the menu doesn't immediately close it.
		const raf = requestAnimationFrame(() => {
			document.addEventListener('pointerdown', onDown, true);
			document.addEventListener('contextmenu', onCtx, true);
			window.addEventListener('scroll', onScroll, true);
			window.addEventListener('resize', onScroll);
			window.addEventListener('blur', onScroll);
		});

		return () => {
			cancelAnimationFrame(raf);
			document.removeEventListener('pointerdown', onDown, true);
			document.removeEventListener('contextmenu', onCtx, true);
			window.removeEventListener('scroll', onScroll, true);
			window.removeEventListener('resize', onScroll);
			window.removeEventListener('blur', onScroll);
		};
	});

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && ctx.open) ctx.close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if ctx.open}
	<div
		bind:this={panel}
		role="menu"
		tabindex="-1"
		class={cn(
			'fixed z-50 min-w-40 overflow-hidden rounded-md border bg-background p-1 text-foreground shadow-md',
			className
		)}
		style="left: {pos.x}px; top: {pos.y}px;"
	>
		{@render children?.()}
	</div>
{/if}
