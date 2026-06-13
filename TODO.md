# TODO

## v2 — fine-grained snippet overrides (must stay backward-compatible)

Expose individual control snippets so hosts can replace a single control without
overriding a whole section. All additive — existing section snippets must keep working.

- [ ] toolbar: `fpsControl`, `aspectRatioControl`, `exportButton`, `toolbarExtra` (append slot)
- [ ] inspector: per-field snippets (text style, volume, fades, position) + `inspectorExtra`
- [ ] each snippet renders the built-in default when not provided (`host ?? default`)
- [ ] reuse the existing `SectionCtx` shape — no signature changes
- [ ] verify v1 consumers (section snippets only) compile and behave unchanged

To make this a clean addition, build `TimelineToolbar` / `InspectorPanel` from small internal
sub-pieces (`FpsControl`, `AspectRatioControl`, `ExportButton`, …) so v2 can expose
`{@render hostX?.(ctx) ?? <DefaultX/>}` without restructuring.

## Done (v1)

- [x] Confirmation override: `confirm?: (opts) => Promise<boolean>` prop on `TimelineEditor` /
      `ProjectListView`. When provided, the host's confirm is used instead of the built-in
      `ConfirmDialog`. (See `core/confirm.svelte.ts`.)

## Possible follow-ups

- [ ] Inline `@lucide/svelte` icons (copy the ~40 used SVG paths into a local `Icon` set) to
      reach a literal zero-runtime-dependency package.
- [ ] Optional `<TimelineEditorClient>` wrapper that bakes in the `{#if browser}` guard.
- [ ] Audio waveform rendering (host `generateWaveform` is already accepted).
