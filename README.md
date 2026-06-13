<p align="center">
  <img src="./static/logo.svg" alt="svelte-timeline-studio" width="128" height="128" />
</p>

<h1 align="center">@ariefsn/svelte-timeline-studio</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@ariefsn/svelte-timeline-studio"><img alt="npm version" src="https://img.shields.io/npm/v/@ariefsn/svelte-timeline-studio?color=cb3837&logo=npm"></a>
  <a href="https://www.npmjs.com/package/@ariefsn/svelte-timeline-studio"><img alt="npm downloads" src="https://img.shields.io/npm/dm/@ariefsn/svelte-timeline-studio?color=cb3837&logo=npm"></a>
  <a href="https://bundlephobia.com/package/@ariefsn/svelte-timeline-studio"><img alt="minzipped size" src="https://img.shields.io/bundlephobia/minzip/@ariefsn/svelte-timeline-studio"></a>
  <img alt="svelte 5" src="https://img.shields.io/badge/svelte-5-ff3e00?logo=svelte&logoColor=white">
  <img alt="types included" src="https://img.shields.io/npm/types/@ariefsn/svelte-timeline-studio">
  <a href="./LICENSE"><img alt="license MIT" src="https://img.shields.io/npm/l/@ariefsn/svelte-timeline-studio?color=blue"></a>
</p>

A host-agnostic, **Svelte 5** video timeline editor — a CapCut/Premiere-style timeline with
clips, tracks, trimming, ripple/roll/slip edits, grouping, linked audio, markers, in/out range,
undo/redo, and a real-time DOM preview. No framework lock-in: all external concerns (asset URLs,
thumbnails, export, permissions, persistence, notifications, confirmation, i18n) are injected by
the host.

- **The library owns no storage** — you persist the project (and pane height) however you like.
- **Tailwind v4 theming** — ships a simple light/dark theme you can override via CSS variables.

