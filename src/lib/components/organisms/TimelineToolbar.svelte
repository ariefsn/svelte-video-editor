<script lang="ts">
	import { useMessages } from '../../i18n/messages.js';
	import { Button, Select, Tooltip } from '../atoms/index.js';
	import { ButtonGroup } from '../molecules/index.js';
	import {
		ArrowLeft,
		Download,
		FoldHorizontal,
		Group,
		Lock,
		Magnet,
		Pencil,
		Plus,
		Redo2,
		Scissors,
		Trash2,
		Type,
		Undo2,
		Ungroup
	} from '@lucide/svelte';
	import { FPS_OPTIONS, type TimelineAspectRatio, type TimelineFps } from '../../types/timeline.js';
	import { useEditorHost } from '../../core/host.js';
	import { useTimelineEditor } from '../../core/state.svelte.js';
	import EditorIconButton from './EditorIconButton.svelte';
	import RenameProjectDialog from '../molecules/RenameProjectDialog.svelte';

	const t = useMessages();

	type Props = {
		/** Optional — the back button only renders when provided. */
		onBack?: () => void;
		onRequestDelete: () => void;
	};

	let { onBack, onRequestDelete }: Props = $props();

	const editor = useTimelineEditor();
	const host = useEditorHost();
	const selectedClips = $derived(editor.selectedClips);
	// Group is a no-op when the selection already IS exactly one group.
	const canGroup = $derived.by(() => {
		if (selectedClips.length < 2) return false;
		const first = selectedClips[0].groupId;
		return first === null || selectedClips.some((c) => c.groupId !== first);
	});
	const canUngroup = $derived(selectedClips.some((c) => c.groupId !== null));
	const canExport = $derived(host.can('export'));

	let renameOpen = $state(false);

	// Aspect ratio and fps are project-level framing decisions — locked once
	// clips are placed.
	const projectLocked = $derived(editor.project.clips.length > 0);
	const aspectOptions = $derived(
		['9:16', '1:1', '16:9'].map((value) => ({
			value,
			label: value,
			disabled: projectLocked && value !== editor.project.aspectRatio
		}))
	);
	const fpsItems = FPS_OPTIONS.map((fps) => ({ label: `${fps} fps`, value: String(fps) }));

	function addTrack() {
		editor.addTrack(`${t.add_track} ${editor.project.tracks.length + 1}`);
	}

	function addText() {
		// Topmost (last) unlocked track renders text above the media layers.
		let track = [...editor.project.tracks].reverse().find((t) => !t.locked);
		if (!track) {
			addTrack();
			track = editor.project.tracks.at(-1);
		}
		if (track) editor.addTextClip(track.id, editor.playheadF, t.default_text);
	}

	function exportProject() {
		if (!canExport) return;
		host.onExport($state.snapshot(editor.project), editor.project.range ?? undefined);
	}
</script>

<div class="flex items-center gap-1 overflow-x-auto border-b px-2 py-1.5">
	{#if onBack}
		<EditorIconButton label={t.back_to_projects} onclick={onBack}>
			<ArrowLeft class="size-4" />
		</EditorIconButton>
	{/if}
	<Tooltip text={t.rename_project}>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="sm"
				class="max-w-44 gap-1.5 truncate text-sm font-medium"
				onclick={() => (renameOpen = true)}
			>
				<span class="truncate">{editor.project.name}</span>
				<Pencil class="size-3 shrink-0 opacity-60" />
			</Button>
		{/snippet}
	</Tooltip>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<EditorIconButton label={t.undo} disabled={!editor.canUndo} onclick={() => editor.undo()}>
		<Undo2 class="size-4" />
	</EditorIconButton>
	<EditorIconButton label={t.redo} disabled={!editor.canRedo} onclick={() => editor.redo()}>
		<Redo2 class="size-4" />
	</EditorIconButton>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<EditorIconButton
		label={t.split}
		disabled={editor.durationF <= 0}
		onclick={() => editor.splitAtPlayhead()}
	>
		<Scissors class="size-4" />
	</EditorIconButton>
	<EditorIconButton label={t.group} disabled={!canGroup} onclick={() => editor.groupSelection()}>
		<Group class="size-4" />
	</EditorIconButton>
	<EditorIconButton
		label={t.ungroup}
		disabled={!canUngroup}
		onclick={() => editor.ungroupSelection()}
	>
		<Ungroup class="size-4" />
	</EditorIconButton>
	<EditorIconButton
		label={t.delete_clips}
		disabled={selectedClips.length === 0}
		onclick={onRequestDelete}
	>
		<Trash2 class="size-4" />
	</EditorIconButton>
	<EditorIconButton
		label={t.ripple_delete}
		disabled={selectedClips.length === 0}
		onclick={() => editor.rippleDeleteSelected()}
	>
		<FoldHorizontal class="size-4 text-orange-400" />
	</EditorIconButton>
	<EditorIconButton
		label={t.snap}
		active={editor.snapping}
		onclick={() => (editor.snapping = !editor.snapping)}
	>
		<Magnet class="size-4" />
	</EditorIconButton>

	<div class="mx-1 h-5 w-px bg-border"></div>

	<Button variant="ghost" size="sm" class="gap-1" onclick={addText}>
		<Type class="size-4" />
		{t.add_text}
	</Button>

	<Button variant="ghost" size="sm" class="gap-1" onclick={addTrack}>
		<Plus class="size-4" />
		{t.add_track}
	</Button>

	<div class="ml-auto flex items-center gap-2">
		{#if projectLocked}
			<Tooltip text={t.project_settings_locked_hint}>
				{#snippet child({ props })}
					<div {...props} class="flex items-center gap-2">
						<Select items={fpsItems} value={String(editor.project.fps)} disabled class="h-8 w-24" />
						<ButtonGroup
							value={editor.project.aspectRatio}
							options={aspectOptions}
							size="sm"
							onValueChange={(v) => editor.setAspectRatio(v as TimelineAspectRatio)}
						/>
					</div>
				{/snippet}
			</Tooltip>
		{:else}
			<Tooltip text={t.fps_label}>
				{#snippet child({ props })}
					<div {...props}>
						<Select
							items={fpsItems}
							value={String(editor.project.fps)}
							class="h-8 w-24"
							onValueChange={(v) => editor.setFps(Number(v) as TimelineFps)}
						/>
					</div>
				{/snippet}
			</Tooltip>
			<Tooltip text={t.aspect_ratio}>
				{#snippet child({ props })}
					<div {...props}>
						<ButtonGroup
							value={editor.project.aspectRatio}
							options={aspectOptions}
							size="sm"
							onValueChange={(v) => editor.setAspectRatio(v as TimelineAspectRatio)}
						/>
					</div>
				{/snippet}
			</Tooltip>
		{/if}

		<!-- Gated actions render locked, never hidden. -->
		<Tooltip text={canExport ? t.export : t.export_locked}>
			{#snippet child({ props })}
				<Button
					{...props}
					variant={canExport ? 'default' : 'outline'}
					size="sm"
					class="gap-1"
					onclick={exportProject}
				>
					{#if canExport}
						<Download class="size-4" />
					{:else}
						<Lock class="size-4" />
					{/if}
					{t.export}
				</Button>
			{/snippet}
		</Tooltip>
	</div>
</div>

<RenameProjectDialog
	bind:open={renameOpen}
	name={editor.project.name}
	onRename={(name) => editor.renameProject(name)}
/>
