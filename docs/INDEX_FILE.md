# The Index File

The Index File is a note whose frontmatter contains a top-level `inkwell` key set to `scenes` or `single`. You can think of it as the "root" of a project: it tells Inkwell what kind of project it is, where the scenes are, and what metadata describes the finished work.

## Schema (flat)

In Inkwell, all project metadata lives as **flat, top-level frontmatter keys**. This differs from upstream Longform, which nests everything under a `longform:` object; Inkwell keeps keys flat because Obsidian's Properties UI cannot safely round-trip nested objects or nested arrays — a single accidental save through the Properties panel was enough to flatten the structure and "nuke" a project.

The schema:

```yaml
---
inkwell: scenes               # required: "scenes" or "single" — the discriminator
title: My Novel                # optional; falls back to the filename
workflow: Default Workflow     # set by Inkwell; do not edit by hand
sceneFolder: /                 # scenes-only: where scenes live relative to this file
sceneTemplate: tpl.md          # scenes-only: optional template for new scenes
ignoredFiles:                  # scenes-only: filenames (or wildcards) to ignore
  - "*-scratch"
scenes:                        # scenes-only: ordered list of scene filenames
  - first scene
  - "> second scene"           # one leading "> " = one indent level
  - "> third scene"
  - "> > deep child"           # two indents
  - fourth

# Optional eBook / Dublin Core metadata
author: Jane Doe
language: en
identifier: urn:uuid:5b…
description: A great novel about…
cover: assets/cover.png
publisher: Self
pubdate: 2026-05-23
rights: All rights reserved.
subjects: [fiction, science-fiction]
series: The Foo Saga
seriesIndex: 1
---
```

### Required keys

| Key | Type | Description |
|-----|------|-------------|
| `inkwell` | `"scenes"` or `"single"` | Identifies this file as a Inkwell project and declares its format. |

### Project keys

| Key | Type | Required? | Description |
|-----|------|-----------|-------------|
| `title` | string | optional | Project title. When absent, the filename (without `.md`) is used. Projects sharing a `title` are grouped as drafts of one work. |
| `workflow` | string | optional | Name of the Compile workflow. Managed by Inkwell — do not edit by hand. |
| `sceneFolder` | string | scenes-only | Path (relative to the index file) where scenes live. Default `/`. |
| `sceneTemplate` | string | scenes-only, optional | Vault path to a template note used for newly-created scenes. |
| `ignoredFiles` | string[] | scenes-only, optional | Filenames (without `.md`) to ignore when discovering unknown scenes. Wildcards (`*`, `?`) supported. |
| `scenes` | string[] | scenes-only | Ordered, indented list of scene filenames. See *Scene hierarchy* below. |

### eBook metadata keys

All optional. Consumed by EPUB-producing compile steps.

| Key | Type | EPUB / Dublin Core mapping |
|-----|------|---------------------------|
| `author` | string | `dc:creator` |
| `language` | string | `dc:language` (e.g. `en`, `en-US`) |
| `identifier` | string | `dc:identifier` (URN/UUID; the Project tab has a *Generate* button) |
| `description` | string | `dc:description` |
| `cover` | string | Vault path to a cover image |
| `publisher` | string | `dc:publisher` |
| `pubdate` | ISO date | `dc:date` |
| `rights` | string | `dc:rights` |
| `subjects` | string[] | `dc:subject` |
| `series` | string | Calibre `calibre:series` |
| `seriesIndex` | number | Calibre `calibre:series_index` |

## Scene hierarchy

Scenes are stored as a **flat array of strings**. Indent is encoded by leading `> ` tokens — one `> ` per indent level. This keeps the entire scenes list editable in Obsidian's Properties UI without risking structural corruption.

```yaml
scenes:
  - first scene
  - "> second scene"      # child of "first scene"
  - "> third scene"       # also a child of "first scene"
  - "> > deep child"      # grandchild of "first scene"
  - fourth                # top level again
```

Notes:
- Only `> ` (greater-than followed by a single space) counts as an indent token. A scene whose filename happens to start with `>` (no trailing space) is preserved as-is.
- The Scenes tab and the Indent / Unindent commands continue to be the recommended way to manage hierarchy; you should rarely need to hand-edit this list.

## Other frontmatter

Inside an index file, the keys listed above (the discriminator, project keys, and eBook metadata keys) are managed by Inkwell: editing them in the Project tab writes them out, and clearing a field deletes the key. Any other frontmatter you put in the index file is left untouched.

Note that only files marked as a Inkwell project (via `inkwell: scenes` or `inkwell: single`) are affected — Inkwell does not touch the frontmatter of any other note in your vault, including scene files. Scene files keep their own `title:`, `tags:`, etc. with no risk of Inkwell overwriting them.

## Migrating from Longform

Inkwell's flat schema is a hard break from upstream Longform's nested format. Projects authored against upstream Longform's legacy nested `longform:` object (Longform 2.x) are not loaded automatically. To migrate an existing project, edit its index file once: replace the nested `longform:` block with the flat keys shown above, including `inkwell: scenes` (or `single`) at the top level. Scene order/hierarchy can be transcribed using the `> ` prefix convention.
