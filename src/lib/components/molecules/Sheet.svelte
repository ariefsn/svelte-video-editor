<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cn } from '../../utils.js';

	// Bottom-anchored modal sheet — the mobile counterpart to Dialog. Shares the
	// overlay / Escape / click-outside / symmetric-callback behaviour; differs by
	// anchoring to the bottom edge with a slide-up transition and a drag handle.
	// API mirrors Dialog so it can host the same section content (bin/inspector).
	type Props = {
		open?: boolean;
		onOpened?: () => void;
		onClosed?: () => void;
		onOpenChange?: (v: boolean) => void;
		title?: Snippet;
		description?: Snippet;
		children: Snippet;
		footer?: Snippet;
		forever?: boolean;
		class?: string;
	};

	let {
		open = $bindable(false),
		onOpened,
		onClosed,
		onOpenChange,
		title,
		description,
		children,
		footer,
		forever = false,
		class: className
	}: Props = $props();

	let panel = $state<HTMLDivElement | null>(null);

	function close() {
		if (forever) return;
		open = false;
		onOpenChange?.(false);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			e.stopPropagation();
			close();
		}
	}

	// Drive onOpened/onClosed symmetrically; skip the initial mount run.
	let prev: boolean | undefined = undefined;
	$effect(() => {
		if (prev === open) return;
		const wasUndefined = prev === undefined;
		prev = open;
		if (wasUndefined) return;
		if (open) {
			onOpened?.();
			queueMicrotask(() => panel?.focus());
		} else {
			onClosed?.();
		}
	});
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-end justify-center">
		<!-- overlay -->
		<button
			type="button"
			aria-label="Close"
			tabindex="-1"
			class="absolute inset-0 cursor-default bg-black/50"
			onclick={close}
		></button>
		<div
			bind:this={panel}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			transition:fly={{ y: 400, duration: 200 }}
			class={cn(
				'relative z-10 flex max-h-[85vh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl border-t bg-background p-4 text-foreground shadow-lg outline-none',
				className
			)}
		>
			<div class="mx-auto h-1 w-10 shrink-0 rounded-full bg-border"></div>

			{#if title}
				<div class="flex flex-col gap-1.5">
					<h2 class="text-lg font-semibold">{@render title()}</h2>
					{#if description}
						<p class="text-sm text-muted-foreground">{@render description()}</p>
					{/if}
				</div>
			{/if}

			<div class="min-h-0 flex-1">
				{@render children()}
			</div>

			{#if footer}
				<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
