# Refactor Plan

A staged cleanup of the codebase following the v3 schema break + writing-goals/sessions trim. Each phase is independently shippable and ends with a green test/lint/build. Phases are ordered from lowest risk + mechanical to higher-risk architectural; do not skip ahead unless you understand the dependencies noted under each phase's **Order constraint**.

This document is the source of truth for refactor scope and progress. Tick the tracker as phases land; keep the checklist inside each phase up to date during execution.

## Progress tracker

| #   | Phase                                              | Status | Notes |
| --- | -------------------------------------------------- | ------ | ----- |
| 1   | Naming hygiene + dead code removal                 | [x]    | api.ts 145→72, project-utils.ts 304→249 LOC |
| 2   | TypeScript hygiene + Obsidian internals            | [x]    | any/@ts-ignore 24→10 (remaining are deferred per plan) |
| 3   | Strip dead semantics + public API rename           | [x]    | v2 migration gone, CompileContext.draft→project, all draft locals → project |
| 4   | Decompose `model/` grab-bags                       | [x]    | note-utils split 3 ways; EBOOK_STRING_KEYS hoisted; updateProject/updateScenesProject helpers added |
| 5   | Refactor `store-vault-sync.ts` event handlers      | [x]    | handlers as dispatchers, 6 intent-named helpers; isInitializing gone; vault-listener helper in main.ts |
| 6   | Test coverage for v3 invariants                    | [x]    | 14 → 54 tests; new files: scene-navigation, scene-stats, word-count-tracker, serialization |
| 7   | Decompose `main.ts` (opportunistic)                | [x]    | main.ts 350→239 LOC; WorkflowStorage + LeafStyler extracted |
| 8   | Split Obsidian-Sync awareness from project sync    | [x]    | ad-hoc follow-on; SyncWaiter extracted, StoreVaultSync → ProjectStoreSync |
| 9   | Drop dead `writeProperty` frontmatter feature      | [x]    | toggle + syncSceneIndices + writeSceneNumbers removed; no readers in plugin |

Status legend: `[ ]` not started, `[~]` in progress, `[x]` complete.

### Verification gate (run after every phase)

```bash
bun run check        # format + lint
bun run type-check   # tsc + svelte-check
bun run test         # vitest
bun run build        # production bundle
```

All four must pass before the phase is marked `[x]`. Commit per phase using the convention from existing history: `refactor: <phase-summary>`.

---

## Phase 1 — Naming hygiene + dead code removal

**Goal:** Remove the last residue of the `Draft` concept from internal identifiers (functions, methods, files — not yet the public `CompileContext.draft` API field), and delete the two `@deprecated` nested-array helpers from `InkwellAPI` plus their backing code.

**Why now:** All changes are mechanical search-and-replace or delete-only. Zero behavioural risk. Lays a clean naming foundation for later phases that will move/restructure these files.

**Order constraint:** None. First phase.

**Risk:** Low. Only internal symbols change; public API (`CompileContext.draft`, command IDs) is deliberately untouched in this phase.

### Tasks

#### 1.1 Rename `src/model/draft-utils.ts` → `src/model/project-utils.ts`

The file is the v3 frontmatter writer + scene-encoding helper. The `draft-` prefix is misleading.

- [ ] `git mv src/model/draft-utils.ts src/model/project-utils.ts`
- [ ] Update imports in: `src/api.ts`, `src/model/store-vault-sync.ts`, `src/view/explorer/SceneList.svelte`, `src/view/modals/NewProjectModal.ts`, `test/model/draft-utils.test.ts` (also rename to `test/model/project-utils.test.ts`)
- [ ] Run `grep -rn "draft-utils" src test` to verify no stragglers

#### 1.2 Drop legacy frontmatter aliases

These two lines re-export already-renamed functions under the old names. Only one caller each.

- [ ] `src/model/draft-utils.ts:155` — delete `export const setDraftOnFrontmatterObject = setProjectFrontmatter;`
- [ ] `src/model/draft-utils.ts:304` — delete `export const insertDraftIntoFrontmatter = insertProjectFrontmatter;`
- [ ] `src/model/store-vault-sync.ts:23, 467` — switch from `setDraftOnFrontmatterObject` to `setProjectFrontmatter`. `insertDraftIntoFrontmatter` has zero callers in the current tree; the alias just dies with its definition.

