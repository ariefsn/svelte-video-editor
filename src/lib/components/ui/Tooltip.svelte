<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '../../utils.js';

	// Zero-dependency tooltip. Opens on hover (after `delayDuration`) and on
	// keyboard focus; closes on leave/blur/Escape. By default it ignores
	// non-keyboard (programmatic / mouse-down) focus so a focus-trap mounting
	// the trigger doesn't flash it open.
	//
	// The bubble renders in a FIXED layer positioned from the trigger's bounding
	// rect, so it is never clipped by an ancestor's overflow (toolbars/tracks use
	// overflow-x-auto). `child` renders the trigger as the caller's own element.
	type TriggerProps = {
		onpointerenter: (e: PointerEvent) => void;
		onpointerleave: (e: PointerEvent) => void;
		onfocus: (e: FocusEvent) => void;
		onblur: (e: FocusEvent) => void;
		onkeydown: (e: KeyboardEvent) => void;
		onpointerdown: (e: PointerEvent) => void;
		'aria-describedby': string | undefined;
	};

	type Props = {
		text?: string;
		side?: 'top' | 'bottom' | 'left' | 'right';
		ignoreNonKeyboardFocus?: boolean;
		delayDuration?: number;
		contentClass?: string;
		children?: Snippet;
		child?: Snippet<[{ props: TriggerProps }]>;
		content?: Snippet;
	};

	let {
		text,
		side = 'top',
		ignoreNonKeyboardFocus = true,
		delayDuration = 200,
		contentClass,
		children,
		child,
		content
	}: Props = $props();

	let open = $state(false);
	let coords = $state({ x: 0, y: 0 });
	let pointerDown = false;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let anchor = $state<HTMLElement | null>(null);
	const id = `ts-tip-${Math.random().toString(36).slice(2)}`;

	function clearTimer() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function measure(target: HTMLElement | null) {
		const el = target ?? anchor;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const GAP = 6;
		if (side === 'top') coords = { x: r.left + r.width / 2, y: r.top - GAP };
		else if (side === 'bottom') coords = { x: r.left + r.width / 2, y: r.bottom + GAP };
		else if (side === 'left') coords = { x: r.left - GAP, y: r.top + r.height / 2 };
		else coords = { x: r.right + GAP, y: r.top + r.height / 2 };
	}

	function show(e: { currentTarget: EventTarget | null }) {
		const el = e.currentTarget instanceof HTMLElement ? e.currentTarget : anchor;
		clearTimer();
		timer = setTimeout(() => {
			measure(el);
			open = true;
		}, delayDuration);
	}

	function hide() {
		clearTimer();
		open = false;
	}

	const triggerProps: TriggerProps = {
		onpointerenter: (e) => show(e),
		onpointerleave: () => hide(),
		onpointerdown: () => {
			pointerDown = true;
			hide();
		},
		onfocus: (e) => {
			if (ignoreNonKeyboardFocus && pointerDown) {
				pointerDown = false;
				return;
			}
			pointerDown = false;
			measure(e.currentTarget instanceof HTMLElement ? e.currentTarget : anchor);
			open = true;
		},
		onblur: () => hide(),
		onkeydown: (e) => {
			if (e.key === 'Escape') hide();
		},
		'aria-describedby': open ? id : undefined
	};

	// translate so the bubble sits on the chosen side of the anchor point.
	const transformClass = $derived(
		{
			top: '-translate-x-1/2 -translate-y-full',
			bottom: '-translate-x-1/2',
			left: '-translate-x-full -translate-y-1/2',
			right: '-translate-y-1/2'
		}[side]
	);

	const hasContent = $derived(!!content || (text != null && text !== ''));
</script>

<span class="contents" bind:this={anchor}>
	{#if child}
		{@render child({ props: triggerProps })}
	{:else}
		<span
			class="inline-flex"
			tabindex="-1"
			role="presentation"
			onpointerenter={triggerProps.onpointerenter}
			onpointerleave={triggerProps.onpointerleave}
			onpointerdown={triggerProps.onpointerdown}
			onfocusin={triggerProps.onfocus}
			onfocusout={triggerProps.onblur}
			onkeydown={triggerProps.onkeydown}
			aria-describedby={triggerProps['aria-describedby']}
		>
			{@render children?.()}
		</span>
	{/if}
</span>

{#if open && hasContent}
	<div
		{id}
		role="tooltip"
		class={cn(
			'pointer-events-none fixed z-60 w-max max-w-xs rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-md',
			transformClass,
			contentClass
		)}
		style="left: {coords.x}px; top: {coords.y}px;"
	>
		{#if content}
			{@render content()}
		{:else}
			{text}
		{/if}
	</div>
{/if}
