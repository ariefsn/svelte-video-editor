<script lang="ts">
	import './layout.css';
	import { theme } from './theme.svelte.js';

	const { children } = $props();

	$effect(() => {
		theme.init();
	});
</script>

{@render children()}
