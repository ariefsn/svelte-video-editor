// Composition background → CSS — pure, framework-free, and the single source of
// truth shared by the preview (PreviewStage) and any host/server compositor, so
// the exported video's background matches the editor exactly. Nothing here
// touches the DOM.

import type { ProjectBackground } from '../types/timeline.js';

/**
 * CSS value for a project background, usable directly as the `background`
 * shorthand. `null` resolves to `'transparent'` (no background); the default
 * project background is solid black, so the historical look is preserved unless
 * the user explicitly chooses transparent.
 */
export function backgroundCss(bg: ProjectBackground | null): string {
	if (!bg) return 'transparent';
	if (bg.type === 'solid') return bg.color;
	return `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})`;
}
