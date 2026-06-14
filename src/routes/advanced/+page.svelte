<script lang="ts">
	import { browser } from '$app/environment';
	import {
		TimelineEditor,
		InspectorPanel,
		createEmptyProject,
		migrateProject,
		uid,
		type BinItem,
		type MessagesOverride,
		type NotifyKind,
		type SectionCtx,
		type TimelineProject
	} from '$lib/index.js';
	import {
		loadProject,
		saveProject,
		loadTimelineHeight,
		saveTimelineHeight,
		loadLang,
		saveLang,
		resolveAsset,
		generateThumbnail
	} from '../demo-host.js';
	import { messagesId } from '../messages-id.js';
	import { theme } from '../theme.svelte.js';
	import DemoToasts, { pushToast } from '../DemoToasts.svelte';

	let project = $state<TimelineProject | null>(null);
	let timelineHeight = $state<number | undefined>(undefined);
	let lang = $state<'en' | 'id'>('en');

	$effect(() => {
		if (!browser || project) return;
		const saved = loadProject(true);
		project = saved ? migrateProject(saved) : createEmptyProject('Advanced demo');
		timelineHeight = loadTimelineHeight();
		lang = loadLang();
	});

	// Host owns localization: swap the whole messages map to switch language.
	const messages = $derived<MessagesOverride | undefined>(lang === 'id' ? messagesId : undefined);

	function setLang(next: 'en' | 'id') {
		lang = next;
		saveLang(next);
	}

	function handleChange(p: TimelineProject) {
		project = p;
		saveProject(p, true);
	}

	function handleHeight(h: number) {
		timelineHeight = h;
		saveTimelineHeight(h);
	}

	// Gate export to show the locked state.
	let proTier = $state(true);

	function handleExport(p: TimelineProject) {
		console.log('[advanced demo] export', p);
		pushToast('Exported to console.', 'success');
	}

	function notify(message: string, kind: NotifyKind) {
		pushToast(message, kind);
	}

	// Custom bin-import UI: paste a media URL.
	let pasteUrl = $state('');
	function addByUrl(addItems: (items: BinItem[]) => void) {
		const url = pasteUrl.trim();
		if (!url) return;
		const ext = url.split('.').pop()?.toLowerCase() ?? '';
		const mediaType: BinItem['mediaType'] = /mp4|webm|mov|m4v/.test(ext)
			? 'video'
			: /mp3|wav|ogg|m4a/.test(ext)
				? 'audio'
				: 'image';
		addItems([
			{ id: uid(), url, name: url.split('/').pop() ?? 'media', mediaType, duration: null }
		]);
		pasteUrl = '';
	}
</script>

<svelte:head><title>svelte-video-editor — advanced demo</title></svelte:head>

<DemoToasts />

<div class="flex h-screen flex-col gap-2 p-3">
	<header class="flex items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<a href="/" class="text-muted-foreground text-xs underline">← docs</a>
			<h1 class="text-sm font-semibold">svelte-video-editor — advanced demo</h1>
		</div>
		<div class="flex items-center gap-3 text-xs">
			<label class="flex items-center gap-1">
				<input type="checkbox" bind:checked={proTier} /> Pro tier (export)
			</label>
			<div class="flex overflow-hidden rounded border">
				<button
					class="px-2 py-0.5 {lang === 'en' ? 'bg-primary text-primary-foreground' : ''}"
					onclick={() => setLang('en')}>EN</button
				>
				<button
					class="px-2 py-0.5 {lang === 'id' ? 'bg-primary text-primary-foreground' : ''}"
					onclick={() => setLang('id')}>ID</button
				>
			</div>
			<button type="button" class="rounded border px-2 py-1" onclick={() => theme.toggle()}>
				{theme.dark ? '🌙 Dark' : '☀️ Light'}
			</button>
			<a href="/simple" class="text-muted-foreground underline">simple demo →</a>
		</div>
	</header>

	<div class="min-h-0 flex-1">
		{#if browser && project}
			{#key project.id}
				<TimelineEditor
					{project}
					onChange={handleChange}
					{resolveAsset}
					{generateThumbnail}
					onExport={handleExport}
					can={(action) => (action === 'export' ? proTier : true)}
					onNotify={notify}
					{messages}
					{timelineHeight}
					onTimelineHeightChange={handleHeight}
					onBack={() => pushToast('onBack fired (host decides what happens).', 'info')}
				>
					{#snippet binImport({ addItems })}
						<form
							class="flex gap-1"
							onsubmit={(e) => {
								e.preventDefault();
								addByUrl(addItems);
							}}
						>
							<input
								bind:value={pasteUrl}
								placeholder="Paste media URL…"
								class="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-xs"
							/>
							<button class="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
								>Add</button
							>
						</form>
					{/snippet}

					{#snippet inspector(ctx: SectionCtx)}
						<!-- Wrap the default inspector + add a custom widget. -->
						<aside class="flex w-64 shrink-0 flex-col border-l lg:w-72">
							{#if ctx.editor.activeClip}
								<InspectorPanel onRequestDelete={ctx.onRequestDelete} />
							{/if}
							<div class="border-t p-3 text-xs text-muted-foreground">
								Custom widget — active clip:
								<code>{ctx.editor.activeClip?.name ?? '—'}</code>
							</div>
						</aside>
					{/snippet}

					{#snippet shortcutsFooter()}
						<!-- Fully replaced section. -->
						<div class="border-t px-3 py-1 text-[10px] text-muted-foreground">
							Custom footer — this entire section was replaced via the <code>shortcutsFooter</code> snippet.
						</div>
					{/snippet}
				</TimelineEditor>
			{/key}
		{/if}
	</div>
</div>
