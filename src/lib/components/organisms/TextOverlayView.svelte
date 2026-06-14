<script lang="ts">
	import { cn } from '../../utils.js';
	import type { TextClip } from '../../types/timeline.js';
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

	function hexToRgba(hex: string, opacity: number): string {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return `rgba(${r}, ${g}, ${b}, ${opacity})`;
	}

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
		'absolute max-w-full touch-none whitespace-pre-wrap select-none',
		clip.locked ? 'cursor-not-allowed' : 'cursor-move',
		selected && 'ring-1 ring-primary/80'
	)}
	style="
		left: {style.xPct}%;
		top: {style.yPct}%;
		transform: translate(-50%, -50%);
		font-family: {style.fontFamily};
		font-size: {(stageHeight * style.fontSizePct) / 100}px;
		font-weight: {style.fontWeight};
		color: {style.color};
		text-align: {style.align};
		padding: {(stageHeight * style.paddingPct) / 100}px;
		border-radius: {(stageHeight * style.borderRadiusPct) / 100}px;
		background-color: {style.backgroundColor
		? hexToRgba(style.backgroundColor, style.backgroundOpacity)
		: 'transparent'};
		{style.shadow ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.6);' : ''}
	"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
>
	{clip.text}
</div>
