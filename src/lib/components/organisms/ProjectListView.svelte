<script lang="ts">
	import { Clapperboard, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { Button, EmptyPlaceholder } from '../atoms/index.js';
	import ConfirmDialog from '../molecules/ConfirmDialog.svelte';
	import type { TimelineProject } from '../../types/timeline.js';
	import { formatLocalDateTime } from '../../utils.js';
	import {
		resolveMessages,
		setMessagesProvider,
		type MessagesOverride
	} from '../../i18n/messages.js';
	import {
		createConfirmController,
		setConfirmController,
		type ConfirmFn
	} from '../../core/confirm.svelte.js';
	import EditorIconButton from './EditorIconButton.svelte';
	import RenameProjectDialog from '../molecules/RenameProjectDialog.svelte';

	type Props = {
		projects: TimelineProject[];
		onOpen: (projectId: string) => void;
		onCreate: () => void;
		onRename: (projectId: string, name: string) => void;
		onDelete: (projectId: string) => void;
		/** Override any UI label; unspecified keys fall back to English. */
		messages?: MessagesOverride;
		/** Host-supplied confirmation; falls back to the built-in dialog. */
		confirm?: ConfirmFn;
	};

	let { projects, onOpen, onCreate, onRename, onDelete, messages, confirm }: Props = $props();

	const t = $derived(resolveMessages(messages));
	// Provide a reactive holder to descendant components (RenameProjectDialog).
	setMessagesProvider({
		get current() {
			return t;
		}
	});

	const confirmCtl = createConfirmController(() => confirm);
	setConfirmController(confirmCtl);
	const builtinConfirm = confirmCtl.builtin;

	let renameTarget = $state<TimelineProject | null>(null);
	let renameOpen = $state(false);

	function openRename(project: TimelineProject) {
		renameTarget = project;
		renameOpen = true;
	}

	async function requestDelete(project: TimelineProject) {
		const ok = await confirmCtl.requestConfirm({
			title: t.delete_project,
			message: t.delete_project_confirm({ name: project.name })
		});
		if (ok) onDelete(project.id);
	}
</script>

<div class="flex flex-col gap-4 text-foreground">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">{t.projects_title}</h2>
		<Button onclick={onCreate}>
			<Plus class="size-4" />
			{t.new_project}
		</Button>
	</div>

	{#if projects.length === 0}
		<EmptyPlaceholder message={t.projects_empty}>
			{#snippet icon()}
				<Clapperboard class="size-6 text-muted-foreground" />
			{/snippet}
		</EmptyPlaceholder>
	{:else}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each projects as project (project.id)}
				<div class="group relative rounded-lg border p-4 transition-colors hover:border-primary/50">
					<button
						type="button"
						class="w-full cursor-pointer text-left"
						onclick={() => onOpen(project.id)}
					>
						<h3 class="truncate pr-14 text-sm font-medium">{project.name}</h3>
						<p class="mt-1 text-xs text-muted-foreground">
							{t.last_edited}: {formatLocalDateTime(project.updatedAt)}
						</p>
						<p class="mt-2 text-xs text-muted-foreground">
							{project.tracks.length}
							{t.tracks_label} · {project.clips.length}
							{t.clips_label} · {project.aspectRatio}
						</p>
					</button>
					<div
						class="absolute top-3 right-3 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
					>
						<EditorIconButton label={t.rename_project} onclick={() => openRename(project)}>
							<Pencil class="size-3.5" />
						</EditorIconButton>
						<EditorIconButton label={t.delete_project} onclick={() => requestDelete(project)}>
							<Trash2 class="size-3.5" />
						</EditorIconButton>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if renameTarget}
	<RenameProjectDialog
		bind:open={renameOpen}
		name={renameTarget.name}
		onRename={(name) => {
			if (renameTarget) onRename(renameTarget.id, name);
		}}
	/>
{/if}

<!-- Built-in confirmation dialog (used only when no host `confirm` is supplied). -->
<ConfirmDialog
	open={builtinConfirm.open}
	onOpenChange={(v) => {
		if (!v) confirmCtl.resolveBuiltin(false);
	}}
	onConfirm={() => confirmCtl.resolveBuiltin(true)}
	confirmLabel={t.delete_project}
	cancelLabel={t.cancel}
>
	{#snippet title()}{builtinConfirm.title}{/snippet}
	{#snippet description()}{builtinConfirm.message}{/snippet}
</ConfirmDialog>
