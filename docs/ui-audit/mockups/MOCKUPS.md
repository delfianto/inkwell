# Inkwell redesign — mockups (round 1)

Open [`index.html`](./index.html) to view all three together, or the individual SVGs. To-scale, Obsidian dark palette. These are **wireframes to react to**, not final pixels — colors/spacing will shift once we settle the direction.

Directions locked in the kickoff:
- **Compile** → full-pane workflow builder (workspace tab, not the sidebar)
- **Scenes** → refined List (default) + **Outline** as the wide-screen view
- **Project/eBook** → eBook moves to its own modal; the Project tab stays lean

## 1 · Scenes — `01-scenes.svg`
- Per-row **colour-coded status bullet** from front-matter `status:` — **draft** (amber) · **revising** (blue) · **complete** (green) · **scrap** (red) — plus word count.
- **Discoverable drag**: grab handle appears on row hover; clear selected state.
- **Card view** (wide): scenes become cards grouped under **collapsible Act headers** derived from Index.md depth (`>` tokens), **two levels max**; cards reflow to fill wide/ultrawide panes and carry status + word count + a synopsis line. (An **Outline** view is also offered for full-depth hierarchy.)
- Fixed **tab bar**: equal-width, active-underline, no wrapping (the current wrap bug is gone).
- `New scene` is a real, obvious input.

## 2 · Project + eBook — `02-project-and-ebook.svg`
- Project tab = a **one-line overview** (words · scenes · acts — no goals, no day-to-day tracking) + the essential fields only; dense help collapses behind ⓘ.
- **eBook launcher** card shows a `3 / 11 set` progress hint and opens the modal.
- eBook **modal**: grouped **Identity / Publication / Classification**, two columns, subject **chips**, a **cover thumbnail** with Replace, autosaves to front-matter. No walls of faint help text.

## 3 · Compile — `03-compile-fullpane.svg`
- Opens as a workspace tab. **Two columns**: compact one-line step list (left) + config for the **selected step only** (right) → no more endless scroll.
- **Color-coded kinds** (Scene / Join / Manuscript) so type is scannable.
- **Live preview** of the selected step applied to a real scene.
- `Run` and validity are always visible (top bar + status bar); the sidebar keeps only a small "Open compile builder" entry.

## 4 · New Project modal + empty state — `04-new-project-and-empty.svg`
- **Action-first modal**: project **type + title** lead; each type is a **selectable card** (icon + a one-line description) instead of two paragraphs of prose; **live path** preview; **Create** is always visible (disabled until a title is typed). Cancel/Create in a proper footer.
- **Empty state** (no projects): an icon, one sentence, and a real **+ New project…** CTA, with the right-click path as a secondary hint — replaces the current wall-of-text paragraph.

## Deliberately deferred
- The workflow overflow menu and confirm dialogs.
- Exact type ramp, spacing tokens, motion, and a light-theme pass.

## Decisions (round 2)
1. **Compile** — left step-list + right config panel is the direction.
2. **Status** — colour-coded bullet from front-matter `status:` → draft = amber · revising = blue · complete = green · scrap = red.
3. **Grouping** — from Index.md scene depth (`>` tokens). Card view caps at **two levels** (top-level = collapsible Act header); Outline view can show full depth.
4. **Project overview** — stays a one-liner, no goals or day-to-day tracking; just cleaner.
