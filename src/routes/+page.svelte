<script lang="ts">
	import { theme } from './theme.svelte.js';

	const pkg = '@ariefsn/svelte-video-editor';
	const title = 'Svelte Video Editor';
	const tagline =
		'A host-agnostic Svelte 5 video timeline editor — clips, tracks, trimming, ripple/roll/slip edits, built-in transitions, grouping, linked audio, markers, undo/redo and a real-time preview. Responsive & mobile-ready. Zero design-system dependency.';
	const description =
		'A host-agnostic Svelte 5 video timeline editor with clips, tracks, trimming, ripple/roll/slip edits, built-in clip transitions, grouping, linked audio, markers, undo/redo and a real-time DOM preview. Responsive layout with mobile sheets, Tailwind v4 theming, no framework lock-in, zero design-system dependency.';

	const githubUrl = 'https://github.com/ariefsn/svelte-video-editor';
	const npmUrl = `https://www.npmjs.com/package/${pkg}`;

	const siteUrl = 'https://svelte-video-editor.ariefsn.dev';
	const ogImage = `${siteUrl}/og-image.png`;
	const keywords =
		'svelte, svelte5, sveltekit, video editor, video timeline, timeline editor, clips, tracks, trimming, ripple edit, roll edit, slip edit, transitions, markers, undo redo, tailwindcss, typescript, component library';

	const installers = [
		{ id: 'bun', label: 'bun', cmd: `bun add ${pkg}` },
		{ id: 'yarn', label: 'yarn', cmd: `yarn add ${pkg}` },
		{ id: 'npm', label: 'npm', cmd: `npm i ${pkg}` }
	] as const;
	let manager = $state<(typeof installers)[number]['id']>('bun');
	const installCmd = $derived(installers.find((i) => i.id === manager)!.cmd);

	const features = [
		['Clips & tracks', 'Multi-track timeline with drag, trim, split and snap.'],
		['Ripple / roll / slip', 'Premiere/CapCut-style precision edits.'],
		['Built-in transitions', 'Per-clip enter/exit: fade, slide, zoom, bounce, flip + more.'],
		['Grouping & linked audio', 'Group clips and keep A/V in sync.'],
		['Markers & in/out range', 'Annotate and define export ranges.'],
		['Undo / redo', 'Full edit history out of the box.'],
		['Real-time preview', 'Live DOM preview that scrubs transitions with the playhead.'],
		['Responsive & mobile', 'Panels collapse into sheets; touch-friendly on phones.'],
		['Host-agnostic', 'You own assets, export, persistence and i18n.'],
		['Tailwind v4 theming', 'Restyle via the shipped --ts-* CSS variables.']
	];
</script>

<svelte:head>
	<title>{title} — A Host-Agnostic Video Editor with Svelte 5</title>
	<meta name="description" content={description} />
	<meta name="keywords" content={keywords} />
	<link rel="canonical" href={githubUrl} />

	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:url" content={siteUrl} />

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
	<div class="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 px-6 py-12">
		<header class="flex items-center justify-end gap-4">
			<nav class="flex items-center gap-3 text-xs">
				<a href={githubUrl} class="text-muted-foreground underline">GitHub</a>
				<a href={npmUrl} class="text-muted-foreground underline">npm</a>
				<button type="button" class="rounded border px-2 py-1" onclick={() => theme.toggle()}>
					{theme.dark ? '🌙 Dark' : '☀️ Light'}
				</button>
			</nav>
		</header>

		<section class="flex flex-col items-start gap-6">
			<a href="/" class="flex items-center gap-4">
				<img src="/logo.svg" alt="" width="56" height="56" class="rounded-xl" />
				<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Svelte Video Editor</h1>
			</a>
			<p class="text-lg text-muted-foreground">{tagline}</p>

			<div class="flex flex-wrap gap-3">
				<a
					href="/simple"
					class="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
				>
					Simple demo →
				</a>
				<a href="/advanced" class="rounded border px-4 py-2 text-sm font-medium">
					Advanced demo →
				</a>
			</div>
		</section>

		<section class="flex flex-col gap-4">
			<h2 class="text-base font-semibold">Features</h2>
			<ul class="grid gap-4 sm:grid-cols-2">
				{#each features as [title, body] (title)}
					<li class="rounded-lg border p-4">
						<h3 class="text-sm font-medium">{title}</h3>
						<p class="mt-1 text-sm text-muted-foreground">{body}</p>
					</li>
				{/each}
			</ul>
		</section>

		<section class="flex flex-col gap-4">
			<h2 class="text-base font-semibold">Install</h2>
			<div class="flex flex-col gap-0 overflow-hidden rounded-lg border bg-muted">
				<div class="flex border-b bg-background/40 text-sm">
					{#each installers as i (i.id)}
						<button
							type="button"
							class="border-r px-4 py-1.5 font-medium transition-colors last:border-r-0 {manager ===
							i.id
								? 'bg-muted text-foreground'
								: 'text-muted-foreground hover:text-foreground'}"
							aria-pressed={manager === i.id}
							onclick={() => (manager = i.id)}
						>
							{i.label}
						</button>
					{/each}
				</div>
				<pre class="overflow-x-auto px-4 py-3 text-sm"><code>{installCmd}</code></pre>
			</div>
			<p class="text-sm text-muted-foreground">
				Requires <code>svelte@^5</code> and Tailwind v4. See the
				<a href={githubUrl} class="underline">README</a> for the full host contract, theming and localization
				guide.
			</p>
		</section>

		<footer class="mt-auto border-t pt-6 text-xs text-muted-foreground">
			MIT © Arief Setiyo Nugroho ·
			<a href={githubUrl} class="underline">GitHub</a> ·
			<a href={npmUrl} class="underline">npm</a>
		</footer>
	</div>
</div>
