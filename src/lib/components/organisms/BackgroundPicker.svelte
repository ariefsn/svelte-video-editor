<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { Button, Label, Popover, Slider, Tooltip } from '../atoms/index.js';
	import { ButtonGroup } from '../molecules/index.js';
	import {
		BACKGROUND_GRADIENT_PRESETS,
		BACKGROUND_SOLID_PRESETS,
		type ProjectBackground
	} from '../../types/timeline.js';
	import { backgroundCss } from '../../core/background.js';

	const t = useMessages();

	type Props = {
		value: ProjectBackground | null;
		disabled?: boolean;
		/** Which edge of the trigger the popover aligns to. Use `start` inside the
		 * mobile sheet so the panel doesn't run off the left of a narrow screen. */
		align?: 'start' | 'end';
		/** Which side of the trigger the popover opens toward. `top` when the picker
		 * sits at the bottom of the editor (mobile zoom bar). */
		side?: 'top' | 'bottom';
		onValueChange: (value: ProjectBackground | null) => void;
	};

	let { value, disabled = false, align = 'end', side = 'bottom', onValueChange }: Props = $props();

	// Which tab the popover shows. Local UI state, seeded from the current value;
	// switching tabs alone doesn't mutate `value`.
	let tab = $state<'solid' | 'gradient'>(value?.type === 'gradient' ? 'gradient' : 'solid');
	const tabOptions = $derived([
		{ value: 'solid', label: t.backgroundSolid },
		{ value: 'gradient', label: t.backgroundGradient }
	]);

	// Current custom values per tab (fall back to sensible defaults so the custom
	// pickers are usable even when the active value is the other type or null).
	const solidColor = $derived(value?.type === 'solid' ? value.color : '#000000');
	const gradient = $derived(
		value?.type === 'gradient' ? value : { from: '#1e3a8a', to: '#3b82f6', angle: 135 }
	);

	function pickSolid(color: string) {
		onValueChange({ type: 'solid', color });
	}
	function pickGradient(g: { from: string; to: string; angle: number }) {
		onValueChange({ type: 'gradient', ...g });
	}
	function patchGradient(patch: Partial<{ from: string; to: string; angle: number }>) {
		pickGradient({ ...gradient, ...patch });
	}
</script>

<Popover {side} {align} fixed contentClass="w-64">
	{#snippet trigger({ props })}
		<Button
			{...props}
			variant="ghost"
			size="icon"
			class="size-7"
			{disabled}
			title={t.background}
			aria-label={t.background}
		>
			<span class="size-4 rounded-sm border" style="background: {backgroundCss(value)};"></span>
		</Button>
	{/snippet}

	{#snippet content()}
		<div class="flex flex-col gap-3">
			<ButtonGroup
				value={tab}
				options={tabOptions}
				size="sm"
				equalWidth
				class="flex w-full"
				onValueChange={(v) => (tab = v as 'solid' | 'gradient')}
			/>

			{#if tab === 'solid'}
				<div class="grid grid-cols-5 gap-1">
					<!-- None / transparent -->
					<Tooltip text={t.backgroundNone}>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								aria-label={t.backgroundNone}
								class="flex size-9 items-center justify-center rounded-md hover:bg-accent"
								onclick={() => onValueChange(null)}
							>
								<span
									class="size-5 rounded-full border bg-[length:8px_8px] bg-[position:0_0,4px_4px] [background-image:linear-gradient(45deg,#888_25%,transparent_25%,transparent_75%,#888_75%),linear-gradient(45deg,#888_25%,transparent_25%,transparent_75%,#888_75%)]"
									style={value === null ? 'outline: 2px solid var(--color-ring);' : ''}
								></span>
							</button>
						{/snippet}
					</Tooltip>
					{#each BACKGROUND_SOLID_PRESETS as color (color)}
						<Tooltip text={color}>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									aria-label={color}
									class="flex size-9 items-center justify-center rounded-md hover:bg-accent"
									onclick={() => pickSolid(color)}
								>
									<span
										class="size-5 rounded-full border"
										style="background-color: {color};{value?.type === 'solid' &&
										value.color === color
											? ' outline: 2px solid var(--color-ring);'
											: ''}"
									></span>
								</button>
							{/snippet}
						</Tooltip>
					{/each}
				</div>

				<div class="flex flex-col gap-1.5">
					<Label>{t.backgroundCustom}</Label>
					<input
						type="color"
						class="h-8 w-full rounded-md border border-input bg-background p-1"
						value={solidColor}
						{disabled}
						oninput={(e: Event) => pickSolid((e.currentTarget as HTMLInputElement).value)}
					/>
				</div>
			{:else}
				<div class="grid max-h-40 grid-cols-5 gap-1 overflow-y-auto">
					{#each BACKGROUND_GRADIENT_PRESETS as g, i (i)}
						{@const css = `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`}
						{@const active =
							value?.type === 'gradient' &&
							value.from === g.from &&
							value.to === g.to &&
							value.angle === g.angle}
						<Tooltip text={`${g.from} → ${g.to}`}>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									aria-label={`gradient ${i + 1}`}
									class="flex size-9 items-center justify-center rounded-md hover:bg-accent"
									onclick={() => pickGradient(g)}
								>
									<span
										class="size-6 rounded-md border"
										style="background: {css};{active
											? ' outline: 2px solid var(--color-ring);'
											: ''}"
									></span>
								</button>
							{/snippet}
						</Tooltip>
					{/each}
				</div>

				<div class="flex gap-2">
					<div class="flex flex-1 flex-col gap-1.5">
						<Label>{t.backgroundFrom}</Label>
						<input
							type="color"
							class="h-8 w-full rounded-md border border-input bg-background p-1"
							value={gradient.from}
							{disabled}
							oninput={(e: Event) =>
								patchGradient({ from: (e.currentTarget as HTMLInputElement).value })}
						/>
					</div>
					<div class="flex flex-1 flex-col gap-1.5">
						<Label>{t.backgroundTo}</Label>
						<input
							type="color"
							class="h-8 w-full rounded-md border border-input bg-background p-1"
							value={gradient.to}
							{disabled}
							oninput={(e: Event) =>
								patchGradient({ to: (e.currentTarget as HTMLInputElement).value })}
						/>
					</div>
				</div>

				<div class="flex flex-col gap-1.5">
					<Label>{t.backgroundAngle} ({gradient.angle}°)</Label>
					<Slider
						value={gradient.angle}
						min={0}
						max={360}
						step={1}
						{disabled}
						ariaLabel={t.backgroundAngle}
						onchange={(v) => patchGradient({ angle: v })}
					/>
				</div>
			{/if}
		</div>
	{/snippet}
</Popover>
