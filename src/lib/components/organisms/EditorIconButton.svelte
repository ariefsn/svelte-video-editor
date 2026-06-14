<script lang="ts">
	import { Button, Tooltip } from '../atoms/index.js';
	import type { Snippet } from 'svelte';

	type Props = {
		label: string;
		onclick: () => void;
		disabled?: boolean;
		active?: boolean;
		children: Snippet;
	};

	let { label, onclick, disabled = false, active = false, children }: Props = $props();
</script>

<Tooltip text={label}>
	{#snippet child({ props })}
		<Button
			{...props}
			variant={active ? 'secondary' : 'ghost'}
			size="icon"
			class="size-7"
			aria-label={label}
			{disabled}
			{onclick}
		>
			{@render children()}
		</Button>
	{/snippet}
</Tooltip>
