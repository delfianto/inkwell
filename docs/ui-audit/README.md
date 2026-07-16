# Inkwell — Design & Usability Audit

Captured live from the plugin running in Obsidian 1.12.7 (dark theme, `test-inkwell-vault`), driven over the Chrome DevTools Protocol. Screenshots are in [`./screens`](./screens). The evaluation uses standard heuristics — Nielsen's 10, Norman's affordances/signifiers, Gestalt grouping, typographic hierarchy, Fitts's law, progressive disclosure, and WCAG contrast — plus Obsidian's own design conventions (a good plugin should feel *native but intentional*).

> The two active vault CSS snippets are trivial (explorer font bumped to 16 px; a 🎉 prepended to `status: done` scenes) and don't change the structure. Findings are about Inkwell's own UI.

## TL;DR

The plugin **works** and is theme-correct — it rides Obsidian's CSS variables, so light/dark and accent all behave. But the visual design is inherited wholesale from Longform and never had an opinion applied to it. The result reads as **flat, low-contrast, and text-heavy**, with everything crammed into a ~300 px sidebar. Three themes dominate:

1. **No hierarchy.** Primary content (scene names, values, actions) sits at the same weight as secondary chrome (labels, help, warnings). Huge blocks of `--text-muted`/`--text-faint` create walls of gray.
2. **Density in the wrong container.** The Project and Compile tabs are editing-heavy but live in a narrow, scrolling sidebar. The eBook form alone is 11 stacked fields.
3. **Missing signifiers.** The scene list is drag-reorder-indentable with *zero* visual cue, and several primary actions are styled as text links.

There's one genuine **layout bug**: the tab bar wraps at default sidebar width. And one clearly **good** surface to emulate: the Add-Step modal.

Severity: **[H]** high (hurts everyday use / broken), **[M]** medium (friction / polish), **[L]** low (nit).

---

## Cross-cutting findings

