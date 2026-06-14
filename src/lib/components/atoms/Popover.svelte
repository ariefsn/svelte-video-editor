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
		trigger: Snippet<[{ props: TriggerProps }]>;
		content: Snippet<[{ close: () => void }]>;
	};

	let {
		open = $bindable(false),
		side = 'bottom',
		align = 'center',
		contentClass,
		trigger,
		content
	}: Props = $props();

	const contentId = `ts-popover-${uid()}`;
	let panel = $state<HTMLDivElement | null>(null);

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
				const root = panel.closest('.relative');
				if (root && root.contains(target)) return;
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

<span class="relative inline-flex">
	{@render trigger({ props: triggerProps })}

	{#if open}
		<div
			bind:this={panel}
			id={contentId}
			role="dialog"
			class={cn(
				'absolute z-50 rounded-md border bg-background p-4 text-foreground shadow-md outline-none',
				sideClass,
				alignClass,
				contentClass
			)}
		>
			{@render content({ close })}
		</div>
	{/if}
</span>
