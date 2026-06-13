<script lang="ts" module>
	export type SelectItem = { label: string; value: string; disabled?: boolean };
</script>

<script lang="ts">
	import { cn } from '../../../utils.js';

	type Props = {
		value?: string;
		items?: SelectItem[];
		placeholder?: string;
		id?: string;
		name?: string;
		disabled?: boolean;
		class?: string;
		onValueChange?: (value: string) => void;
	};

	let {
		value = $bindable(''),
		items = [],
		placeholder = '',
		id,
		name,
		disabled = false,
		class: className,
		onValueChange
	}: Props = $props();

	function handleChange(e: Event) {
		const next = (e.currentTarget as HTMLSelectElement).value;
		value = next;
		onValueChange?.(next);
	}
</script>

<!--
  Native <select>: `disabled` is honored end-to-end by the browser — a disabled
  select cannot be opened, focused into, or changed. (The previous shadcn-backed
  atom only styled it disabled while leaving the listbox operable.)
-->
<select
	{id}
	{name}
	{disabled}
	{value}
	onchange={handleChange}
	class={cn(
		'flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm',
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
		'disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
>
	{#if placeholder}
		<option class="bg-background text-foreground" value="" disabled hidden={value !== ''}
			>{placeholder}</option
		>
	{/if}
	{#each items as item (item.value)}
		<option class="bg-background text-foreground" value={item.value} disabled={item.disabled}
			>{item.label}</option
		>
	{/each}
</select>
