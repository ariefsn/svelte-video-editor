<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setContextMenuCtx } from './context.js';

	let { children }: { children?: Snippet } = $props();

	let open = $state(false);
	let x = $state(0);
	let y = $state(0);

	setContextMenuCtx({
		get open() {
			return open;
		},
		get x() {
			return x;
		},
		get y() {
			return y;
		},
		openAt(nx: number, ny: number) {
			x = nx;
			y = ny;
			open = true;
		},
		close() {
			open = false;
		}
	});
</script>

{@render children?.()}