> ⚠️ **Browser-only.** This component renders in the browser (DOM, `<video>`/`<audio>`, canvas,
> `requestAnimationFrame`). It is safe to *import* on the server, but render it client-side only
> (see [SvelteKit (SSR)](#sveltekit-ssr)).

- **Repo:** [https://github.com/ariefsn/svelte-timeline-studio](https://github.com/ariefsn/svelte-timeline-studio)

## Contents

- [Install](#install)
- [Theme](#theme)
- [Simple mode](#simple-mode) — props & callbacks only
- [Advanced mode](#advanced-mode) — snippets, i18n, host-owned state
- [SvelteKit (SSR)](#sveltekit-ssr)
- [Host contract](#host-contract)
- [Section overrides](#section-overrides-snippets)
- [Localization](#localization)
- [License](#license)

## Install

```bash
bun add @ariefsn/svelte-timeline-studio
# or: npm i @ariefsn/svelte-timeline-studio
# or: pnpm add @ariefsn/svelte-timeline-studio
```

Requires `svelte@^5` and Tailwind v4 in your app.

## Theme

Import the shipped theme once (it defines the `--ts-*` CSS variables + light/dark palette):

```ts
// app.css or your root layout
import '@ariefsn/svelte-timeline-studio/app.css';
```

Dark mode follows a `.dark` class on an ancestor (e.g. `<html class="dark">`). Override any token
to restyle:

```css
:root {
  --ts-primary: hsl(220 90% 56%); /* your brand */
}
```

---

## Simple mode

The minimal "drop it in and go" setup — **props and callbacks only, no snippets**. You supply a
project, persist it in `onChange`, and resolve media. That's it.

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import {
    TimelineEditor,
    createEmptyProject,
    migrateProject,
    type NotifyKind,
    type ResolvedAsset,
    type TimelineProject
  } from '@ariefsn/svelte-timeline-studio';
  import '@ariefsn/svelte-timeline-studio/app.css';

  // The host owns the project and its persistence. The library stores nothing.
  let project = $state<TimelineProject | null>(null);

  $effect(() => {
    if (!browser || project) return;
    const saved = localStorage.getItem('my-project');
    project = saved ? migrateProject(JSON.parse(saved)) : createEmptyProject('My first video');
  });

  function handleChange(p: TimelineProject) {
    project = p;
    localStorage.setItem('my-project', JSON.stringify(p)); // host-owned persistence
  }

  // Resolve a clip's media URL (+ metadata). Here URLs resolve to themselves.
  async function resolveAsset(assetId: string): Promise<ResolvedAsset> {
    return { url: assetId, hasAudio: true };
  }

  // Return a thumbnail image URL for `frame` (at a fixed 30fps reference).
  async function generateThumbnail(assetId: string, frame: number): Promise<string> {
    return assetId; // e.g. an <img> poster; real apps seek a <video> + canvas
  }

  function handleExport(p: TimelineProject) {
    console.log('export', p); // you own rendering
  }

  function handleNotify(message: string, kind: NotifyKind) {
    console.log(kind, message); // wire to your toast system if you like
  }
</script>

{#if browser && project}
  {#key project.id}
    <TimelineEditor
      {project}
      onChange={handleChange}
      {resolveAsset}
      {generateThumbnail}
      onExport={handleExport}
      can={() => true}
      onNotify={handleNotify}
    />
  {/key}
{/if}
```

`onBack` is omitted here, so no back button renders.

---

## Advanced mode

Use snippets to customize sections, supply your own confirm dialog, switch languages at runtime,
gate features, and own the pane height — everything injected by the host.

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import {
    TimelineEditor,
    InspectorPanel,
    createEmptyProject,
    uid,
    type BinItem,
    type ConfirmOptions,
    type EditorAction,
    type MessagesOverride,
    type ResolvedAsset,
    type SectionCtx,
    type TimelineProject
  } from '@ariefsn/svelte-timeline-studio';
  import '@ariefsn/svelte-timeline-studio/app.css';

  let project = $state<TimelineProject | null>(null);
  let timelineHeight = $state<number | undefined>(undefined);
  let lang = $state<'en' | 'id'>('en');
  let proTier = $state(true);

  $effect(() => {
    if (!browser || project) return;
    project = createEmptyProject('Advanced demo');
    timelineHeight = Number(localStorage.getItem('paneH')) || undefined;
  });

  async function resolveAsset(assetId: string): Promise<ResolvedAsset> {
    return { url: assetId, hasAudio: true };
  }
  async function generateThumbnail(assetId: string): Promise<string> {
    return assetId;
  }

  function handleChange(p: TimelineProject) {
    project = p;
  }

  function handleExport(p: TimelineProject) {
    console.log('export', p);
  }

  function handleHeight(h: number) {
    timelineHeight = h;
    localStorage.setItem('paneH', String(h)); // host-owned persistence
  }

  function canDo(action: EditorAction): boolean {
    return action === 'export' ? proTier : true;
  }

  // Localization is host-owned: swap the whole messages map to switch language.
  const messagesId: MessagesOverride = { export: 'Ekspor', split: 'Pisah', undo: 'Urungkan' };
  const messages = $derived<MessagesOverride | undefined>(lang === 'id' ? messagesId : undefined);

  // Use your OWN confirm dialog instead of the built-in one (optional).
  async function confirm(opts: ConfirmOptions): Promise<boolean> {
    return window.confirm(`${opts.title}\n\n${opts.message ?? ''}`);
  }

  let pasteUrl = $state('');
  function addByUrl(addItems: (items: BinItem[]) => void) {
    if (!pasteUrl.trim()) return;
    addItems([{ id: uid(), url: pasteUrl, name: 'media', mediaType: 'video', duration: null }]);
    pasteUrl = '';
  }
</script>

{#if browser && project}
  {#key project.id}
    <TimelineEditor
      {project}
      onChange={handleChange}
      {resolveAsset}
      {generateThumbnail}
      onExport={handleExport}
      can={canDo}
      {messages}
      {confirm}
      {timelineHeight}
      onTimelineHeightChange={handleHeight}
      onBack={() => history.back()}
    >
      <!-- Host-owned import UI inside the asset bin -->
      {#snippet binImport({ addItems })}
        <form onsubmit={(e) => { e.preventDefault(); addByUrl(addItems); }}>
          <input bind:value={pasteUrl} placeholder="Paste media URL…" />
          <button>Add</button>
        </form>
      {/snippet}

      <!-- WRAP a default section: render the built-in + add your own UI -->
      {#snippet inspector(ctx: SectionCtx)}
        {#if ctx.editor.activeClip}
          <InspectorPanel onRequestDelete={ctx.onRequestDelete} />
        {/if}
        <div class="p-3 text-xs">Active clip: {ctx.editor.activeClip?.name ?? '—'}</div>
      {/snippet}

      <!-- FULLY REPLACE a section -->
      {#snippet shortcutsFooter()}
        <div class="border-t px-3 py-1 text-xs">My custom footer</div>
      {/snippet}
    </TimelineEditor>
  {/key}
{/if}
```

Switch `lang` between `'en'` and `'id'` at runtime and the whole UI re-labels reactively — no
`locale` prop, the `messages` map is the single source of translation.

> A runnable version of both modes lives in this repo under `src/routes/` (`/` = simple,
> `/advanced` = advanced). Run `bun run dev`.

---

## SvelteKit (SSR)

SvelteKit is SSR by default and the editor needs the DOM — render it under a browser guard:

```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { TimelineEditor } from '@ariefsn/svelte-timeline-studio';
</script>

{#if browser}
  <TimelineEditor … />
{/if}
```

(Or set `export const ssr = false` on the route.)

---

## Host contract

| Prop | Type | Required | Notes |
| --- | --- | --- | --- |
| `project` | `TimelineProject` | ✅ | Auto-migrated from older shapes. Remount via `{#key project.id}` to switch. |
| `onChange` | `(project) => void` | ✅ | Debounced (`changeDebounceMs`, default 800ms; `0` = immediate). **You persist it.** |
| `resolveAsset` | `(assetId) => Promise<ResolvedAsset>` | ✅ | Resolve media URL + metadata. |
| `generateThumbnail` | `(assetId, frame) => Promise<string>` | ✅ | `frame` at a fixed 30fps reference. |
| `onExport` | `(project, range?) => void` | ✅ | You own rendering/export. |
| `can` | `(action) => boolean` | ✅ | Permission gate (`'export'`, `'magnetic-main-track'`). |
| `onBack` | `() => void` | ❌ | Back button renders only when provided. |
| `onNotify` | `(message, kind) => void` | ❌ | Transient feedback sink; no-ops if absent. |
| `messages` | `Partial<Messages>` | ❌ | Override/translate any label (the single i18n source). |
| `confirm` | `(opts) => Promise<boolean>` | ❌ | Use your own confirm dialog instead of the built-in. |
| `timelineHeight` / `onTimelineHeightChange` | `number` / `(h) => void` | ❌ | Host-owned pane height. |
| `magneticMainTrack` | `boolean` | ❌ | CapCut-style packing on the first track. |
| `changeDebounceMs` | `number` | ❌ | Debounce for `onChange`. |

`ProjectListView` is also exported for a "pick/create a project" screen (`projects`, `onOpen`,
`onCreate`, `onRename`, `onDelete`, plus optional `messages` / `confirm`).

## Section overrides (snippets)

Replace any section via a snippet receiving `SectionCtx` (`{ editor, host, onBack?, onRequestDelete }`):
`toolbar`, `assetBin`, `preview`, `transport`, `inspector`, `tracks`, `shortcutsFooter`, plus
`binImport` (host import UI, gets `{ addItems }`). You can **wrap** a default by rendering the
exported section component (e.g. `<TimelineToolbar {...ctx} />`) and adding your own UI around it.

## Localization

There is no `locale` prop — pass a fully-translated `messages` map. **`messages` is fully typed**, so
you get autocomplete for every key and a compile error on typos:

```ts
import type { Messages } from '@ariefsn/svelte-timeline-studio';
import { defaultMessages } from '@ariefsn/svelte-timeline-studio';

// Partial override — every key autocompletes:
const messages: Partial<Messages> = {
  export: 'Render',
  split: 'Cut',
  // most keys are strings; a few interpolate and are functions:
  delete_clips_confirm: ({ count }) => `Delete ${count} clip(s)?`
};
```

```svelte
<!-- `messages` is typed as Partial<Messages> -> IntelliSense lists all keys -->
<TimelineEditor messages={{ export: 'Render', split: 'Cut' }} … />
```

Exports for typing/translating:

- **`Messages`** — the full message map type (all keys; strings + the 4 interpolating functions).
- **`MessagesOverride`** = `Partial<Messages>` — the type of the `messages` prop.
- **`MessageKey`** — a union of every key name.
- **`defaultMessages`** — the English defaults (clone it as a base for a full translation).

Swap the whole `messages` object at runtime to switch languages reactively.

---

## License

MIT © [Arief Setiyo Nugroho](https://github.com/ariefsn) — [me@ariefsn.dev](mailto:me@ariefsn.dev)

See [LICENSE](./LICENSE).