#### 1.3 Rename `draft*` methods/functions to `project*` (internal only)

- [ ] `src/model/scene-navigation.ts:43` — `draftForPath()` → `projectForPath()`. Update ~12 call sites across `src/main.ts`, `src/commands/navigation.ts`, `src/commands/indentation.ts`, `src/view/explorer/ExplorerPane.ts`, `src/model/store-vault-sync.ts`, `src/model/word-count-tracker.ts`.
- [ ] `src/model/store-vault-sync.ts:191, 360, 460` — `draftsStoreChanged` → `projectsStoreChanged`, `writeDraftFrontmatter` → `writeProjectFrontmatter`, `draftFor` → `projectFor`.
- [ ] `src/model/word-count-tracker.ts:56, 61, 68, 94, 103, 114, 129` — `debouncedCountDraft` → `debouncedCountProject`, `countDraftContaining` → `countProjectContaining`, `countWordsInDraft` → `countWordsInProject`, `debouncedCountDraftContaining` → `debouncedCountProjectContaining`. Update `src/main.ts:363, 368, 374, 380` accordingly.
- [ ] Local variable renames (`draft`, `drafts`, `_drafts`, `draftCount`, `draftTotal`, etc.) — **defer to Phase 3** where the public API rename happens; doing both together is one diff to review.

#### 1.4 Delete deprecated `InkwellAPI` methods and their backing code

`src/api.ts:86, 121` — both methods are `@deprecated` because v3 stores scenes as a flat `> `-prefixed array. The README already states this fork is not a drop-in replacement.

- [ ] Delete `indentedScenesToNestedArrays` and `nestedArraysToIndentedScenes` from `src/api.ts` (lines 54–123 in the current file)
- [ ] Drop the now-unused imports `arraysToIndentedScenes` and `indentedScenesToArrays` from the top of `src/api.ts`
- [ ] Delete `indentedScenesToArrays` (`draft-utils.ts:200`) and `arraysToIndentedScenes` (`draft-utils.ts:226`) — both unused after the above
- [ ] Net: removes ~150 LOC of `any`-typed recursive code

#### 1.5 Consolidate `unsubscribeXxx` properties into a single array

Three files have this pattern (separate `Unsubscriber` fields per subscription, unsubscribed individually in `destroy`/`onunload`/`hide`).

- [ ] `src/main.ts:58–61, 156–159` — replace four `private unsubscribeXxx: Unsubscriber;` with `private unsubscribers: Unsubscriber[] = [];`. Each subscription pushes onto it; `onunload` does `this.unsubscribers.forEach((u) => u())`.
- [ ] `src/view/settings/InkwellSettings.ts:14–15, 337` — currently only one subscriber after Phase 0 cleanup; still worth converting for consistency.
- [ ] `src/model/store-vault-sync.ts:62, 73` — single subscriber; convert for consistency.

### Verification

Run the verification gate. Commit as `refactor: drop Draft naming residue and deprecated API methods`.

### Acceptance

- `grep -rn "Draft\b\|draft-utils\|setDraftOnFrontmatterObject\|insertDraftIntoFrontmatter\|indentedScenesToArrays\|arraysToIndentedScenes" src test` returns only the `CompileContext.draft` field and local variable names (those are Phase 3).
- `wc -l src/api.ts` is ~70 LOC (was 145).
- `wc -l src/model/project-utils.ts` is ~225 LOC (was 304).

---

## Phase 2 — TypeScript hygiene + Obsidian internals

**Goal:** Centralize the "trust Obsidian's private API" boundary in one ambient `.d.ts` file. Fix dishonest return types. Stop using `any` for `event.target`.

**Why now:** Removes ~25 of the 29 `any` sites and ~5 of the 8 `@ts-ignore`s. Future refactors then have type-safe access to `app.internalPlugins`, `WorkspaceLeaf.id`, etc. — no more `(app as any)` repeated everywhere.

