<script lang="ts">
	import { browser } from '$app/environment';
	import {
		TimelineEditor,
		createEmptyProject,
		migrateProject,
		type NotifyKind,
		type TimelineProject
	} from '$lib/index.js';
	import { loadProject, saveProject, resolveAsset, generateThumbnail } from '../demo-host.js';
	import { theme } from '../theme.svelte.js';
	import DemoToasts, { pushToast } from '../DemoToasts.svelte';

	// Host owns the project + persistence (localStorage). The library stores nothing.
	let project = $state<TimelineProject | null>(null);

	$effect(() => {
		if (!browser || project) return;
		const saved = loadProject();
		project = saved ? migrateProject(saved) : createEmptyProject('My first video');
	});

	function handleChange(p: TimelineProject) {
		project = p;
		saveProject(p);
	}

	function handleExport(p: TimelineProject) {
		console.log('[demo] export', p);
		pushToast('Exported to console — open devtools to see the project payload.', 'success');
	}

	function notify(message: string, kind: NotifyKind) {
		pushToast(message, kind);
	}
</script>

<svelte:head><title>svelte-video-editor — simple demo</title></svelte:head>

<DemoToasts />

<div class="flex h-screen flex-col gap-2 p-3">
	<header class="flex items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<a href="/" class="text-muted-foreground text-xs underline">← docs</a>
			<h1 class="text-sm font-semibold">svelte-video-editor — simple demo</h1>
		</div>
		<div class="flex items-center gap-3 text-xs">
			<button type="button" class="rounded border px-2 py-1" onclick={() => theme.toggle()}>
				{theme.dark ? '🌙 Dark' : '☀️ Light'}
			</button>
			<a href="/advanced" class="text-muted-foreground underline">advanced demo →</a>
		</div>
	</header>

	<div class="min-h-0 flex-1">
		{#if browser && project}
			{#key project.id}
				<!-- Simple demo: props/callbacks only, no snippets. onBack omitted -> no back button. -->
				<TimelineEditor
					{project}
					onChange={handleChange}
					{resolveAsset}
					{generateThumbnail}
					onExport={handleExport}
					can={() => true}
					onNotify={notify}
				/>
			{/key}
		{/if}
	</div>
</div>
