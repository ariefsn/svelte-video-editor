<script lang="ts">
	import { cn } from '../../utils.js';

	type Props = {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		class?: string;
		ariaLabel?: string;
		onchange?: (value: number) => void;
		/** Fires once when the drag ends (native `change`), unlike `onchange`
		 * which fires continuously per input. */
		oncommit?: (value: number) => void;
	};

	let {
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		disabled = false,
		class: className,
		ariaLabel,
		onchange,
		oncommit
	}: Props = $props();

	function handleInput(e: Event) {
		const next = Number((e.currentTarget as HTMLInputElement).value);
		value = next;
		onchange?.(next);
	}

	function handleCommit(e: Event) {
		oncommit?.(Number((e.currentTarget as HTMLInputElement).value));
	}
</script>

<input
	type="range"
	{min}
	{max}
	{step}
	{disabled}
	{value}
	aria-label={ariaLabel}
	oninput={handleInput}
	onchange={handleCommit}
	class={cn(
		'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-50',
		className
	)}
/>
