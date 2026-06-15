<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '../../utils.js';
	import { uid } from '../../utils.js';

	// Single-component popover (Svelte-native, snippet-driven — no shared context
	// module). The consumer supplies a `trigger` snippet (receives toggle props to
	// spread) and a `content` snippet (receives `{ close }`). Example:
	//
	//   <Popover bind:open side="bottom" contentClass="w-56 p-3">
	//     {#snippet trigger({ props })}<div {...props}>…</div>{/snippet}
	//     {#snippet content({ close })}…{/snippet}
	//   </Popover>
	type TriggerProps = {
		onclick: (e: MouseEvent) => void;
		'aria-haspopup': 'dialog';
		'aria-expanded': boolean;
		'aria-controls': string;
	};

	type Props = {
		open?: boolean;
		side?: 'top' | 'bottom' | 'left' | 'right';
		align?: 'start' | 'center' | 'end';
		contentClass?: string;
		/** Render the panel in a fixed layer positioned from the trigger's rect, so
		 * it is never clipped by an ancestor's overflow (e.g. the toolbar's
		 * `overflow-x-auto`). Same technique as Tooltip. */
		fixed?: boolean;
		trigger: Snippet<[{ props: TriggerProps }]>;
		content: Snippet<[{ close: () => void }]>;
	};

	let {
		open = $bindable(false),
		side = 'bottom',
		align = 'center',
		contentClass,
		fixed = false,
		trigger,
		content
	}: Props = $props();

	const contentId = `ts-popover-${uid()}`;
	let panel = $state<HTMLDivElement | null>(null);
	let root = $state<HTMLSpanElement | null>(null);
	let coords = $state({ x: 0, y: 0 });

	// For fixed mode: measure the trigger root and place the panel against it.
	// `x`/`y` are the panel's top edge; `anchorRight` (when align==='end') pins the
	// panel's right edge to the trigger's right via a CSS transform. After the
	// panel mounts we clamp x to keep it within the viewport on narrow screens.
	let anchorRight = $state(false);
	const MARGIN = 8;
	function measure() {
		if (!fixed || !root) return;
		const r = root.getBoundingClientRect();
		const GAP = 8;
		anchorRight = align === 'end';
		const y = side === 'top' ? r.top - GAP : r.bottom + GAP;
		coords = { x: align === 'end' ? r.right : r.left, y };
	}

	function clampToViewport() {
		if (!fixed || !panel) return;
		const w = panel.offsetWidth;
		// left edge of the panel after the anchorRight transform is applied
		const left = anchorRight ? coords.x - w : coords.x;
		const max = window.innerWidth - w - MARGIN;
		const clampedLeft = Math.max(MARGIN, Math.min(left, max));
		const nextX = anchorRight ? clampedLeft + w : clampedLeft;
		if (Math.abs(nextX - coords.x) > 0.5) coords = { ...coords, x: nextX };
	}

	$effect(() => {
		if (open) measure();
	});
	$effect(() => {
		if (open && panel) clampToViewport();
	});

	function close() {
		open = false;
	}

	const triggerProps: TriggerProps = {
		onclick: () => {
			open = !open;
		},
		'aria-haspopup': 'dialog',
		get 'aria-expanded'() {
			return open;
		},
		'aria-controls': contentId
	};

	// Outside-dismiss via CAPTURE phase — triggers (e.g. the marker flag) call
	// stopPropagation on pointerdown, so a bubbling listener never sees the click.
	// Capture runs first. Clicking the trigger itself (same .relative root)
	// toggles via its own handler, so we ignore clicks inside that root.
	$effect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (panel && !panel.contains(target)) {
				// Clicking the trigger itself toggles via its own handler — ignore.
				const triggerRoot = root ?? panel.closest('.relative');
				if (triggerRoot && triggerRoot.contains(target)) return;
				close();
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
		if (e.key === 'Escape' && open) close();
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

<span class="relative inline-flex" bind:this={root}>
	{@render trigger({ props: triggerProps })}

	{#if open}
		<div
			bind:this={panel}
			id={contentId}
			role="dialog"
			class={cn(
				'z-50 rounded-md border bg-background p-4 text-foreground shadow-md outline-none',
				fixed ? 'fixed' : 'absolute',
				fixed ? '' : sideClass,
				fixed ? '' : alignClass,
				contentClass
			)}
			style={fixed
				? `left: ${coords.x}px; top: ${coords.y}px; transform: translate(${anchorRight ? '-100%' : '0'}, ${side === 'top' ? '-100%' : '0'});`
				: undefined}
		>
			{@render content({ close })}
		</div>
	{/if}
</span>
