<script lang="ts">
	import { cn } from '../../utils.js';
	import type { TextClip } from '../../types/timeline.js';
	import { clipAnimStyle } from '../../core/animation.js';
	import { textClipCss, toCssText } from '../../core/render.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';

	type Props = {
		clip: TextClip;
		stageWidth: number;
		stageHeight: number;
	};

	let { clip, stageWidth, stageHeight }: Props = $props();

	const editor = useTimelineEditor();
	const selected = $derived(editor.selectedClipIds.has(clip.id));
	const style = $derived(clip.style);
	const anim = $derived(clipAnimStyle(clip, editor.playhead, editor.project.fps));
	const css = $derived(toCssText(textClipCss(style, stageHeight, anim)));

	let dragging = false;
	let originX = 0;
	let originY = 0;
	let originXPct = 0;
	let originYPct = 0;

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		e.stopPropagation();
		editor.selectClip(clip.id, e.metaKey || e.ctrlKey);
		if (clip.locked) return;
		dragging = true;
		originX = e.clientX;
		originY = e.clientY;
		originXPct = style.xPct;
		originYPct = style.yPct;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		editor.beginGesture();
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging || stageWidth <= 0 || stageHeight <= 0) return;
		const xPct = Math.min(
			Math.max(0, originXPct + ((e.clientX - originX) / stageWidth) * 100),
			100
		);
		const yPct = Math.min(
			Math.max(0, originYPct + ((e.clientY - originY) / stageHeight) * 100),
			100
		);
		editor.updateTextClip(clip.id, { style: { xPct, yPct } });
	}

	function onPointerUp() {
		if (!dragging) return;
		dragging = false;
		editor.endGesture();
	}
</script>

<div
	role="button"
	tabindex="-1"
	aria-label={clip.text}
	class={cn(
		'touch-none select-none',
		clip.locked ? 'cursor-not-allowed' : 'cursor-move',
		selected && 'ring-1 ring-primary/80'
	)}
	style={css}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	{clip.text}
</div>
