# Inkwell

An Obsidian plugin for writing novels, screenplays, and other long-form projects.

Inkwell began as a personal fork of [kevboh/longform](https://github.com/kevboh/longform) and has since diverged into its own project. Upstream Longform is no longer actively maintained, so Inkwell continues independently — with a **ground-up UI reimplementation**, a rebuilt toolchain, and a rethought way of storing project metadata in your vault, primarily to:

- make `Index.md` frontmatter safe to round-trip through Obsidian's Properties UI without nuking your project, and
- treat eBook / Dublin Core metadata as a first-class part of the project — no separate sidecar files.

This is a personal project, built to scratch my own writing setup and maintained for an audience of one. You're welcome to use it as-is, but I'm not accepting feature requests or PRs, and there's no roadmap, no support promises, and no guarantee of stability across releases.

> [!CAUTION]
> Inkwell uses an `Index.md` frontmatter schema that is **incompatible** with upstream Longform's. There is **no automated migration**. Projects authored against upstream Longform need a one-time hand-edit. See [Migrating](#migrating) below.

## What it is

- Modernized stack: [Bun](https://bun.com), [Vite+](https://voidzero.dev) (alpha) as a unified toolchain, Svelte 5 (runes), TypeScript 6. Zero runtime dependencies beyond Popper and SortableJS (lodash was dropped in favor of native JS).
- **Flat frontmatter schema** — every project key lives at the top level of `Index.md` so Obsidian's Properties UI can edit it without flattening or losing structure.
- **eBook metadata first-class** — `author`, `language`, `identifier`, `description`, `cover`, `publisher`, `pubdate`, `rights`, `subjects`, `series`, `seriesIndex` live alongside `title` / `workflow` / `scenes`. An EPUB-producing compile step can read them directly; no sidecar file.
- **Scene display labels** — the Scenes tab uses each scene file's `frontmatter.title` as its row label (live-updating), falling back to the filename. Lets you name files concisely (`ch01-s02.md`) while displaying a friendlier title.
- **Redesigned interface** — nearly every writing surface was reimplemented: three Scenes views (List / Cards / Outline) with colour-coded status and per-scene word counts, a lean Project tab, an eBook metadata modal, an action-first New Project modal, and a full-pane Compile builder. See [A redesigned interface](#a-redesigned-interface).
- The full Longform workflow is intact underneath: a sidebar pane, reorderable nested scene list, per-project/per-scene word counts, compile workflows, single-scene and multi-scene projects, and multiple drafts grouped by title. Writing-session goals and the status-bar word count have been removed — Obsidian's built-in word-count statistic covers the latter.

Because Inkwell uses its own plugin id (`inkwell`), it can be installed alongside upstream Longform without conflict.

## A redesigned interface

The UI Inkwell inherited from Longform worked but had never had a design pass. `2.0.0` rebuilt nearly every surface — driven by a written usability [audit](./docs/ui-audit/README.md) and [mockups](./docs/ui-audit/mockups/MOCKUPS.md), both kept in the repo.

<table>
  <tr>
    <td width="34%" valign="top"><img src="docs/images/scenes-cards.png" alt="Scenes — Cards view"></td>
    <td width="66%" valign="top"><img src="docs/images/compile-builder.png" alt="Compile builder"></td>
  </tr>
  <tr>
    <td valign="top"><b>Scenes</b> — List / Cards / Outline views with colour-coded status, per-scene word counts, and collapsible acts.</td>
    <td valign="top"><b>Compile</b> — a full-pane builder: one-line steps with colour-coded kinds on the left, config + live preview on the right, Run always in reach.</td>
  </tr>
</table>

There's also a lean Project tab, a wide **eBook metadata modal**, and an action-first **New Project** modal.

- **[Interface guide](./docs/interface.md)** — a walkthrough of every surface.
- **[The UI redesign](./docs/ui-redesign.md)** — the full before/after.

## Schema vs. upstream Longform `2.x`

| Area | Upstream Longform `2.x` | Inkwell |
|---|---|---|
| Discriminator | Nested `longform:` object with `format:` inside | Top-level `inkwell: scenes` or `inkwell: single` |
| Project keys | Nested under `longform.*` | Top-level — `title`, `workflow`, `sceneFolder`, `scenes`, `ignoredFiles`, `sceneTemplate` |
| Scene hierarchy | Nested YAML arrays (`- - second scene`) | Flat array with `> ` prefix tokens (`"> second scene"`) — round-trips safely through Obsidian's Properties UI |
| eBook metadata | Not handled; users keep a sidecar file | First-class top-level keys (see above), edited through a dedicated **eBook metadata modal** (grouped Identity / Publication / Classification, subject chips, cover thumbnail, Generate-UUID) launched from the Project tab |
| Scene display label | Filename only | `frontmatter.title` of each scene file, falling back to filename |
| Migration | Plugin runs a migration on first launch | **None.** Files using the legacy nested form are silently ignored. |

## Migrating

**From upstream Longform `2.x`:** open each `Index.md` and rewrite the frontmatter.

**Before** (upstream Longform `2.x`):

```yaml
---
longform:
  format: scenes
  title: My Novel
  workflow: Default Workflow
  sceneFolder: /
  scenes:
    - first scene
    - - second scene
      - third scene
    - fourth
  ignoredFiles:
    - "*-scratch"
---
```

**After** (Inkwell):

```yaml
---
inkwell: scenes
title: My Novel
workflow: Default Workflow
sceneFolder: /
scenes:
  - first scene
  - "> second scene"
  - "> third scene"
  - fourth
ignoredFiles:
  - "*-scratch"
---
```

Each nested array level in `scenes:` becomes one `> ` token. Save the file and the project reappears in the Inkwell pane. eBook fields are optional and can be added later through the Project tab UI.

If you're coming from Longform, also move its data folder, which Inkwell relocated from `<vault>/.obsidian/longform/` to `<vault>/.obsidian/inkwell/` — move your `workflows.json` and any user compile-step scripts there.

## Installing

Not in the Community Plugins store. Two ways to install:

### Via BRAT (recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs plugins directly from GitHub releases and keeps them auto-updated:

1. Install **BRAT** from Obsidian's Community Plugins and enable it.
2. Run the command **"BRAT: Add a beta plugin for testing"**.
3. Enter `delfianto/inkwell` and confirm.

BRAT pulls the release assets into `.obsidian/plugins/inkwell/`, enables the plugin, and checks for new releases automatically.

### Manual

1. Download `manifest.json`, `main.js`, and `styles.css` from a [release](https://github.com/delfianto/inkwell/releases).
2. Drop them into `.obsidian/plugins/inkwell/` inside your vault.
3. Enable **Inkwell** in Obsidian's Community Plugins settings.

## Getting started

The **[Interface guide](./docs/interface.md)** is the visual walkthrough — creating a project, the three Scenes views, scene status colours, the Project tab, the eBook modal, and the Compile builder. Inkwell's UI is a ground-up reimplementation, so upstream Longform's walkthrough no longer matches; the on-disk `Index.md` schema (covered above) is the other practical difference.

## Stack

| Layer | Tool |
|---|---|
| Runtime / package manager | [Bun](https://bun.com) |
| Build / lint / format / test / type-aware lint | [Vite+](https://voidzero.dev) (alpha) — `vp build`, `vp test`, `vp check`, `vp lint`, `vp fmt` |
| UI framework | Svelte 5 (runes mode) |
| Type-checking | `tsc --noEmit` (TypeScript 6.x) + `svelte-check` (kept until Vite+ adds Svelte type-check coverage) |

`vite` isn't declared as a devDependency — it resolves to Vite+'s vendored build via a `package.json` `override`. `vitest` (`4.1.10`) is a normal devDependency, pinned to the version Vite+ bundles.

Type-checking stays on the TypeScript **6.x** line: TypeScript 7 is the Go rewrite and no longer exposes the JS compiler API that `svelte-check` (and most editor tooling) relies on, so it can't type-check `.svelte` files yet. Inkwell will move to native TS7 once `svelte-check` supports it.

## Development

```sh
bun install          # one-time
bun run dev          # watch build into test-inkwell-vault/.obsidian/plugins/inkwell
bun run build        # production build → ./dist (main.js, styles.css, manifest.json)
bun run test         # vp test run (vitest)
bun run type-check   # tsc + svelte-check
bun run check        # vp check (format + lint)
bun run lint:fix     # autofix lint
bun run format       # autofix formatting
```

Release artifacts after `bun run build` live in `./dist/`. Zip the three files there for a GitHub release; users drop them into `.obsidian/plugins/inkwell/`.

## Scene-only styling

Inkwell attaches the `.inkwell-leaf` CSS class to any pane editing a scene or index file. This lets you style your writing environment independently of the rest of Obsidian. Upstream's [Scene-only Styling](https://github.com/kevboh/longform#scene-only-styling) section has a working example (adapt the class name to `.inkwell-leaf`).

## Troubleshooting

> [!IMPORTANT]
> **Inkwell never alters the contents of your scene notes.** The only file it rewrites is each project's `Index.md`. Scene files are read-only from the plugin's perspective.

If a project disappears from the sidebar after you edit its `Index.md`, the frontmatter no longer matches the schema — most often a missing top-level `inkwell: scenes` (or `single`). Either fix it by hand or restart Obsidian. Inkwell recomputes projects from frontmatter on each load and never deletes files based on frontmatter state.

## License

Inkwell's own code is released under the [MIT License](./LICENSE). Portions inherited from upstream [Longform](https://github.com/kevboh/longform) remain under their original license, preserved in [LICENSE-longform.md](./LICENSE-longform.md). See [NOTICE](./NOTICE) for the full provenance.

## Credits

Inkwell stands entirely on [kevboh's](https://github.com/kevboh) original [Longform](https://github.com/kevboh/longform). The plugin architecture, compile pipeline, scene/draft model, and most of what makes it useful were all there before I touched it; the `2.0.0` redesign restyles and re-lays-out those surfaces, but the engine underneath is Longform's. The community [collection of compile steps](https://github.com/obsidian-community/longform-compile-steps) continues to apply — the compile step API is unchanged.
