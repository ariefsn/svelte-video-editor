<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import Textarea from '../../ui/Textarea.svelte';
	import Label from '../../ui/Label.svelte';
	import { cn } from '../../../utils.js';

	type Props = ComponentProps<typeof Textarea> & {
		label?: string;
		error?: string;
	};

	let { label, error, id, class: className, value = $bindable(), ...restProps }: Props = $props();

	const inputId = $derived(
		id ?? (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
	);
</script>

<div class="flex flex-col gap-1.5">
	{#if label}
		<Label for={inputId}>{label}</Label>
	{/if}
	<Textarea id={inputId} class={cn(className)} aria-invalid={!!error} bind:value {...restProps} />
	{#if error}
		<p class="text-sm text-destructive">{error}</p>
	{/if}
</div>
