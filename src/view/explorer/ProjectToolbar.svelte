<script lang="ts">
  import { activeFile, newSceneFieldVisible, sceneViewMode } from "../stores";
  import { findScene } from "src/model/scene-navigation";
  import Icon from "../components/Icon.svelte";
  import { Menu } from "obsidian";
  import { SceneDetailsModal } from "../modals/SceneDetailsModal";
  import { type SceneViewMode } from "src/model/types";
  import { selectedProject } from "src/model/stores";
  import { useApp } from "../utils";

  const app = useApp();
  const { onCodex }: { onCodex: (path?: string) => void } = $props();
  const activeScenePath = $derived(
    $selectedProject && $activeFile && findScene($activeFile.path, [$selectedProject])
      ? $activeFile.path
      : null,
  );
  const viewModes: { id: SceneViewMode; label: string }[] = [
    { id: "list", label: "List" },
    { id: "cards", label: "Cards" },
    { id: "outline", label: "Outline" },
    { id: "timeline", label: "Timeline" },
  ];
  const viewLabel = $derived(viewModes.find((view) => view.id === $sceneViewMode)?.label ?? "List");
  let viewMenuOpen = $state(false);

  function openViewMenu(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
    const { currentTarget: button } = event;
    const menu = new Menu();
    for (const mode of viewModes) {
      menu.addItem((item) => {
        item.setTitle(mode.label)
          .setChecked($sceneViewMode === mode.id)
          .onClick(() => sceneViewMode.set(mode.id));
      });
    }
    menu.onHide(() => (viewMenuOpen = false));
    const bounds = button.getBoundingClientRect();
    viewMenuOpen = true;
    menu.showAtPosition({ x: bounds.left, y: bounds.bottom + 4 }, button.ownerDocument);
  }

  function openSceneDetails() {
    const project = $selectedProject;
    const file = app.workspace.getActiveFile();
    if (project?.format !== "scenes" || !file || !findScene(file.path, [project])) return;
    new SceneDetailsModal(app, file, project, onCodex).open();
  }
</script>

<div class="inkwell-toolbar">
  <button
    type="button"
    class="inkwell-scene-action scene-view"
    title="Scene view"
    aria-label="Scene view, {viewLabel}"
    aria-haspopup="menu"
    aria-expanded={viewMenuOpen}
    onclick={openViewMenu}
  >
    <span class="view-label">{viewLabel}</span>
    <Icon iconName="chevron-down" />
  </button>
  <button
    type="button"
    class="inkwell-scene-action scene-details"
    disabled={!activeScenePath}
    aria-label="Scene details"
    title={activeScenePath ? "Scene details" : "Open a scene to edit its details"}
    onclick={openSceneDetails}
  >
    <span class="details-icon"><Icon iconName="list-checks" /></span>
    <span class="details-label">Details</span>
    <span class="details-full-label">Scene details</span>
  </button>
  <button
    type="button"
    class="inkwell-scene-action"
    title="New scene"
    aria-label="New scene"
    onclick={() => newSceneFieldVisible.set(true)}
  >
    <span class="action-icon"><Icon iconName="file-plus" /></span>
    <span class="action-label">New scene</span>
  </button>
</div>

<style>
  .inkwell-toolbar {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--size-4-1);
    padding: var(--size-4-2);
    flex-shrink: 0;
    container-type: inline-size;
  }

  .scene-view {
    flex-shrink: 1;
    margin-inline-end: auto;
  }

  .view-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .action-label, .details-icon, .details-full-label {
    display: none;
  }

  @container (min-width: 220px) {
    .inkwell-scene-action {
      padding-inline: var(--size-4-1);
    }

    .action-icon {
      display: none;
    }

    .action-label {
      display: inline;
    }
  }

  @container (min-width: 310px) {
    .inkwell-scene-action {
      padding-inline: var(--size-4-2);
    }
  }

  @container (min-width: 250px) {
    .details-label {
      display: none;
    }

    .details-full-label {
      display: inline;
    }
  }

  @container (max-width: 205px) {
    .details-label {
      display: none;
    }

    .details-icon {
      display: flex;
    }
  }
</style>
