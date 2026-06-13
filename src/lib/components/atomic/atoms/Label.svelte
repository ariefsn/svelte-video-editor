<script lang="ts">
	import type { Snippet } from 'svelte';
	import Label from '../../ui/Label.svelte';

	let {
		for: htmlFor,
		class: className,
		children
	}: { for?: string; class?: string; children?: Snippet } = $props();
</script>

<Label for={htmlFor} class={className}>
	{@render children?.()}
</Label>
