<script lang="ts">
	import { theme } from './theme.svelte.js';

	const pkg = '@ariefsn/svelte-timeline-studio';
	const tagline =
		'A host-agnostic Svelte 5 video timeline editor — clips, tracks, trimming, ripple/roll/slip edits, grouping, linked audio, markers, undo/redo and a real-time preview. Zero design-system dependency.';
	const description =
		'A host-agnostic Svelte 5 video timeline editor with clips, tracks, trimming, ripple/roll/slip edits, grouping, linked audio, markers, undo/redo and a real-time DOM preview. No framework lock-in, Tailwind v4 theming, zero design-system dependency.';

	const githubUrl = 'https://github.com/ariefsn/svelte-timeline-studio';
	const npmUrl = `https://www.npmjs.com/package/${pkg}`;

	const features = [
		['Clips & tracks', 'Multi-track timeline with drag, trim, split and snap.'],
		['Ripple / roll / slip', 'Premiere/CapCut-style precision edits.'],
		['Grouping & linked audio', 'Group clips and keep A/V in sync.'],
		['Markers & in/out range', 'Annotate and define export ranges.'],
		['Undo / redo', 'Full edit history out of the box.'],
		['Real-time preview', 'Live DOM preview of the composition.'],
		['Host-agnostic', 'You own assets, export, persistence and i18n.'],
		['Tailwind v4 theming', 'Restyle via the shipped --ts-* CSS variables.']
	];
</script>

<svelte:head>
	<title>svelte-timeline-studio — host-agnostic Svelte 5 video timeline editor</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={githubUrl} />

	<meta property="og:type" content="website" />
	<meta property="og:title" content="svelte-timeline-studio" />
	<meta property="og:description" content={description} />
	<meta property="og:image" content="/logo.svg" />
	<meta property="og:url" content={githubUrl} />

	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content="svelte-timeline-studio" />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content="/logo.svg" />
</svelte:head>

<div
	class="min-h-screen bg-background text-foreground"
>
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
			<h1 class="text-2xl font-bold tracking-tight sm:text-3xl">svelte-timeline-studio</h1>
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
		<pre
			class="overflow-x-auto rounded-lg border bg-muted px-4 py-3 text-sm"><code>npm i {pkg}</code></pre>
		<p class="text-sm text-muted-foreground">
			Requires <code>svelte@^5</code> and Tailwind v4. See the
			<a href={githubUrl} class="underline">README</a> for the full host contract, theming and
			localization guide.
		</p>
	</section>

	<footer class="mt-auto border-t pt-6 text-xs text-muted-foreground">
		MIT © Arief Setiyo Nugroho ·
		<a href={githubUrl} class="underline">GitHub</a> ·
		<a href={npmUrl} class="underline">npm</a>
	</footer>
</div>
</div>
