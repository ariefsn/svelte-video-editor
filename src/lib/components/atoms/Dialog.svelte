<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '../../utils.js';

	// Zero-dependency modal dialog. Overlay + centered panel, Escape to close,
	// click-outside to close (unless `forever`), basic focus handling. API
	// matches the previous shadcn-backed atom: bind:open, onOpened/onClosed,
	// title/description/footer snippets, default children slot.
	type Props = {
		open?: boolean;
		onOpened?: () => void;
		onClosed?: () => void;
		onOpenChange?: (v: boolean) => void;
		title: Snippet;
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
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
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
			class={cn(
				'relative z-10 flex w-full max-w-lg flex-col gap-4 rounded-lg border bg-background p-6 text-foreground shadow-lg outline-none',
				className
			)}
		>
			<div class="flex flex-col gap-1.5">
				<h2 class="text-lg font-semibold">{@render title()}</h2>
				{#if description}
					<p class="text-sm text-muted-foreground">{@render description()}</p>
				{/if}
			</div>

			{@render children()}

			{#if footer}
				<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
