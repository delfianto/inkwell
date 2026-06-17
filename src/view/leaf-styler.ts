import { FileView, type EventRef, type Workspace } from "obsidian";
import { get, type Unsubscriber } from "svelte/store";

import { projects } from "src/model/stores";
import { projectForPath } from "src/model/scene-navigation";
import type { Project } from "src/model/types";

const INKWELL_LEAF_CLASS = "inkwell-leaf";

/**
 * Applies the `inkwell-leaf` CSS class to markdown leaves whose file
 * belongs to a Inkwell project, and stamps `data-leaf-id` on every
 * leaf for downstream CSS hooks.
 */
export class LeafStyler {
  private workspace: Workspace;
  private registerEvent: (ref: EventRef) => void;

  constructor(workspace: Workspace, registerEvent: (ref: EventRef) => void) {
    this.workspace = workspace;
    this.registerEvent = registerEvent;
  }

  /**
   * Register the layout-change listener and subscribe to project updates.
   * Returns the projects-store unsubscriber for the caller's cleanup.
   */
  watch(): Unsubscriber {
    this.registerEvent(this.workspace.on("layout-change", () => this.styleAll()));
    return projects.subscribe((all) => this.styleAll(all));
  }

  private styleAll(allProjects: Project[] = get(projects)) {
    this.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      if (leaf.view instanceof FileView) {
        const project = projectForPath(leaf.view.file.path, allProjects);
        if (project) {
          leaf.view.containerEl.classList.add(INKWELL_LEAF_CLASS);
        } else {
          leaf.view.containerEl.classList.remove(INKWELL_LEAF_CLASS);
        }
      }

      const leafId = leaf.id;
      if (leafId) {
        leaf.view.containerEl.dataset.leafId = leafId;
      }
    });
  }
}
