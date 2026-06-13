# Frontend Engineering Contract — Atomic Design (STRICT)

This is a standalone Svelte 5 component library (`svelte-timeline-studio`). The only
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
      ui/                  # zero-dependency low-level primitives (hand-rolled, NOT shadcn)
      atomic/
        atoms/
        molecules/
        organisms/
        templates/
    core/                  # pure, framework-light logic (state, ops, geometry, ...)
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
ui → atoms → molecules → organisms → templates → routes
```

- **DO NOT** import `ui` directly in molecules, organisms, or templates.
- `ui` **MUST BE** imported in atoms only.
- Skipping layers is **forbidden**.

### Import rules

| Layer | May import | Forbidden |
|---|---|---|
| Routes | templates, types | ui, atoms, molecules, organisms |
| Templates | organisms | molecules, atoms, ui |
| Organisms | molecules (and `core/`, `i18n/`, `types/`) | templates, routes |
| Molecules | atoms | organisms, templates, routes |
| Atoms | ui | molecules, organisms, templates, routes |
| UI | (nothing component-level) | everything above |

> Note: this library keeps the editor's section components in `organisms/`; they may import
> `core/`, `i18n/`, `types/` and `atoms` / `ui/{popover,context-menu}` primitives directly,
> since those primitives have no shadcn/bits-ui dependency.

---

# 3. Component Responsibility

- **UI** — low-level primitives (Button, Input, Dialog, Popover, Tooltip, ContextMenu, …). No business logic, no API calls, no orchestration.
- **Atoms** — pure visual components (Avatar, Badge, Label, Icon). Stateless; no API calls; no stores.
- **Molecules** — small UI compositions (SearchInput, FormField, UserCard). Small local UI state allowed; no API calls.
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
*import* on the server but must *render* only in the browser — keep all browser API access out
of module scope (inside functions / `onMount`). Never read or write browser storage in `src/lib`.
