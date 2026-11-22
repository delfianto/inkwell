# Working on Inkwell

Inkwell is an Obsidian plugin for long-form writing. It uses Bun, Vite+,
TypeScript, and Svelte 5. The [README](./README.md) covers setup and storage,
and the [interface guide](./docs/interface.md) describes the writing workflow.

## Development and verification

- Install dependencies with `bun install --frozen-lockfile`. The Bun version is
  pinned in `.tool-versions`.
- Use `bun run check` for formatting and lint, `bun run type-check` for TypeScript
  and Svelte diagnostics, and `bun run test` for the test suite. Tests use
  `vite-plus/test` and the Obsidian stub in `test/__mocks__/obsidian.ts`.
- `bun run build` produces `dist/main.js`, `dist/styles.css`, and
  `dist/manifest.json`. These are generated build artifacts.
- `bun run dev` writes to `test-vault-inkwell/.obsidian/plugins/inkwell/` by
  default, or to `$PLUGINS_DIR/inkwell/` when configured. Vault behaviour such as
  Properties edits, rename events, modal interactions, and compiling can be
  checked in Obsidian using a copy of `test-vault-inkwell/`.

## Where to work

| Area | Files |
|---|---|
| Plugin startup, settings persistence, and Obsidian workspace hooks | `src/main.ts`, `src/model/types.ts`, `src/view/settings/` |
| Project discovery, index reads and writes, and scene paths | `src/model/project-store-sync.ts`, `src/model/project-utils.ts`, `src/model/scene-navigation.ts` |
| Chapter template and scene properties | `src/model/chapter-template.ts`, `src/model/scene-story.ts`, `src/model/story-time.ts` |
| Codex folders and entries | `src/model/codex.ts`, `src/view/explorer/CodexPanel.svelte` |
| Sidebar, Timeline, and Scene details | `src/view/explorer/`, `src/view/modals/SceneDetails.svelte` |
| Compile pipeline, workflow storage, and builder | `src/compile/`, `src/model/workflow-storage.ts`, `src/view/compile/` |

## Storage and workflow

- Keep project frontmatter flat for Obsidian Properties. Multi-scene projects
  use `inkwell: scenes`, single-note projects use `inkwell: single`, and
  indentation in the `scenes` list is encoded with leading `> ` tokens.
- Resolve the scene and Codex folders relative to the index directory. New
  multi-scene projects use `Scenes/` and `Codex/`, with `Assets/`,
  `Characters/`, `Locations/`, and `Timeline/` under the Codex. New Codex
  paths are written with an explicit dot segment such as `./Codex`.
  A relative path such as `../Shared Codex` can point drafts to the same folder.
  `readCodexFolder` handles legacy vault-relative paths. The scene-folder
  value `/` in an older index refers to that project's directory.
- The writing projects folder sets the default creation destination. Project
  discovery scans the vault. The global scene template lives under the
  vault-level `Templates/` folder. Its configured path takes precedence over a
  legacy project template. Keep the Chapter preset's title autofill and YAML
  handling independent of Obsidian's templating plugins.
- Scene details stores chapter notes, references, timing, mood, tags, and
  version in the note's frontmatter. Save edited fields across tabs together.
  Preserve the prose and unrelated properties, and check for conflicting
  edits before writing. Read legacy linked
  `pov` and singular `location` alongside the current `povCharacter` and
  `locations` fields. Resolve Codex references with Obsidian's link resolver.
- Timeline derives its rows from indexed scene notes. Calendar order uses
  `start` and displays `finish` when available. Manual story order uses
  `storyOrder`. `Codex/Timeline/` is a reference folder for the writer. Compile
  uses manuscript order from `Index.md`, regardless of the selected Timeline
  view.
- Compile workflows and user step scripts live in `.obsidian/inkwell/`.
  Changes to the Compile builder should preserve the Longform-compatible step
  API in `src/compile/steps/abstract-compile-step.ts`.

Use existing Obsidian controls and theme variables for UI changes. Update the
README and interface guide when a change affects setup, storage, or a visible
writing workflow.
