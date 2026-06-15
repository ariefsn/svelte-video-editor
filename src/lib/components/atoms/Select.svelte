<script lang="ts" module>
	export type SelectItem = { label: string; value: string; disabled?: boolean };
</script>

<script lang="ts">
	import { cn } from '../../utils.js';

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
<!--
  `appearance-none` removes the native arrow (which the browser pins to the far
  right regardless of padding); we draw our own chevron as a background SVG so
  its position is controllable. `pr-8` then reserves room for it.
-->
<select
	{id}
	{name}
	{disabled}
	{value}
	onchange={handleChange}
	style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;); background-repeat: no-repeat; background-position: right 0.5rem center; background-size: 1rem;"
	class={cn(
		'flex h-9 w-full appearance-none items-center rounded-md border border-input bg-background py-1 pr-8 pl-3 text-sm text-foreground shadow-sm',
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
