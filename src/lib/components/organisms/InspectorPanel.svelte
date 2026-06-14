<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { Label, Select, Slider, Switch } from '../atoms/index.js';
	import { ButtonGroup, InputText, InputTextArea } from '../molecules/index.js';
	import { Lock, LockOpen, SlidersHorizontal, Trash2 } from '@lucide/svelte';
	import {
		ANIM_PRESETS,
		EASINGS,
		defaultTransition,
		frameToSec,
		isMediaClip,
		isTextClip,
		type AnimPreset,
		type ClipTransition,
		type Easing,
		type TextClipStyle
	} from '../../types/timeline.js';
	import { formatDuration, formatTimecode } from '../../core/geometry.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
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

	// ---- enter/exit transitions ------------------------------------------
	const presetLabels: Record<AnimPreset, string> = {
		fade: t.anim_fade,
		'slide-left': t.anim_slide_left,
		'slide-right': t.anim_slide_right,
		'slide-up': t.anim_slide_up,
		'slide-down': t.anim_slide_down,
		scale: t.anim_scale,
		zoom: t.anim_zoom,
		bounce: t.anim_bounce,
		pop: t.anim_pop,
		spin: t.anim_spin,
		blur: t.anim_blur,
		wipe: t.anim_wipe,
		flip: t.anim_flip
	};
	const easingLabels: Record<Easing, string> = {
		linear: t.easing_linear,
		'ease-in': t.easing_ease_in,
		'ease-out': t.easing_ease_out,
		'ease-in-out': t.easing_ease_in_out
	};
	const presetItems = [
		{ label: t.anim_none, value: '' },
		...ANIM_PRESETS.map((p) => ({ label: presetLabels[p], value: p }))
	];
	const easingItems = EASINGS.map((e) => ({ label: easingLabels[e], value: e }));

	// Replace a whole side (preset change) or patch the active side (duration/easing).
	function setPreset(side: 'in' | 'out', preset: AnimPreset | '') {
		if (!clip) return;
		const next: ClipTransition | null = preset
			? { ...(clip.animation?.[side] ?? defaultTransition()), preset }
			: null;
		editor.setClipAnimation(clip.id, side, next);
	}
	function patchTransition(side: 'in' | 'out', patch: Partial<ClipTransition>) {
		if (!clip) return;
		const cur = clip.animation?.[side];
		if (!cur) return;
		editor.beginGesture();
		editor.setClipAnimation(clip.id, side, { ...cur, ...patch });
	}
</script>

{#snippet transitionControls(side: 'in' | 'out', label: string)}
	{#if clip}
		{@const tr = clip.animation?.[side]}
		<div class="flex flex-col gap-1.5">
			<Label>{label}</Label>
			<Select
				items={presetItems}
				value={tr?.preset ?? ''}
				disabled={clip.locked}
				onValueChange={(v) => setPreset(side, v as AnimPreset | '')}
			/>
		</div>
		{#if tr}
			<div class="flex flex-col gap-1.5">
				<Label>{t.anim_duration} ({formatDuration(frameToSec(tr.durationF, fps))})</Label>
				<Slider
					value={tr.durationF}
					min={1}
					max={clip.durationF}
					step={1}
					disabled={clip.locked}
					ariaLabel={t.anim_duration}
					onchange={(v) => patchTransition(side, { durationF: v })}
					oncommit={commit}
				/>
			</div>
			<div class="flex flex-col gap-1.5">
				<Label>{t.anim_easing}</Label>
				<Select
					items={easingItems}
					value={tr.easing}
					disabled={clip.locked}
					onValueChange={(v) => patchTransition(side, { easing: v as Easing })}
				/>
			</div>
		{/if}
	{/if}
{/snippet}

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
			<!-- Text clips edit their content in the Text field below, so the name
			     header would just duplicate it — fill that slot with the timecode
			     instead; media clips keep the name here. -->
			{#if isTextClip(clip)}
				<p class="truncate text-xs text-muted-foreground">
					{formatTimecode(clip.startF, fps)} · {formatDuration(frameToSec(clip.durationF, fps))}
				</p>
			{:else}
				<h3 class="truncate text-sm font-medium text-foreground">{clip.name}</h3>
			{/if}
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
		{#if !isTextClip(clip)}
			<p class="mt-1 text-xs text-muted-foreground">
				{formatTimecode(clip.startF, fps)} · {formatDuration(frameToSec(clip.durationF, fps))}
			</p>
		{/if}

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

		<!-- Enter/exit transitions — for any clip with a visible output. -->
		{#if isTextClip(clip) || (isMediaClip(clip) && clip.kind !== 'audio')}
			<div class="mt-4 flex flex-col gap-4 border-t pt-4">
				<Label class="text-muted-foreground">{t.animation}</Label>
				{@render transitionControls('in', t.anim_on_enter)}
				{@render transitionControls('out', t.anim_on_exit)}
			</div>
		{/if}
	{/if}
</div>
