<script lang="ts" module>
	import type { Snippet } from 'svelte';

	/** Passed to the `content` snippet so items can dismiss the menu after acting. */
	export type ContextMenuApi = {
		close: () => void;
		/** Styled menu item. */
		item: Snippet<[ContextMenuItemProps]>;
		/** Thin divider between groups of items. */
		separator: Snippet<[{ class?: string }?]>;
	};

	export type ContextMenuItemProps = {
		children: Snippet;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		variant?: 'default' | 'destructive';
		class?: string;
	};
</script>

<script lang="ts">
	import { cn } from '../../utils.js';

	// Single-component context menu (Svelte-native, snippet-driven — no shared
	// context module). The consumer supplies a `trigger` snippet (receives the
	// right-click props to spread) and a `content` snippet (receives `{ close,
	// item, separator }`). Example:
	//
	//   <ContextMenu>
	//     {#snippet trigger({ props })}<div {...props}>…</div>{/snippet}
	//     {#snippet content({ item, separator })}
	//       {#snippet cut()}Cut{/snippet}
	//       {@render item({ onclick: doCut, children: cut })}
	//       {@render separator()}
	//     {/snippet}
	//   </ContextMenu>
	type TriggerProps = { oncontextmenu: (e: MouseEvent) => void };

	type Props = {
		trigger: Snippet<[{ props: TriggerProps }]>;
		content: Snippet<[ContextMenuApi]>;
		class?: string;
	};

	let { trigger, content, class: className }: Props = $props();

	let open = $state(false);
	let x = $state(0);
	let y = $state(0);
	let panel = $state<HTMLDivElement | null>(null);

	function close() {
		open = false;
	}

	const triggerProps: TriggerProps = {
		oncontextmenu: (e: MouseEvent) => {
			e.preventDefault();
			x = e.clientX;
			y = e.clientY;
			open = true;
		}
	};

	// Clamp the menu inside the viewport once it has a measured size.
	let pos = $state({ x: 0, y: 0 });
	$effect(() => {
		if (!open || !panel) return;
		const rect = panel.getBoundingClientRect();
		const maxX = window.innerWidth - rect.width - 8;
		const maxY = window.innerHeight - rect.height - 8;
		pos = { x: Math.min(x, Math.max(8, maxX)), y: Math.min(y, Math.max(8, maxY)) };
	});

	// Outside-dismiss with CAPTURE-phase listeners: clips/tracks call
	// stopPropagation on their pointer handlers, so a bubbling window listener
	// would never see the click. Capture runs before those handlers.
	$effect(() => {
		if (!open) return;

		const onDown = (e: PointerEvent) => {
			if (panel && !panel.contains(e.target as Node)) close();
		};
		const onScroll = () => close();
		const onCtx = (e: MouseEvent) => {
			// A right-click elsewhere closes this menu (the new trigger reopens it).
			if (panel && !panel.contains(e.target as Node)) close();
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
		if (e.key === 'Escape' && open) close();
	}

	function handleItem(e: MouseEvent, p: ContextMenuItemProps) {
		if (p.disabled) return;
		p.onclick?.(e);
		close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{@render trigger({ props: triggerProps })}

{#snippet item(p: ContextMenuItemProps)}
	<button
		type="button"
		role="menuitem"
		disabled={p.disabled}
		aria-disabled={p.disabled}
		onclick={(e) => handleItem(e, p)}
		class={cn(
			'flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none select-none',
			'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent',
			'disabled:pointer-events-none disabled:opacity-50',
			p.variant === 'destructive' &&
				'text-destructive hover:bg-destructive/10 hover:text-destructive',
			p.class
		)}
	>
		{@render p.children()}
	</button>
{/snippet}

{#snippet separator(sep?: { class?: string })}
	<div role="separator" class={cn('my-1 h-px bg-border', sep?.class)}></div>
{/snippet}

{#if open}
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
		{@render content({ close, item, separator })}
	</div>
{/if}