### [H] The tab bar wraps at real sidebar widths
`screens/03-scenes-narrow-tabwrap.png` — at ~290 px (Obsidian's default right sidebar is ~250–300 px) "Compile" drops onto a second row and collides with the panel below.

- Cause: `ExplorerView.svelte` `.tab-list { font-size: 0 }` (a spacing hack) + `Tab.svelte` `.tab-button { padding: 0 1em 0 0.4em; border-right: 1px solid … }`. Fixed paddings + three icon+label buttons simply don't fit.
- The right-border dividers also give it a dated, segmented-toolbar look that doesn't match modern Obsidian.
- **Fix:** drop the `font-size:0` hack; make `.tab-list` a `display:flex` row that degrades gracefully — either `flex: 1` equal-width tabs, or icons-only with `aria-label` tooltips below a width threshold. Kill the per-tab right borders in favor of a single active-underline (matches Obsidian's own tab styling).

### [H] Everything is muted — no visual hierarchy
Across every tab, secondary text is rendered in `--text-muted`/`--text-faint` in large volumes, at small sizes, directly competing with the actual content.

- Project tab (`screens/04-project-tab.png`): each field is followed by a 3-line faint warning (`.inkwell-project-warning { color: var(--text-faint) }`). The warnings occupy more vertical space and visual area than the inputs they describe.
- Compile (`screens/06/07`): every step shows a permanent muted description + option help.
- **Fix:** establish a 3-tier type ramp — content (normal), labels (muted, smaller), help (faint, *on demand*). Move long help behind an ⓘ tooltip or a collapsible "Learn more", or show it only on focus. Reserve always-visible text for what the user needs while acting.

### [M] Editing-heavy content is trapped in a narrow sidebar
The eBook editor is 11 fields stacked vertically (`screens/05-ebook-metadata.png`); Compile is 5 tall cards + an instruction list + the run button (`screens/06/07`). Both demand a lot of scrolling in a column that's mostly ~300 px wide. Compare the Add-Step **modal** (`screens/08`), which gets 720 px and a 3-column grid and instantly feels better.

- **Fix:** use the wider surface for dense editing. Options: (a) an "Edit project metadata" modal for the eBook block, (b) two-column field layout when the pane is wide, (c) collapse eBook by default (already done) and group its fields. The point: don't force a book-metadata form through a phone-width column.

### [M] Missing affordances / signifiers
- **Scenes are silently draggable.** `SceneList.svelte` wires up SortableJS (reorder + indent-to-nest) but rows have no drag handle, no grab cursor hint, no hover chrome (`screens/01`). New users can't discover the core interaction. (Norman: affordance without a signifier isn't discoverable.)
- **Actions styled as text.** "Add all / Ignore all" (`.inkwell-unknown-add/ignore`) and "+ Add Step" (`.add-step-container button`, accent text that underlines on hover, `screens/07`) read as links, not buttons — weak targets and ambiguous (Fitts + affordance).
- **Fix:** show a drag handle on row hover and a `cursor: grab`; promote text-actions to real buttons (`.mod-cta` for primary, default button for secondary).

### [M] Inconsistent control & color language
- Compile "kind" pills (Scene / Join / Manuscript) are **all the same purple** in both the Add-Step modal and the step cards (`screens/06`, `08`). Color therefore carries no meaning — you must read each pill. This is the one place semantic color would pay off.
- Compile step cards use `--background-modifier-border` as the *card fill* (`CompileStepView.svelte`), so the card and its header strip are nearly the same muddy gray with almost no separation.
- Buttons appear in ~4 flavors (native `<select>`, segmented Multi/Single, accent-text links, real CTAs). No single button system.
- **Fix:** give the three step-kinds three distinct (theme-derived) hues; use `--background-secondary` for cards with a real header contrast; standardize on Obsidian's button classes.

### [L] Dead vertical space & flat empty states
Scenes and Project bottom-anchor their content at the top, leaving large empty voids below (`screens/01`, `04`). The only empty state (no projects, in `ProjectPicker.svelte`) is a plain muted paragraph.

### [L] Accessibility / correctness nits
- Large faint-on-dark text likely fails WCAG AA (e.g. `--text-faint` warnings at `--font-smallest`).
- `SceneList.svelte` has **duplicated CSS**: `.scene-container` and `.scene-container.collapsible` are byte-for-byte identical rule blocks — dead code.
- Settings help typo: "or **us** an indent command" (`InkwellSettings.ts`) → "use".

---

## Surface-by-surface

### Project picker + path — `screens/00`
Native `<select>` (fine, theme-correct) but the project **path** below it is tiny `--text-faint`, is actually a clickable button, and has no signifier that it's clickable. No indication of project *type* (scenes vs single) or draft. **Fix:** add a small type icon/badge to each option context; make the path a clearly-secondary but obviously-interactive element (hover underline + icon).

### Scenes tab — `screens/01` (flat), `02` (numbered), `03` (narrow)
The core view, and the weakest. With numbering off (the default in `DEFAULT_SETTINGS`), it's an undifferentiated wall of same-weight rows with **no per-scene metadata** — even though the plugin already tracks word counts and reads each scene's `status` frontmatter. Status is surfaced only if the user writes their own CSS snippet. **Fix:**
- Surface secondary data inline: a right-aligned word count and/or a small status dot per row.
- Add hover affordance (drag handle, `cursor: grab`) and lightweight row separation.
- Make "New Scene" look like an input with a clear add affordance, not another list row.
- Treat `status` as first-class (a colored dot/label), not snippet-only.

### Project tab — `screens/04`
Three collapsible sections (Metadata / eBook / Word Count). Problems: the faint multi-line warnings dominate; the disclosure headers align their chevron via fragile negative margins (`margin-left: calc(var(--size-4-6) * -1)`); Word Count is bare text ("Project: 195 words"). **Fix:** demote warnings to on-demand help; render Word Count as a small stat tile (number emphasized, label muted); rebuild the section header as a normal flex row instead of negative-margin trickery.

### eBook metadata — `screens/05`
Eleven fields in one flat stack with generous spacing → very tall, lots of scrolling, no grouping. **Fix:** group into **Identity** (author, language, identifier), **Publication** (publisher, date, rights), **Classification** (subjects, series, series index); two columns when wide; consider moving the whole block into a modal.

### Compile tab — `screens/06`, `07`
Denser and more "designed," but: muddy card fill; monochrome kind pills; always-on descriptions + option help; a permanent 5-item instructions list; weak "+ Add Step"; and the primary **Compile** button sits below the fold on any real workflow. **Fix:** collapse step descriptions by default (name + kind + options), color-code kinds, promote Add Step to a button, tuck the instructions behind a help disclosure, and consider a sticky bottom action bar so Compile is always reachable.

### Add Step modal — `screens/08` ✅ *keep*
The best surface: a responsive card grid with hover states and good spacing — proof the wider container helps. Nits: monochrome pills (as above), uneven card row heights (`grid-auto-rows: auto`), oversized card titles.

### New Project modal — `screens/09` (empty), `10` (filled)
Explanation-first: **two dense paragraphs before the input**, and the Create button only appears after valid input, so the empty modal has no visible primary action. Over-explains for anyone who's done it once. **Fix:** lead with the Multi/Single choice + the Title field; demote the prose to compact helper text under each toggle option; always render Create (disabled until valid) for discoverability. Keep the live path preview — that part's good.

### Settings — `screens/11` ✅ *mostly good*
Uses Obsidian's native `Setting` API, so it's the most consistent surface. Nits: the "New scene template" help renders as a **full-width paragraph outside** the setting row while the toggle below has inline desc — inconsistent rhythm; the "use" typo; sections could carry short descriptions.

---

## What's working (don't lose it)
- Built entirely on Obsidian CSS variables → correct in light/dark, respects accent. Good foundation to design *on top of*.
- Add-Step modal card grid.
- Live target-path preview in New Project.
- Settings on the native API.
- The `.inkwell-leaf` scene-styling hook for power users.

---

## Prioritized action plan

**Quick wins (CSS/markup, high impact):**
1. Fix the tab-bar wrap + restyle to a native underline. `[H]`
2. Cut/relocate the faint help text; tighten the type ramp. `[H]`
3. Scene-row affordances: hover drag handle, `cursor: grab`, subtle separators. `[M]`
4. Color-code compile kind pills; fix the muddy step-card fill. `[M]`
5. Promote text-actions ("Add all/Ignore all", "+ Add Step") to real buttons. `[M]`
6. Surface word count + status per scene row. `[M]`
7. Settings: fix full-width help inconsistency + "use" typo; remove duplicated `.scene-container` CSS. `[L]`

**Structural (worth a design pass):**
1. Move dense editing (eBook, maybe all Project metadata) to a wider modal or a responsive two-column layout. `[M]`
2. Rework the New Project flow to action-first. `[M]`
3. Rethink Compile: collapsible steps, sticky run bar, help disclosure. `[M]`
4. Give the Scenes list a real information design (metadata, grouping, discoverable DnD). `[H]`

---

## How these were captured (repro)
Obsidian was launched with `--remote-debugging-port=9222` on `test-inkwell-vault`; a small Node CDP driver (`fetch` + `WebSocket`, no deps) selected the project/tab via the DOM and captured element-clipped PNGs at 2×. The global `obsidian.json` and the `numberScenes` setting were changed only transiently and restored afterward.
