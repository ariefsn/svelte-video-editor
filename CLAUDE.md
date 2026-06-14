# Frontend Engineering Contract — Atomic Design (STRICT)

This is a standalone Svelte 5 component library (`svelte-video-editor`). The only
architectural rules that apply here are the **Atomic Design** layering rules below.

Stack:

```
Svelte 5 (runes)
TypeScript (strict)
Tailwind v4
Atomic Design (extended)
```

Any generated code violating these rules is **invalid**.

---

# 1. Folder Structure

```
src/
  lib/
    components/
      atoms/               # zero/low-dependency primitives (hand-rolled, NOT shadcn):
                           #   Button, Input, Label, Textarea, Switch, Tooltip, Dialog,
                           #   Select, Slider, EmptyPlaceholder, popover/, context-menu/
      molecules/           # compositions of 2+ atoms (small local UI state ok):
                           #   InputText, InputTextArea, ButtonGroup, SwitchField,
                           #   ConfirmDialog, RenameProjectDialog, Sheet
      organisms/           # large UI blocks (the editor's section components)
    core/                  # pure, framework-light logic (state, ops, geometry, viewport, ...)
    i18n/
    types/
    index.ts               # public API
    app.css                # shipped theme tokens
  routes/                  # demo / dev harness only (NOT published)
```

---

# 2. Atomic Design Architecture

Dependency direction is **strict**:

```
atoms → molecules → organisms → templates → routes
```

- Atoms are the lowest layer — the former `ui/` primitives were dissolved into `atoms/`.
- Skipping layers is **forbidden**, with the documented organism exception below.

### Import rules

| Layer     | May import                                 | Forbidden                               |
| --------- | ------------------------------------------ | --------------------------------------- |
| Routes    | templates, types                           | atoms, molecules, organisms             |
| Templates | organisms                                  | molecules, atoms                        |
| Organisms | molecules (and `core/`, `i18n/`, `types/`) | templates, routes                       |
| Molecules | atoms                                      | organisms, templates, routes            |
| Atoms     | (nothing component-level)                  | molecules, organisms, templates, routes |

> Note: this library keeps the editor's section components in `organisms/`; they may import
> `core/`, `i18n/`, `types/` and `atoms/` primitives directly — including `atoms/popover`,
> `atoms/context-menu` and `atoms/Dialog` — since those primitives have no shadcn/bits-ui
> dependency and wrapping them in molecules would add indirection for no benefit.

---

# 3. Component Responsibility

- **Atoms** — low-level primitives and pure visual components (Button, Input, Dialog, Popover, Tooltip, ContextMenu, Label, Slider, …). Stateless; no business logic, no API calls, no stores, no orchestration.
- **Molecules** — small compositions of 2+ atoms (InputText = Input+Label, ButtonGroup, ConfirmDialog, Sheet, …). Small local UI state allowed; no API calls.
- **Organisms** — large UI blocks. Accept props/snippets; no fetching; orchestration stays at the host.
- **Templates** — page layout composition. Layout only.
- **Routes** — orchestration (the demo harness here).

---

# 4. File Naming

```
Components:  PascalCase.svelte
```

---

# 5. Component Size (guideline)

```
Atoms      < 80 lines
Molecules  < 120 lines
Organisms  < 200 lines   (the timeline section components exceed this by design)
Templates  < 150 lines
```

If a component grows well beyond its budget, prefer splitting it.

---

# 6. Styling

- Pure **Tailwind v4**. No shadcn registry, no bits-ui.
- Theme is driven by self-owned CSS variables (`--ts-*`) in `app.css`; the editor's classes
  (`bg-background`, `text-muted-foreground`, …) are aliased to those tokens via `@theme`.
- Consumers either import the shipped `app.css` or redefine the `--ts-*` variables.

---

# 7. Browser-only

This is a **browser-only** library (DOM, `<video>`/`<audio>`, canvas, rAF). It is safe to
_import_ on the server but must _render_ only in the browser — keep all browser API access out
of module scope (inside functions / `onMount`). Never read or write browser storage in `src/lib`.
