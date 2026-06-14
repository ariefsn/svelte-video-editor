// Browser-only viewport helpers. No browser API at module scope — `matchMedia`
// is read inside an `$effect`, so SSR keeps `current` at its desktop-first
// default (`false`) and the listener only attaches client-side after mount.

import { getContext, setContext } from 'svelte';

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

// ---- shared viewport context ---------------------------------------------
// TimelineEditor creates one `createIsMobile()` and provides it here so its
// section components (toolbar, tracks, footer) read the same breakpoint state
// without each spawning their own matchMedia listener.

const VIEWPORT_KEY = Symbol.for('svelte-video-editor-viewport');

export type ViewportCtx = { get isMobile(): boolean };

export function setViewport(ctx: ViewportCtx): ViewportCtx {
	return setContext(VIEWPORT_KEY, ctx);
}

/** Reactive `isMobile`. Falls back to desktop (`false`) when used outside an
 * editor, so the overridable section components still render standalone. */
export function useViewport(): ViewportCtx {
	return (
		getContext<ViewportCtx>(VIEWPORT_KEY) ?? {
			get isMobile() {
				return false;
			}
		}
	);
}
