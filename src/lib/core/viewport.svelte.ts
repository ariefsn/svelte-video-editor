// Browser-only viewport helpers. No browser API at module scope — `matchMedia`
// is read inside an `$effect`, so SSR keeps `current` at its desktop-first
// default (`false`) and the listener only attaches client-side after mount.

/** Tailwind `md` breakpoint — below this we treat the layout as "mobile". */
export const MOBILE_BREAKPOINT_PX = 768;

/**
 * Reactive `max-width` media-query match. Call once inside a component:
 *
 * ```ts
 * const viewport = createIsMobile();
 * const isMobile = $derived(viewport.current);
 * ```
 */
export function createIsMobile(breakpointPx: number = MOBILE_BREAKPOINT_PX) {
	let matches = $state(false);

	$effect(() => {
		const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
		matches = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (matches = e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	return {
		get current() {
			return matches;
		}
	};
}
