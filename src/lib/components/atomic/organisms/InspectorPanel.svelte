<script lang="ts">
	import { useMessages } from '../../../i18n/messages.js';
	import {
		ButtonGroup,
		InputText,
		InputTextArea,
		Label,
		Select,
		Slider,
		Switch
	} from '../atoms/index.js';
	import { Lock, LockOpen, SlidersHorizontal, Trash2 } from '@lucide/svelte';
	import { frameToSec, isMediaClip, isTextClip, type TextClipStyle } from '../../../types/timeline.js';
	import { formatDuration, formatTimecode } from '../../../core/geometry.js';
	import { useTimelineEditor } from '../../../core/state.svelte.js';
	import EditorIconButton from './EditorIconButton.svelte';

	const t = useMessages();

	type Props = {
		onRequestDelete: () => void;
	};

	let { onRequestDelete }: Props = $props();

	const editor = useTimelineEditor();
	const fps = $derived(editor.project.fps);
	const clip = $derived(editor.activeClip);

	const weightItems = [
		{ label: t.weight_regular, value: '400' },
		{ label: t.weight_semibold, value: '600' },
		{ label: t.weight_bold, value: '700' }
	];
	const alignOptions = [
		{ value: 'left', label: t.align_left },
		{ value: 'center', label: t.align_center },
		{ value: 'right', label: t.align_right }
	];

	// Continuous controls (sliders, color, typing) batch into one undo entry:
	// the first input opens a gesture (idempotent) and blur/commit closes it.
	function patchStyle(style: Partial<TextClipStyle>) {
		if (!clip) return;
		editor.beginGesture();
		editor.updateTextClip(clip.id, { style });
	}

	function patchText(text: string) {
		if (!clip) return;
		editor.beginGesture();
		editor.updateTextClip(clip.id, { text });
	}

	function commit() {
		editor.endGesture();
	}
</script>

<div class="flex h-full min-h-0 flex-col overflow-y-auto p-3">
	{#if !clip}
		<div
			class="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground"
		>
			<SlidersHorizontal class="size-5" />
			<p class="max-w-44 text-xs">{t.inspector_empty}</p>
		</div>
	{:else}
		<div class="flex items-center justify-between gap-2">
			<h3 class="truncate text-sm font-medium">{clip.name}</h3>
			<div class="flex shrink-0 items-center">
				<EditorIconButton
					label={clip.locked ? t.unlock : t.lock}
					onclick={() => {
						if (clip) editor.toggleClipLock(clip.id);
					}}
				>
					{#if clip.locked}
						<Lock class="size-3.5" />
					{:else}
						<LockOpen class="size-3.5" />
					{/if}
				</EditorIconButton>
				<EditorIconButton label={t.delete_clips} onclick={onRequestDelete}>
					<Trash2 class="size-3.5" />
				</EditorIconButton>
			</div>
		</div>
		<p class="mt-1 text-xs text-muted-foreground">
			{formatTimecode(clip.startF, fps)} · {formatDuration(frameToSec(clip.durationF, fps))}
		</p>

		{#if isTextClip(clip)}
			<div class="mt-4 flex flex-col gap-4">
				<InputTextArea
					label={t.text_content}
					rows={3}
					value={clip.text}
					disabled={clip.locked}
					oninput={(e: Event) => patchText((e.currentTarget as HTMLTextAreaElement).value)}
					onblur={commit}
				/>

				<div class="flex flex-col gap-1.5">
					<Label>{t.font_size}</Label>
					<Slider
						value={clip.style.fontSizePct}
						min={2}
						max={20}
						step={0.5}
						disabled={clip.locked}
						ariaLabel={t.font_size}
						onchange={(v) => patchStyle({ fontSizePct: v })}
						oncommit={commit}
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<Label>{t.font_weight}</Label>
					<Select
						items={weightItems}
						value={String(clip.style.fontWeight)}
						disabled={clip.locked}
						onValueChange={(v) => {
							editor.updateTextClip(clip.id, {
								style: { fontWeight: Number(v) as TextClipStyle['fontWeight'] }
							});
						}}
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<Label>{t.alignment}</Label>
					<ButtonGroup
						value={clip.style.align}
						options={alignOptions}
						size="sm"
						onValueChange={(v) =>
							editor.updateTextClip(clip.id, { style: { align: v as TextClipStyle['align'] } })}
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<Label>{t.color}</Label>
					<InputText
						type="color"
						class="h-8 w-full p-1"
						value={clip.style.color}
						disabled={clip.locked}
						oninput={(e: Event) =>
							patchStyle({ color: (e.currentTarget as HTMLInputElement).value })}
						onchange={commit}
					/>
				</div>

				<div class="flex items-center justify-between">
					<Label>{t.background}</Label>
					<Switch
						checked={clip.style.backgroundColor !== null}
						disabled={clip.locked}
						onCheckedChange={(checked: boolean) =>
							editor.updateTextClip(clip.id, {
								style: { backgroundColor: checked ? '#000000' : null }
							})}
					/>
				</div>
				{#if clip.style.backgroundColor !== null}
					<InputText
						type="color"
						class="h-8 w-full p-1"
						value={clip.style.backgroundColor}
						disabled={clip.locked}
						oninput={(e: Event) =>
							patchStyle({ backgroundColor: (e.currentTarget as HTMLInputElement).value })}
						onchange={commit}
					/>
				{/if}

				{#if clip.style.backgroundColor !== null}
					<div class="flex flex-col gap-1.5">
						<Label>{t.background_opacity}</Label>
						<Slider
							value={clip.style.backgroundOpacity}
							min={0}
							max={1}
							step={0.05}
							disabled={clip.locked}
							ariaLabel={t.background_opacity}
							onchange={(v) => patchStyle({ backgroundOpacity: v })}
							oncommit={commit}
						/>
					</div>
				{/if}

				<div class="flex items-center justify-between">
					<Label>{t.text_shadow}</Label>
					<Switch
						checked={clip.style.shadow}
						disabled={clip.locked}
						onCheckedChange={(checked: boolean) =>
							editor.updateTextClip(clip.id, { style: { shadow: checked } })}
					/>
				</div>

				<p class="text-xs text-muted-foreground">{t.position_hint}</p>
			</div>
		{:else if isMediaClip(clip) && clip.kind !== 'image'}
			<div class="mt-4 flex flex-col gap-1.5">
				<Label>{t.volume}</Label>
				<Slider
					value={clip.volume}
					min={0}
					max={1}
					step={0.05}
					disabled={clip.locked}
					ariaLabel={t.volume}
					onchange={(v) => {
						editor.beginGesture();
						editor.setClipVolume(clip.id, v);
					}}
					oncommit={commit}
				/>
			</div>
		{/if}
	{/if}
</div>
