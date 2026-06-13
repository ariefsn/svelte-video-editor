<script lang="ts">
	import { useMessages } from '../../../i18n/messages.js';
	import { Button, Dialog, InputText, Label } from '../atoms/index.js';

	const t = useMessages();

	type Props = {
		open: boolean;
		name: string;
		onRename: (name: string) => void;
	};

	let { open = $bindable(false), name, onRename }: Props = $props();

	let value = $state('');

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = value.trim();
		if (!trimmed) return;
		onRename(trimmed);
		open = false;
	}
</script>

<Dialog bind:open onOpened={() => (value = name)}>
	{#snippet title()}{t.rename_project}{/snippet}
	<form id="rename-timeline-project" onsubmit={submit}>
		<Label for="timeline-project-name" class="mb-2">{t.project_name}</Label>
		<InputText id="timeline-project-name" bind:value placeholder={t.project_name} />
	</form>
	{#snippet footer()}
		<Button variant="outline" onclick={() => (open = false)}>{t.cancel}</Button>
		<Button type="submit" form="rename-timeline-project" disabled={!value.trim()}>
			{t.save}
		</Button>
	{/snippet}
</Dialog>
