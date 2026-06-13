<script lang="ts">
	import { cn } from '../../../utils.js';
	let { class: className }: { class?: string } = $props();
</script>

<div role="separator" class={cn('my-1 h-px bg-border', className)}></div>