**Order constraint:** Best done after Phase 1 (so the renamed files don't need re-touching). Independent of Phases 3–7.

**Risk:** Low. Adding ambient declarations cannot change runtime; only widens or narrows type-checker behaviour. The return-type honesty changes may surface a few callsites that need explicit null checks.

### Tasks

#### 2.1 Create `src/lib/obsidian-internal.d.ts`

(Or `src/obsidian-internal.d.ts` — wherever `tsconfig.json`'s `include` already covers. Verify with `cat tsconfig.json` first.)

- [ ] Declare module augmentations for the private surface in use today:
    ```ts
    import "obsidian";

    declare module "obsidian" {
      interface App {
        internalPlugins: {
          plugins: {
            sync?: { enabled: boolean; instance?: { syncing: boolean; syncStatus: string } };
            "file-explorer"?: { instance: { revealInFolder(folder: TFolder): void } };
            templates?: unknown;
          };
          getEnabledPluginById(id: string): { options: Record<string, string> } | null;
        };
        plugins: {
          getPlugin(id: string): TemplaterPlugin | null;
        };
      }
      interface WorkspaceLeaf { id?: string; }
      interface FileView { emptyTitleEl?: HTMLElement; emptyStateEl?: HTMLElement; }
    }

    interface TemplaterPlugin {
      templater: {
        create_running_config(template: TAbstractFile, file: TFile, runMode: number): RunningConfig;
        read_and_parse_template(config: RunningConfig): Promise<string>;
      };
    }
    type RunningConfig = unknown;
    ```
- [ ] Delete `// @ts-ignore` and `(app as any)` / `(leaf as any)` casts at:
    - `src/main.ts:132, 396`
    - `src/model/store-vault-sync.ts:78, 95`
    - `src/model/note-utils.ts:82, 86, 90, 102`
    - `src/commands/navigation.ts:180`

#### 2.2 Make return types honest

- [ ] `src/model/note-utils.ts:89, 101` — `createWithTemplater` and `createWithTemplates` declare `Promise<string>` but the error path does `return;`. Change return type to `Promise<string | null>` and let `createNoteWithPotentialTemplate` (same file, line 18) handle `null`.
- [ ] `src/model/user-script-observer.ts:62` — `loadUserSteps()` declares `Promise<CompileStep[]>` but early-returns `undefined`. Change to `Promise<CompileStep[] | null>` (or refactor so it always returns an array, even if empty — easier for callers).
- [ ] `src/model/user-script-observer.ts:19` — `private onScriptModify: any;` should be `private onScriptModify: () => void;` or `import type { Debouncer } from "obsidian"` and use `Debouncer<[], void>`.

#### 2.3 Replace `(event.target as any).value` with `HTMLInputElement` casts

- [ ] `src/view/explorer/ProjectDetails.svelte:23, 59, 89` — change to `(event.target as HTMLInputElement).value`. Other handlers in the same file (lines 149, 162) already do this; this is a consistency fix.

#### 2.4 Quiet down per-tick sync logging

- [ ] `src/model/store-vault-sync.ts:124` — `console.log("[Inkwell] Sync status:", sync.syncStatus)` fires every 1 second while waiting for sync. Delete it. The "Waiting for active sync to complete…" log at line 113 and the "Sync complete." log at line 120 are enough.
- [ ] Optional: introduce `src/lib/log.ts` with `info` / `warn` / `error` wrappers and a `debug` flag. Replace ~30 `console.log` sites. **Skip if it feels like overkill** — the bigger issue is the per-tick spam, which is one-line fix.

### Verification

Verification gate. Pay attention to `bun run type-check` output — the ambient `.d.ts` may surface new errors at the old `any` sites. Fix each by tightening the declaration in `obsidian-internal.d.ts` if it was too loose, or by handling the genuinely-nullable case at the callsite.

Commit as `refactor: type Obsidian internals + honest return types`.

### Acceptance

- `grep -rn ": any\b\| as any\b\|@ts-ignore" src/` returns 0 hits (excluding `obsidian-internal.d.ts` itself, which may need 1–2 internal `any`s for genuinely-untyped Obsidian fields).
- No regression in `bun run type-check`.

---

## Phase 3 — Strip dead semantics + public API rename

**Goal:** Delete code paths whose preconditions can no longer hold (v2 workflow migration, title-grouped word totals). Then do the public API rename of `CompileContext.draft` → `project` plus local-variable renames that were deferred from Phase 1.

**Why now:** The dead-code deletions reduce noise before the rename diff lands. The public API rename is the last user-script-affecting change — best to do it once and clearly.

**Order constraint:** After Phase 1 (so the file/function rename has already settled). Independent of Phase 2 but easier to review if Phase 2 is done first.

**Risk:** Medium. The `CompileContext.draft → project` rename breaks any user-authored compile scripts in vaults that reference `context.draft`. This is consistent with the v3 README's "not a drop-in replacement" stance, but it warrants a CHANGELOG note. The dead-code deletions need a verification step before deleting in case the semantics are load-bearing in ways the static read missed.

### Tasks

#### 3.1 Delete v2 → v3 workflow migration code

`src/main.ts:187–195` is a one-time migration from `data.json` workflows to the vault-stored `.obsidian/inkwell/workflows.json`. The fork's v3 schema break means no user is upgrading from v2 through this codepath.

- [ ] Delete the migration block (lines 187–195 in current `loadSettings`)
- [ ] Simplify the surrounding logic: after migration removal, the flow is just "try to load from vault file; if absent, use `DEFAULT_WORKFLOWS`"
- [ ] Drop the unused `"workflows"` key check on the settings object

#### 3.2 Audit + delete title-grouped word totals

`src/model/note-utils.ts:148–151, 158, 160` — `totalForProject(title, drafts, counts)` sums word counts over all projects sharing the same title. The `projectsByTitle` derived store (`src/model/stores.ts:28`) deduplicates by title, so this either sums over one element (waste) or silently picks one when there are dupes.

- [ ] Verify by reading: are duplicate-title projects a supported scenario? If `projectsByTitle` is the only consumer and titles are required to be unique, the sum is dead.
- [ ] If confirmed dead: collapse `totalForProject` into a direct `totalForDraft` call, removing the `drafts` parameter from `statsForScene`. Update callers in `src/view/stores.ts` (the `selectedProjectWordCountStatus` derived store) and `src/view/explorer/ProjectDetails.svelte`.
- [ ] If kept (because dupes are a real case): document why with a code comment.

#### 3.3 Public API rename: `CompileContext.draft` → `project`

This is the last `draft` identifier exposed to user code.

- [ ] `src/compile/steps/abstract-compile-step.ts:127` — rename field
- [ ] `src/compile/index.ts:171` — function parameter
- [ ] Each of `src/compile/steps/*.ts` — uses `context.draft` to varying degrees. Grep first: `grep -rn "context.draft\b\|\.draft\." src/compile/`
- [ ] **CHANGELOG note** required. The README already calls out the v3 break; add a line under v3 changes stating that compile-step user scripts now use `context.project` instead of `context.draft`.

#### 3.4 Deferred local-variable rename from Phase 1

Now that the public field is also `project`, rename the dozens of `draft`/`drafts` locals across:
- `src/model/scene-navigation.ts`
- `src/model/word-count-tracker.ts`
- `src/model/store-vault-sync.ts`
- `src/model/note-utils.ts`
- `src/view/explorer/ExplorerPane.ts`
- `src/commands/indentation.ts` (note: this file has `import { projects as draftsStore }` — drop the alias entirely)

- [ ] One commit per file is fine for review-ability; or one mega-commit with a clear message. Author's choice.

#### 3.5 Public command ID rename

- [ ] `src/commands/navigation.ts:67` — `focusCurrentDraft` command id. Decide: rename to `focusCurrentProject` (breaks any user hotkey bindings to the old id), or keep the id for backward compat and rename only the function name. Recommend renaming — consistent with the v3 clean break.

### Verification

Verification gate. Manually open the plugin in a test vault, create a project, open a scene, run a compile workflow — confirm the rename didn't break anything. Pay attention to user-script behaviour if any are installed.

Commit as `refactor: drop dead v2 code + rename CompileContext.draft to project`.

### Acceptance

- `grep -rni "\bdraft\b" src/` returns only matches inside comments referring to upstream history or in the v2 schema migration mention (none should remain in code paths).
- v3 README/CHANGELOG mentions the `context.draft` → `context.project` rename.
- The `totalForProject` audit is resolved either way (deleted or commented).

---

## Phase 4 — Decompose `model/` grab-bags

**Goal:** Split `src/model/note-utils.ts` (171 LOC, three unrelated concerns) into focused modules. Hoist the duplicated ebook key list out of two files. Add an `updateProject(vaultPath, mutator)` store helper to dedupe the projects-update boilerplate scattered across ~9 sites.

**Why now:** With naming settled, the file split won't churn names twice. The `updateProject` helper makes Phase 5 (store-vault-sync handler refactor) materially simpler.

**Order constraint:** After Phases 1–3. Phase 5 builds on the `updateProject` helper from this phase.

**Risk:** Low–medium. File splits are pure move + import update. The `updateProject` helper is new code; needs a test (see Phase 6).

### Tasks

#### 4.1 Split `src/model/note-utils.ts` into three files

Current concerns mixed in the file:
- `fileNameFromPath()` — pure path util
- `createNote()` + `createNoteWithPotentialTemplate()` + Templater/Templates probing — vault I/O + third-party plugin glue
- `SceneWordStats` + `statsForScene()` — word-count aggregation

Target layout (assuming you want to keep things under `src/model/`; otherwise put them in a `src/lib/` shared directory):

- [ ] `src/lib/path.ts` — `fileNameFromPath`
- [ ] `src/model/note-create.ts` — `createNote`, `createNoteWithPotentialTemplate`, the template-plugin probing helpers (`isTemplaterEnabled`, `isTemplatesEnabled`, `createWithTemplater`, `createWithTemplates`)
- [ ] `src/model/scene-stats.ts` — `SceneWordStats` type, `statsForScene`
- [ ] Delete the now-empty `src/model/note-utils.ts`
- [ ] Update every importer:
    - `fileNameFromPath` is imported by `src/model/store-vault-sync.ts` and `src/view/stores.ts`
    - `createNoteWithPotentialTemplate` is imported by `src/model/draft-utils.ts` (post-Phase-1: `src/model/project-utils.ts`)
    - `statsForScene` + `SceneWordStats` are imported by `src/view/stores.ts`

#### 4.2 Deduplicate ebook field constants

Two files declare the same nine-key list:
- `src/model/draft-utils.ts:9–19` — `EBOOK_STRING_FIELDS` (`as const satisfies`)
- `src/model/store-vault-sync.ts:518–539` — `EbookStringKey` type + `EBOOK_STRING_KEYS` array

- [ ] Move both to `src/model/types.ts` next to `EbookMetadata`:
    ```ts
    export const EBOOK_STRING_KEYS = [
      "author", "language", "identifier", "description",
      "cover", "publisher", "pubdate", "rights", "series",
    ] as const satisfies readonly (keyof EbookMetadata)[];
    export type EbookStringKey = typeof EBOOK_STRING_KEYS[number];
    ```
- [ ] Import from both `project-utils.ts` and `store-vault-sync.ts`

#### 4.3 Add `updateProject(vaultPath, mutator)` store helper

Current pattern, repeated at `store-vault-sync.ts:238, 267, 280, 297, 317, 331, 347` and elsewhere:
```ts
projectsStore.update((all) =>
  all.map((p) => {
    if (p.vaultPath === target.vaultPath && p.format === "scenes") {
      // mutate p
    }
    return p;
  }),
);
```

Target:
```ts
// in src/model/stores.ts
export function updateProject(
  vaultPath: string,
  mutator: (p: Project) => void,
): void {
  projects.update((all) =>
    all.map((p) => {
      if (p.vaultPath === vaultPath) mutator(p);
      return p;
    }),
  );
}

// scene-format-specific variant
export function updateScenesProject(
  vaultPath: string,
  mutator: (p: MultipleSceneProject) => void,
): void {
  projects.update((all) =>
    all.map((p) => {
      if (p.vaultPath === vaultPath && p.format === "scenes") mutator(p);
      return p;
    }),
  );
}
```

- [ ] Add to `src/model/stores.ts`
- [ ] Refactor the ~9 call sites in `store-vault-sync.ts`, `commands/indentation.ts`, `model/project-utils.ts` to use the helper
- [ ] Note: the helper mutates `p` in-place inside `.map()` — keep that semantics (the existing code does this); the helper is just consolidating the loop + identity check + return.

### Verification

Verification gate. Manually exercise project rename, scene add/delete/rename, ignore-file toggles — all hit the `updateProject` paths.

Commit as `refactor: split note-utils, hoist ebook keys, add updateProject helper`.

### Acceptance

- `src/model/note-utils.ts` is deleted.
- `EBOOK_STRING_KEYS` is defined exactly once (in `types.ts`).
- `grep -rn "projects.update((all) =>" src/` returns 0 — all callers go through `updateProject`/`updateScenesProject`.

---

## Phase 5 — Refactor `store-vault-sync.ts` event handlers

**Goal:** Break up the long, nested `fileCreated` / `fileDeleted` / `fileRenamed` methods into small intent-named operations. Replace the `isInitializing` boolean guard with a cleaner init lifecycle. Add the vault-listener registration helper to `main.ts`.

**Why now:** This is the largest single file in `src/` (580 LOC) and the most complex method bodies. Refactoring becomes much cheaper once Phase 4 has shipped `updateProject` (eliminates half the boilerplate in these handlers).

**Order constraint:** After Phase 4 (depends on `updateProject` helper).

**Risk:** Medium. These handlers respond to Obsidian vault events — subtle bugs can desync the in-memory project list from the vault. Add tests in Phase 6 before this lands, or at least do extensive manual exercising.

### Tasks

#### 5.1 Extract intent-named operations from event handlers

`src/model/store-vault-sync.ts:226 (fileCreated)`, `253 (fileDeleted)`, `293 (fileRenamed)`.

Suggested private methods to extract:
- [ ] `addUnknownSceneFile(project: MultipleSceneProject, name: string)` — used by both `fileCreated` and the rename "moved into a project" branch
- [ ] `removeProjectByPath(path: string)` — used by `fileDeleted` when an index file is deleted
- [ ] `removeSceneFromProject(projectPath: string, sceneIndex: number)` — used by `fileDeleted` when a scene file is deleted
- [ ] `removeUnknownFile(projectPath: string, basename: string)` — used by `fileDeleted` and rename "moved out" branches
- [ ] `renameProject(oldPath: string, newPath: string)` — used by `fileRenamed` when an index file is renamed
- [ ] `renameScene(finding: SceneFinding, newTitle: string)` — used by `fileRenamed` for in-place scene rename

Each `fileXxx` becomes a 5–10 line classifier that delegates. Easier to read, easier to unit test (Phase 6 target).

#### 5.2 Drop the `isInitializing` boolean

`src/model/store-vault-sync.ts:58, 195, 227, 254, 294` — every public handler starts with `if (this.isInitializing) return;`. The flag flips in `initialize()`'s `finally`.

Two reasonable approaches:
- [ ] **Option A — state machine.** Add `private status: "idle" | "initializing" | "ready" = "idle"` and one `guard()` helper that returns early unless ready. Cleaner intent, marginally more code.
- [ ] **Option B — register-after-init.** Move the `this.registerEvent(...)` calls for the sync's handlers out of `main.ts:watchProjects` and into `StoreVaultSync.initialize()`'s end. Then the handlers literally cannot fire before init completes. No guard needed.

Recommend Option B — eliminates the boolean entirely and matches how `WordCountTracker` already works (constructor subscribes to the `projects` store, no init flag needed).

#### 5.3 Vault-listener helper in `main.ts`

Currently `src/main.ts:310–383` registers 12 listeners across user-scripts, store-vault-sync, word-count-tracker — each a 4-line `this.registerEvent(...bind(this)...)` block.

- [ ] Add a private helper:
    ```ts
    private registerVaultListeners(handlers: {
      modify?: (f: TAbstractFile) => void;
      create?: (f: TAbstractFile) => void;
      delete?: (f: TAbstractFile) => void;
      rename?: (f: TAbstractFile, oldPath: string) => void;
    }) {
      if (handlers.modify) this.registerEvent(this.app.vault.on("modify", handlers.modify));
      if (handlers.create) this.registerEvent(this.app.vault.on("create", handlers.create));
      if (handlers.delete) this.registerEvent(this.app.vault.on("delete", handlers.delete));
      if (handlers.rename) this.registerEvent(this.app.vault.on("rename", handlers.rename));
    }
    ```
- [ ] Convert the three subsystems' registrations into three calls. Each becomes 4–6 lines instead of 16–24.

### Verification

Verification gate. **Manual test required:** in a vault, create a project, add scenes, rename scenes, delete scenes, move scene files in/out of the scene folder, rename the index file. Confirm the Project tab + Scenes tab reflect each change correctly.

Commit as `refactor: simplify store-vault-sync event handlers + vault listener helper`.

### Acceptance

- No method in `store-vault-sync.ts` exceeds ~25 lines.
- `isInitializing` field is gone.
- `src/main.ts:watchProjects` (or its successor) is ~30 LOC, was ~75.

---

## Phase 6 — Test coverage for v3 invariants

**Goal:** Lock down the v3 schema (flat `> `-prefixed scene encoding, frontmatter round-trip) and the most commonly-touched pure functions with unit tests, before further refactors can silently break them.

**Why now:** With Phases 1–5 stable, the codebase is at a known-good baseline. Now is the time to encode invariants as tests so Phase 7 and any future work can refactor with confidence.

**Order constraint:** After Phase 5 (so the refactored handlers in `store-vault-sync.ts` are stable before being tested). Can also be done incrementally alongside other phases.

**Risk:** None — tests can only catch regressions, not introduce them.

### Tasks

Pure-function targets (no Obsidian mocking required beyond the existing `test/__mocks__/obsidian.ts`):

- [ ] `test/model/project-utils.test.ts` — extend existing draft-utils tests to cover:
    - `encodeIndentedScenes` round-trips through `decodeFlatScenes` for arbitrary `IndentedScene[]`
    - `numberScenes` produces correct `numbering[]` for nested-indent sequences (e.g. `[0, 1, 1, 0, 1]` indents → `[[1], [1,1], [1,2], [2], [2,1]]`)
    - `formatSceneNumber` formats correctly
    - `setProjectFrontmatter` strips legacy nested `inkwell:` object (line 93–95 path)
- [ ] `test/model/scene-navigation.test.ts` — `findScene`, `projectForPath`, `scenePath` against synthetic project trees
- [ ] `test/model/scene-stats.test.ts` — `statsForScene` for both `format: "scenes"` and `format: "single"` projects, with active file inside/outside the project
- [ ] `test/model/word-count-tracker.test.ts` — extract the `countWords` function (currently file-private) to module-level export and test it against markdown samples: code fences, dataview, YAML frontmatter strip, comment strip, multi-byte CJK runs
- [ ] `test/compile/serialization.test.ts` — workflow `serialize` → `deserialize` round-trip preserves all step option values and ordering
- [ ] `test/model/store-vault-sync.test.ts` (the hard one) — exercise `parseProjectFor` (post-Phase-5 name) with synthetic `CachedMetadata` + minimal Obsidian mocks. Cover: missing frontmatter, malformed `scenes:`, ignored-files patterns, ebook field parsing.

### Verification

`bun run test` shows expanded coverage. Don't gate the verification gate on a coverage threshold; aim for "every pure function in `src/model/` and `src/compile/` has at least one test."

Commit as `test: cover v3 schema invariants and pure utilities`.

### Acceptance

- `find test -name "*.test.ts" | wc -l` is at least 6 (was 2).
- The flat-array scene encoding is round-trip tested (this was the riskiest v3 schema break and currently has zero tests).

---

## Phase 7 — Decompose `main.ts` (opportunistic)

**Goal:** Slim `InkwellPlugin` to a coordinator that wires components together, not one that implements them.

**Why now:** Lowest priority. Only worth doing when you're next touching plugin lifecycle code for an unrelated reason. The `TODO: Try and abstract away more logic from actual plugin hooks here` comment at `src/main.ts:51` has been there since upstream; it can wait.

**Order constraint:** After Phase 5 (so the listener helper is in place). Otherwise independent.

**Risk:** Medium. Lifecycle code is the most subtly-ordered part of an Obsidian plugin. Move things in small steps and re-test the full plugin load each time.

### Tasks

#### 7.1 Extract workflow storage

`src/main.ts:209–244, 285–295` — `workflowsDir`, `workflowsPath`, `loadWorkflowsFromVault`, `saveWorkflowsToVault`, and the debounced subscriber.

- [ ] Create `src/model/workflow-storage.ts` with class `WorkflowStorage { constructor(app: App, manifest: PluginManifest); load(): Promise<...>; save(): Promise<void>; watchStore(): Unsubscriber; destroy(): void; }`
- [ ] Construct in `onload`, call `await storage.load()` in place of the current inline workflow logic, register `watchStore()` return into the unsubscriber array.

#### 7.2 Extract leaf styling

`src/main.ts:385–402` — `styleInkwellLeaves` reacts to project changes and active-leaf changes to add/remove a CSS class on markdown views.

- [ ] Move into `src/view/leaf-styler.ts` with class `LeafStyler { constructor(workspace: Workspace); watch(projectsStore: Readable<Project[]>): Unsubscriber; destroy(): void; }`
- [ ] `main.ts` constructs it, calls `watch(projects)`.

#### 7.3 Aim for `main.ts` ≤ 200 LOC

After 7.1 and 7.2, the remaining responsibilities are:
- Plugin lifecycle (`onload`, `onunload`, `addSettingTab`, `registerView`)
- Settings persistence (`loadSettings`, `saveSettings`, the `pluginSettings` subscriber)
- Wiring (construct `StoreVaultSync`, `WordCountTracker`, `WorkflowStorage`, `LeafStyler`, `UserScriptObserver`)
- The `file-menu` registration for the "Create Inkwell Project" right-click

That's a coordinator, not an implementer. Should fit comfortably under 200 LOC.

### Verification

Verification gate. **Manual full-plugin load test:** open Obsidian with the plugin enabled, confirm the explorer pane renders, scenes render, word counts update, compile workflows run, settings tab works. Each subsystem extracted has its own correctness story; lifecycle ordering is where bugs hide.

Commit as `refactor: extract workflow storage and leaf styling from main.ts`.

### Acceptance

- `wc -l src/main.ts` ≤ 200.
- Each extracted class has its own `destroy`/`unsubscribe` and is cleaned up in `onunload`.

---

## Out of scope (for now)

These were flagged in the analysis pass but deliberately not included:

- **Rebuilding the explorer UI** — `SceneList.svelte` (565 LOC), `ProjectDetails.svelte` (533 LOC), `CompileView.svelte` (522 LOC) are all large but functional. Splitting them into smaller Svelte components is a UI refactor, not a code-quality refactor; tackle it when the UX needs change, not as cleanup.
- **Migrating `new AddStepModal({ target, context })` to Svelte 5 `mount()`** — `src/view/modals/AddStepModal.ts:20` still uses the legacy Svelte 4 constructor pattern. Works because of Svelte 5's legacy API, but should eventually move to `mount()` like `NewProjectModal.ts` already does.
- **Introducing a logger module** — flagged in Phase 2 as optional. Worth doing only if console noise becomes a real problem. The per-tick sync log was the worst offender; that's a one-line fix in Phase 2.4.
- **Replacing lodash usage with native equivalents** — `cloneDeep`, `isEqual`, `debounce`, `once`, `pick`, `sortBy`, `sum`, `last` are all used. Bundle size impact is real (~10KB) but lodash is rock-solid; not a priority.

---

## Conventions

- One phase per commit (or per small commit series within a phase if a phase is large).
- Commit message convention matches existing history: `refactor: ...`, `test: ...`, `docs: ...`, `fix: ...`.
- Update the progress tracker (top of this file) in the same commit that completes a phase.
- If a phase needs to be split across multiple sessions, mark `[~]` in progress and add a note in the Notes column about where you stopped.
