<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Loader2 } from '@lucide/svelte';
	import { Button, Dialog } from '../atoms/index.js';

	type Props = {
		open: boolean;
		onOpenChange: (v: boolean) => void;
		title: Snippet;
		description?: Snippet;
		children?: Snippet;
		actions?: Snippet;
		onConfirm?: () => void;
		loading?: boolean;
		/** Localized labels; default to English. */
		confirmLabel?: string;
		cancelLabel?: string;
		loadingLabel?: string;
	};

	let {
		open,
		onOpenChange,
		title,
		description,
		children,
		actions,
		onConfirm,
		loading = false,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		loadingLabel = 'Deleting…'
	}: Props = $props();

	function handleOpenChange(v: boolean) {
		if (loading) return;
		onOpenChange(v);
	}
</script>

{#snippet defaultActions()}
	<Button variant="outline" onclick={() => handleOpenChange(false)} disabled={loading}>
		{cancelLabel}
	</Button>
	<Button variant="destructive" disabled={loading} onclick={() => onConfirm?.()}>
		{#if loading}
			<Loader2 class="size-4 animate-spin" />
			{loadingLabel}
		{:else}
			{confirmLabel}
		{/if}
	</Button>
{/snippet}

<Dialog
	{open}
	onOpenChange={handleOpenChange}
	{title}
	{description}
	footer={actions ?? defaultActions}
>
	{#snippet children()}
		{@render children?.()}
	{/snippet}
</Dialog>
