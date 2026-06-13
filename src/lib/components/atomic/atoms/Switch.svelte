<script lang="ts">
	import Switch from '../../ui/Switch.svelte';
	import Label from '../../ui/Label.svelte';
	import { uid } from '../../../utils.js';

	type Props = {
		id?: string;
		name?: string;
		label?: string;
		checked?: boolean;
		disabled?: boolean;
		class?: string;
		onCheckedChange?: (checked: boolean) => void;
	};

	let {
		id,
		name,
		label,
		checked = $bindable(false),
		disabled = false,
		class: className,
		onCheckedChange
	}: Props = $props();

	const switchId = id ?? `switch-${uid()}`;
</script>

<div class="flex items-center gap-2">
	<Switch id={switchId} {name} bind:checked {disabled} class={className} {onCheckedChange} />
	{#if label}
		<Label for={switchId} class="cursor-pointer">{label}</Label>
	{/if}
</div>
