<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		message: string;
		icon?: Snippet;
		class?: string;
	};

	let { message, icon, class: className = '' }: Props = $props();
</script>

<div
	class="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center {className}"
>
	{#if icon}
		{@render icon()}
	{/if}
	<p class="text-sm text-muted-foreground">{message}</p>
</div>
